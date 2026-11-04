import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {csv,csvCell} from '../src/csv.js';
import {rateLimit} from '../src/ratelimit.js';

const run=(env,code)=>spawnSync(process.execPath,['--input-type=module','-e',code],{env:{PATH:process.env.PATH,DATABASE_URL:'postgres://x@127.0.0.1/x',...env},encoding:'utf8',cwd:new URL('..',import.meta.url).pathname});

test('csv escapes quotes and blocks spreadsheet formulas',()=>{
 assert.equal(csvCell('a,b'),'"a,b"');assert.equal(csvCell('say "hi"'),'"say ""hi"""');
 assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');assert.equal(csvCell('+1'),"'+1");assert.equal(csvCell(null),'');assert.equal(csvCell(5),'5');
 assert.ok(csv(['A'],[['1']]).startsWith('﻿A'));
});
test('rate limiter blocks after max and reports Retry-After',()=>{
 const rl=rateLimit({windowMs:60000,max:3});const res=()=>{const r={headers:{},code:0,body:null,setHeader(k,v){r.headers[k]=v},status(c){r.code=c;return r},json(b){r.body=b}};return r};
 let passed=0;for(let i=0;i<5;i++){const r=res();rl({ip:'1.1.1.1'},r,()=>passed++)}
 assert.equal(passed,3);const r=res();rl({ip:'1.1.1.1'},r,()=>{});assert.equal(r.code,429);assert.ok(r.headers['Retry-After']);
 const other=res();let ok=false;rl({ip:'2.2.2.2'},other,()=>{ok=true});assert.ok(ok);
});
test('production refuses to start without strong secrets and https origin',()=>{
 const code="import('./src/config.js').then(m=>{m.validateConfig();console.log('OK')}).catch(e=>{console.log(e.message)})";
 assert.match(run({NODE_ENV:'production'},code).stdout,/SESSION_SECRET.*APP_ORIGIN/s);
 assert.match(run({NODE_ENV:'production',SESSION_SECRET:'x'.repeat(40),APP_ORIGIN:'http://till.shop'},code).stdout,/must start with https/);
 assert.match(run({NODE_ENV:'production',SESSION_SECRET:'x'.repeat(40),APP_ORIGIN:'https://till.shop'},code).stdout,/OK/);
 assert.match(run({STORE_TIMEZONE:'Mars/Base'},code).stdout,/not a valid time zone/);
});
test('simulated card payments are disabled in production unless explicitly allowed',()=>{
 const code="import('./src/payments.js').then(m=>console.log(m.enabledMethods().join(',')+'|'+m.getProvider().name))";
 assert.equal(run({},code).stdout.trim(),'cash,ecocash,card|simulated');
 assert.equal(run({NODE_ENV:'production'},code).stdout.trim(),'cash|cash-only');
 assert.equal(run({NODE_ENV:'production',ALLOW_SIMULATED_PAYMENTS:'true'},code).stdout.trim(),'cash,ecocash,card|simulated');
 assert.match(run({PAYMENT_PROVIDER:'nope'},code).stderr,/Unknown PAYMENT_PROVIDER/);
});
test('declined simulated payments and cash outcomes',async()=>{
 const code="import('./src/payments.js').then(async m=>{const a=await m.authorizePayment({method:'card',demoOutcome:'declined'});const b=await m.authorizePayment({method:'cash'});const c=await m.authorizePayment({method:'card'});console.log([a.outcome,b.outcome,c.outcome,c.reference.startsWith('SIM-')].join())})";
 assert.equal(run({},code).stdout.trim(),'declined,pending,approved,true');
});
