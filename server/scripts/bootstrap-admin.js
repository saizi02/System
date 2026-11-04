import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {sql,pool} from '../src/db.js';
const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();const password=process.env.BOOTSTRAP_ADMIN_PASSWORD;const name=(process.env.BOOTSTRAP_ADMIN_NAME||'Super Admin').trim().slice(0,90);
try{
 if(!email||!password||password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password))throw Error('Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in server/.env (optional BOOTSTRAP_ADMIN_NAME). Password: 12+ characters, upper/lowercase/digit. Remove variables after bootstrap.');
 const existing=await sql("SELECT count(*)::int AS count FROM staff WHERE role='super_admin'");if(existing.rows[0].count)throw Error('A Super Admin already exists. Bootstrap is intentionally single-use — sign in and create further Super Admins from the Admin console.');
 const hash=await bcrypt.hash(password,12);await sql("INSERT INTO staff(email,password_hash,role,display_name) VALUES($1,$2,'super_admin',$3)",[email,hash,name]);console.log('Super Admin created:',email,'(remove BOOTSTRAP_* entries from server/.env)');
}catch(e){console.error(e.message);process.exitCode=1}finally{await pool.end()}
