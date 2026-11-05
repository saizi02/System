import pg from 'pg';
import dotenv from 'dotenv';
import {existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const serverDir=dirname(fileURLToPath(import.meta.url));
const rootEnv=resolve(serverDir,'../../.env.local');
if(existsSync(rootEnv))dotenv.config({path:rootEnv,override:true});
dotenv.config();
const url=process.env.DATABASE_URL;
if(!url)throw Error('Missing DATABASE_URL: copy server/.env.example to server/.env and configure PostgreSQL.');
const sslRequested=/([?&])(sslmode=(require|no-verify)|ssl=true)(?:&|$)/i.test(url);
const wantsSsl=sslRequested||process.env.PGSSLMODE==='require'||(process.env.NODE_ENV==='production'&&!/localhost|127\.0\.0\.1/i.test(url));
export const pool=new pg.Pool({
 connectionString:url,
 max:10,
 connectionTimeoutMillis:10000,
 ...(wantsSsl?{ssl:{rejectUnauthorized:false}}:{})
});
export const migrationPool=new pg.Pool({
 connectionString:process.env.DATABASE_URL_UNPOOLED||url,
 max:10,
 connectionTimeoutMillis:10000,
 ...(wantsSsl?{ssl:{rejectUnauthorized:false}}:{})
});
export const sql=(query,params=[])=>pool.query(query,params);
export async function transaction(task){const client=await pool.connect();try{await client.query('BEGIN');const result=await task(client);await client.query('COMMIT');return result}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
