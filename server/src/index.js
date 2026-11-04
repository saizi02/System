import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';import {existsSync} from 'node:fs';
import {join,extname,resolve} from 'node:path';
import {pool,sql} from './db.js';
import {HttpError,assert,tokenHash,publicStaff,PORTALS} from './helpers.js';
import {getData} from './read.js';
import {action,audit} from './actions.js';
import {config,validateConfig} from './config.js';import {rateLimit} from './ratelimit.js';import {enabledMethods,getProvider} from './payments.js';import {closeout,salesCsv,stockCsv} from './reports.js';
const app=express();const production=process.env.NODE_ENV==='production';const PORT=Number(process.env.PORT||3001);
validateConfig();
if(production)app.set('trust proxy',1);
app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:false}));app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});
// Content-Security-Policy for the built app (the Vite dev server is unaffected).
if(production)app.use(helmet.contentSecurityPolicy({useDefaults:false,directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com','data:'],imgSrc:["'self'",'data:','blob:','https:'],connectSrc:["'self'"],mediaSrc:["'self'",'blob:'],workerSrc:["'self'",'blob:'],manifestSrc:["'self'"],frameAncestors:["'none'"],baseUri:["'self'"],formAction:["'self'"],objectSrc:["'none'"]}}));
// Rate limits per client IP (a shop's devices share one address, so reads are generous).
app.use('/api/data',rateLimit({windowMs:60000,max:4000}));app.use('/api/actions',rateLimit({windowMs:60000,max:900}));app.use('/api/auth',rateLimit({windowMs:60000,max:60,message:'Too many sign-in requests. Please wait a minute.'}));app.use('/api/uploads',rateLimit({windowMs:60000,max:60}));
// One line per write request and per failure, for the server log.
app.use('/api',(req,res,next)=>{if(req.method==='GET')return next();const t=Date.now();res.on('finish',()=>console.log(JSON.stringify({t:new Date().toISOString(),m:req.method,p:req.path,s:res.statusCode,ms:Date.now()-t,ip:req.ip})));next()});app.use(express.json({limit:'256kb'}));
const cookieName='sstwas_session';
const cookieHeader=(token,maxAge)=>`${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${production?'; Secure':''}`;
const clearCookie=()=>`${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${production?'; Secure':''}`;
// In development, tablets on the same Wi-Fi (private IPv4 ranges) may call the API; production uses APP_ORIGIN only.
const lanOrigin=/^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
const allowedOrigins=(process.env.APP_ORIGIN||'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5174').split(',').map(x=>x.trim());
app.use((req,res,next)=>{if(['POST','PUT','PATCH','DELETE'].includes(req.method)){const origin=req.get('origin');if(origin&&!allowedOrigins.includes(origin)&&!(!production&&lanOrigin.test(origin)))return res.status(403).json({error:'Request origin not allowed'});if(!origin&&production)return res.status(403).json({error:'Missing request origin'});}next()});
async function startSession(res,userId=null,guestId=randomUUID()){
 const token=randomBytes(48).toString('base64url');const ttl=userId?12*3600:7*24*3600;
 await sql('INSERT INTO sessions(token_hash,user_id,guest_id,expires_at) VALUES($1,$2,$3,now()+($4 * interval \u00271 second\u0027))',[tokenHash(token),userId,guestId,ttl]);res.setHeader('Set-Cookie',cookieHeader(token,ttl));return{guestId};
}
app.use(async(req,res,next)=>{try{
 const value=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 let found;if(value){const token=decodeURIComponent(value);found=(await sql('SELECT s.guest_id,s.user_id,u.id,u.email,u.role,u.business_id,u.branch_id,u.disabled,u.must_change_password,u.display_name,s.last_seen FROM sessions s LEFT JOIN staff u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[tokenHash(token)])).rows[0]}
 // Admin consoles sign out after ADMIN_IDLE_MINUTES without an action (page polling does not count as activity).
 if(found?.id&&['super_admin','business_admin'].includes(found.role)&&Date.now()-new Date(found.last_seen).getTime()>config.adminIdleMinutes*60000){await sql('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(decodeURIComponent(value))]);found=undefined}
 if(found&&req.method!=='GET'&&Date.now()-new Date(found.last_seen).getTime()>30000)void sql('UPDATE sessions SET last_seen=now() WHERE token_hash=$1',[tokenHash(decodeURIComponent(value))]).catch(()=>{});
 if(found){req.guestId=found.guest_id;req.staff=found.id?found:null;req.sessionToken=value}
 else {const g=await startSession(res);req.guestId=g.guestId;req.staff=null}
 next();
 }catch(e){next(e)}});
app.get('/api/health',async(req,res,next)=>{try{await sql('SELECT 1');res.json({ok:true,database:'postgresql',version:config.version,storeMode:config.storeMode,payments:getProvider().name})}catch(e){next(e)}});
// Public deployment settings the apps need before sign-in: store mode, the locked store (single mode) and enabled payment methods.
app.get('/api/config',async(req,res,next)=>{try{
 let store=null;
 if(config.storeMode==='single'){
  const rows=config.storeId?(await sql("SELECT id,name,profile FROM businesses WHERE id=$1 AND status='active'",[config.storeId])).rows:(await sql("SELECT id,name,profile FROM businesses WHERE status='active' ORDER BY created_at LIMIT 2")).rows;
  if(rows.length===1||config.storeId&&rows.length){const b=rows[0];const branches=(await sql('SELECT id,name FROM branches WHERE business_id=$1 AND active ORDER BY created_at',[b.id])).rows;store={...b,branches}}
 }
 const provider=getProvider();
 res.json({storeMode:config.storeMode,store,payments:{methods:enabledMethods(),simulated:provider.name==='simulated'},timezone:config.timezone,version:config.version})
}catch(e){next(e)}});
// Reports and exports (staff only; authorisation is checked per branch in reports.js).
app.get('/api/reports/closeout',async(req,res,next)=>{try{assert(req.staff&&!req.staff.disabled&&!req.staff.must_change_password,401,'Sign in required');res.json(await closeout(req.staff,req.query))}catch(e){next(e)}});
const sendCsv=(name,fn)=>async(req,res,next)=>{try{assert(req.staff&&!req.staff.disabled&&!req.staff.must_change_password,401,'Sign in required');const body=await fn(req.staff,req.query);res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${name}-${new Date().toISOString().slice(0,10)}.csv"`);res.send(body)}catch(e){next(e)}};
app.get('/api/export/sales.csv',sendCsv('sales',salesCsv));app.get('/api/export/stock.csv',sendCsv('stock',stockCsv));
app.get('/api/auth/me',(req,res)=>res.json({user:publicStaff(req.staff?.disabled?null:req.staff)}));
// Basic brute-force protection: 8 failed sign-ins per IP+email in 15 minutes locks that pair out until the window ends.
const attempts=new Map();const WINDOW=15*60*1000,MAX_FAILS=8;
const throttle=key=>{const now=Date.now();const a=attempts.get(key);if(!a||now-a.first>WINDOW){attempts.delete(key);return false}return a.count>=MAX_FAILS};
const failed=key=>{const now=Date.now();const a=attempts.get(key);if(!a||now-a.first>WINDOW)attempts.set(key,{first:now,count:1});else a.count++};
setInterval(()=>{const now=Date.now();for(const [k,v] of attempts)if(now-v.first>WINDOW)attempts.delete(k)},WINDOW).unref();
app.post('/api/auth/login',async(req,res,next)=>{try{
 const email=String(req.body.email||'').trim().toLowerCase();const password=String(req.body.password||'');
 // `portal` ('admin' | 'cashier' | 'kitchen') lets each standalone dashboard accept only the accounts that belong there.
 const portal=req.body.portal===undefined?null:String(req.body.portal);assert(portal===null||PORTALS[portal],400,'Unknown sign-in portal');
 const key=`${req.ip}|${email}`;assert(!throttle(key),429,'Too many failed sign-in attempts. Please wait 15 minutes and try again.');
 const user=(await sql('SELECT * FROM staff WHERE email=$1',[email])).rows[0];
 const valid=await bcrypt.compare(password,user?.password_hash||'$2a$12$N38oE9hVgTShc9guP8v23u5kUsWhWNwTWLXUX.I2Ghlrbo1gW9hZ6');
 if(!(user&&valid&&!user.disabled)){failed(key);throw new HttpError(401,'Invalid credentials or account disabled')}
 attempts.delete(key);
 if(portal)assert(PORTALS[portal].roles.includes(user.role),403,`This account is not authorised for the ${PORTALS[portal].label}. Use the correct station for your role.`);
 if(req.sessionToken)await sql('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(decodeURIComponent(req.sessionToken))]);
 await startSession(res,user.id,randomUUID());await sql('UPDATE staff SET last_login_at=now() WHERE id=$1',[user.id]);await audit(user.business_id,user.id,'auth.login',{portal:portal||'general'});res.json({user:publicStaff(user)});
 }catch(e){next(e)}});
app.post('/api/auth/logout',async(req,res,next)=>{try{if(req.sessionToken)await sql('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(decodeURIComponent(req.sessionToken))]);res.setHeader('Set-Cookie',clearCookie());res.json({ok:true})}catch(e){next(e)}});
app.get('/api/data',async(req,res,next)=>{try{const path=String(req.query.path||'');assert(path.length<300,400,'Resource path too long');const data=await getData(path,req.staff?.disabled||req.staff?.must_change_password?null:req.staff,{field:req.query.field,value:req.query.value,guestId:req.guestId});res.json({items:data})}catch(e){next(e)}});
app.post('/api/actions/:name',async(req,res,next)=>{try{const data=await action(req.params.name,req.body||{},req);res.json(data)}catch(e){next(e)}});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1},fileFilter:(_,file,cb)=>{if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype))cb(new Error('Only JPEG, PNG, WebP and GIF are allowed'));else cb(null,true)}});
app.post('/api/uploads/:businessId',upload.single('image'),async(req,res,next)=>{try{
 assert(req.staff&&['super_admin','business_admin'].includes(req.staff.role),403,'Admin required');if(req.staff.role!=='super_admin')assert(req.staff.business_id===req.params.businessId,403,'Different business');
 assert(req.file,400,'Image missing');const ext={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'}[req.file.mimetype];
 assert(/^[a-f0-9-]{36}$/i.test(req.params.businessId),400,'Invalid business ID');const directory=resolve('uploads',req.params.businessId);await mkdir(directory,{recursive:true});const filename=randomUUID()+ext;await writeFile(join(directory,filename),req.file.buffer,{flag:'wx'});res.json({url:`/api/images/${req.params.businessId}/${filename}`});
 }catch(e){next(e)}});
app.use('/api/images',express.static(resolve('uploads'),{dotfiles:'deny',immutable:true,maxAge:'30d',fallthrough:false}));
app.use('/api',(req,res)=>res.status(404).json({error:'API endpoint not found'}));
// Serve the built web app (npm run build) from this same server so one process runs the whole system.
const staticRoot=resolve(config.staticDir);
if(existsSync(join(staticRoot,'index.html'))){
 app.use(express.static(staticRoot,{index:false,setHeaders:(res,file)=>{res.setHeader('Cache-Control',/[\\/]assets[\\/]/.test(file)?'public, max-age=31536000, immutable':'no-cache')}}));
 app.get('*',(req,res)=>{res.setHeader('Cache-Control','no-cache');res.sendFile(join(staticRoot,'index.html'))});
}
app.use((req,res)=>res.status(404).json({error:'Not found'}));
app.use((error,req,res,next)=>{const status=error instanceof HttpError?error.status:error.code==='23505'?409:error.code==='22P02'?400:error.code==='23503'?400:error instanceof multer.MulterError||error.message?.startsWith('Only JPEG')?400:500;const message=status===500?'Internal server error':error.code==='23505'?'That value already exists (for example, an account with this email)':error.message;console.error(`[${status}]`,error.message);res.status(status).json({error:message})});
const server=app.listen(PORT,'0.0.0.0',()=>console.log(`SSTWAS ready on port ${PORT} · mode=${config.storeMode} · payments=${getProvider().name}${config.production?'':' · development'}`));
setInterval(()=>{void sql('DELETE FROM sessions WHERE expires_at<now()').catch(()=>{})},3600000).unref();
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{console.log(`${sig}: shutting down`);server.close(()=>{void pool.end().finally(()=>process.exit(0))});setTimeout(()=>process.exit(1),10000).unref()});
