import 'dotenv/config';
import pg from 'pg';
const url=process.env.DATABASE_URL;
if(!url)throw Error('Missing DATABASE_URL: copy server/.env.example to server/.env and configure PostgreSQL.');
export const pool=new pg.Pool({connectionString:url,max:10,connectionTimeoutMillis:5000});
export const sql=(query,params=[])=>pool.query(query,params);
export async function transaction(task){const client=await pool.connect();try{await client.query('BEGIN');const result=await task(client);await client.query('COMMIT');return result}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
