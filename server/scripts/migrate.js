import {migrationPool as pool} from '../src/db.js';
import {readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../sql');
// Applies every sql/NNN_*.sql file once, in order. Safe to run repeatedly.
try{
 await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 const applied=new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map(r=>r.name));
 const files=readdirSync(root).filter(f=>/^\d+_.*\.sql$/.test(f)).sort();
 let count=0;
 for(const file of files){
  if(applied.has(file)){console.log('Already applied:',file);continue}
  const client=await pool.connect();
  try{await client.query('BEGIN');await client.query(readFileSync(resolve(root,file),'utf8'));await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[file]);await client.query('COMMIT');console.log('PostgreSQL migration applied:',file);count++}
  catch(e){await client.query('ROLLBACK');throw new Error(`${file}: ${e.message}`)}
  finally{client.release()}
 }
 if(!count)console.log('Database schema is up to date.');
}catch(err){
 const detail=err?.stack||err?.message||String(err);
 console.error(`Migration failed: ${detail}`);
 if(err?.code)console.error(`Database error code: ${err.code}`);
 process.exitCode=1;
}finally{await pool.end()}
