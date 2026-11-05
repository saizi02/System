import bcrypt from 'bcryptjs';
import {randomBytes,createHash} from 'node:crypto';
import {sql,transaction} from './db.js';
import {config} from './config.js';import {authorizePayment} from './payments.js';
import {HttpError,authorize,assert,required,integer,cartItems,options,tokenHash,ROLES,canManage,strongPassword,canAdvance,NEXT_FULFILLMENT} from './helpers.js';
const profiles=['grocery','food','clothing'];const currencies=['USD','ZIG','ZAR'];
const one=async(q,p=[])=>(await sql(q,p)).rows[0];
export const audit=async(b,id,action,details={})=>{await sql('INSERT INTO audit_logs(business_id,actor_id,action,details) VALUES($1,$2,$3,$4)',[b||null,id||null,action,JSON.stringify(details)])};
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newPairingCode=()=>{const b=randomBytes(8);return Array.from(b,x=>CODE_ALPHABET[x%CODE_ALPHABET.length]).join('')};
const normalizeCode=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const codeHash=v=>createHash('sha256').update('kiosk-pair:'+normalizeCode(v)).digest('hex');
const prettyCode=c=>`${c.slice(0,4)}-${c.slice(4)}`;
// Pairing is a public endpoint, so guess attempts are throttled per IP (10 / 15 min).
const pairAttempts=new Map();
const pairBlocked=ip=>{const a=pairAttempts.get(ip);const now=Date.now();if(!a||now-a.first>15*60000){pairAttempts.delete(ip);return false}return a.count>=10};
const pairFailed=ip=>{const a=pairAttempts.get(ip);const now=Date.now();if(!a||now-a.first>15*60000)pairAttempts.set(ip,{first:now,count:1});else a.count++};
async function kioskForAdmin(actor,kioskId){const k=await one('SELECT * FROM kiosk_devices WHERE id=$1',[required(kioskId,'kiosk')]);assert(k,404,'Kiosk not found');authorize(actor,['super_admin','business_admin'],k.business_id);return k}
function scope(input){return{businessId:required(input.businessId,'businessId'),branchId:required(input.branchId,'branchId')}}
function validateRates(rates){assert(rates&&typeof rates==='object',400,'Invalid rates');const result={USD:1};for(const c of ['ZIG','ZAR']){const n=Number(rates[c]);assert(Number.isFinite(n)&&n>0&&n<=1e6,400,'Invalid exchange rate');result[c]=n}return result}
export async function action(name,input,req){
 const actor=req.staff,guestId=req.guestId;
 switch(name){
 case 'createBusiness':{
  authorize(actor,['super_admin']);const n=required(input.name,'store name');assert(profiles.includes(input.profile),400,'Invalid shop profile');
  const existing=await one('SELECT id FROM businesses WHERE lower(trim(name))=lower($1) LIMIT 1',[n]);assert(!existing,409,`A store named "${n}" already exists`);
  if(config.storeMode==='single')assert(!(await one('SELECT 1 x FROM businesses LIMIT 1')),409,'This installation is locked to a single store (STORE_MODE=single) and its store already exists.');
  const branchName=required(input.branchName||'Main branch','branch name');
  const address=String(input.address||'').trim().slice(0,300),phone=String(input.phone||'').trim().slice(0,60),taxNumber=String(input.taxNumber||'').trim().slice(0,80),receiptFooter=String(input.receiptFooter||'').trim().slice(0,300);
  const currency=currencies.includes(input.currency)?input.currency:'USD';
  const vatRate=Number(input.vatRate??0);assert(Number.isFinite(vatRate)&&vatRate>=0&&vatRate<=100,400,'Invalid VAT rate');
  const out=await transaction(async c=>{const b=(await c.query('INSERT INTO businesses(name,profile,address,phone,tax_number,receipt_footer,vat_rate,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[n,input.profile,address,phone,taxNumber,receiptFooter,vatRate,currency])).rows[0];const r=(await c.query('INSERT INTO branches(business_id,name) VALUES($1,$2) RETURNING id',[b.id,branchName])).rows[0];return{businessId:b.id,branchId:r.id}});
  await audit(out.businessId,actor.id,'business.created',{...out,name:n,profile:input.profile});return out;
 }
 case 'updateBusiness':{
  const id=required(input.businessId,'businessId');authorize(actor,['super_admin','business_admin'],id);const patches=[],vals=[];const add=(column,value)=>{vals.push(value);patches.push(`${column}=$${vals.length}`)};
  if(input.name!==undefined)add('name',required(input.name,'store name'));
  if(input.status!==undefined){authorize(actor,['super_admin']);assert(['active','suspended'].includes(input.status),400,'Invalid status');add('status',input.status)}
  if(input.currency!==undefined){assert(currencies.includes(input.currency),400,'Invalid currency');add('currency',input.currency)}
  if(input.rates!==undefined)add('rates',JSON.stringify(validateRates(input.rates)));
  if(input.address!==undefined)add('address',String(input.address).slice(0,300));
  if(input.phone!==undefined)add('phone',String(input.phone).slice(0,60));
  if(input.taxNumber!==undefined)add('tax_number',String(input.taxNumber).slice(0,80));
  if(input.receiptFooter!==undefined)add('receipt_footer',String(input.receiptFooter).slice(0,300));
  if(input.vatRate!==undefined){const rate=Number(input.vatRate);assert(Number.isFinite(rate)&&rate>=0&&rate<=100,400,'Invalid VAT rate');add('vat_rate',rate)}
  if(input.domain!==undefined){authorize(actor,['super_admin']);add('domain',String(input.domain).slice(0,120))}
  assert(patches.length>0,400,'Nothing to update');vals.push(id);const result=await sql(`UPDATE businesses SET ${patches.join(',')},updated_at=now() WHERE id=$${vals.length} RETURNING id`,vals);assert(result.rowCount,404,'Store not found');await audit(id,actor.id,'business.updated');return{ok:true};
 }
 case 'upsertBranch':{
  const id=required(input.businessId,'businessId');authorize(actor,['super_admin','business_admin'],id);const name=required(input.name,'branch name');let row;
  if(input.branchId)row=await one('UPDATE branches SET name=$1, active=$2 WHERE id=$3 AND business_id=$4 RETURNING id',[name,input.active!==false,input.branchId,id]);
  else row=await one('INSERT INTO branches(business_id,name,active) VALUES($1,$2,$3) RETURNING id',[id,name,input.active!==false]);
  assert(row,404,'Store location not found');return{branchId:row.id};
 }
 case 'upsertProduct':{
  const id=required(input.businessId,'businessId');authorize(actor,['super_admin','business_admin'],id);const name=required(input.name,'name'),category=required(input.category,'category');const price=integer(input.priceCents,'priceCents',0,100000000);
  const variants=Array.isArray(input.variants)&&input.variants.length?input.variants.map((v,k)=>({id:required(v.id||`v${k+1}`,'variant id',40),name:required(v.name,'variant name',60)})):[{id:'default',name:'Standard'}];
  assert(variants.length<=25&&new Set(variants.map(v=>v.id)).size===variants.length,400,'Invalid product variants');const v=JSON.stringify(variants);
  const barcode=String(input.barcode||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,80);
  if(barcode){const dup=await one('SELECT name FROM products WHERE business_id=$1 AND barcode=$2 AND ($3::uuid IS NULL OR id<>$3::uuid) LIMIT 1',[id,barcode,input.productId||null]);assert(!dup,409,`Barcode ${barcode} already belongs to "${dup?.name}"`)}
  let row;
  if(input.productId){const prior=await one('SELECT variants FROM products WHERE id=$1 AND business_id=$2',[input.productId,id]);assert(prior,404,'Product not found');assert(prior.variants.every(x=>variants.some(y=>y.id===x.id)),409,'Cannot remove a variant with potential stock history');row=await one('UPDATE products SET name=$1,category=$2,price_cents=$3,barcode=$4,image=$5,description=$6,variants=$7,active=$8,updated_at=now() WHERE id=$9 AND business_id=$10 RETURNING id',[name,category,price,barcode,String(input.image||'').slice(0,600),String(input.description||'').slice(0,500),v,input.active!==false,input.productId,id]);}
  else row=await one('INSERT INTO products(business_id,name,category,price_cents,barcode,image,description,variants,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[id,name,category,price,barcode,String(input.image||'').slice(0,600),String(input.description||'').slice(0,500),v,input.active!==false]);
  await audit(id,actor.id,'product.saved',{productId:row.id});return{productId:row.id};
 }
 case 'setStock':{
  const{businessId,branchId}=scope(input);authorize(actor,['super_admin','business_admin'],businessId,branchId);const productId=required(input.productId,'product ID'),variantId=required(input.variantId,'variant ID');const qty=integer(input.quantity,'quantity',0,1e6),low=integer(input.lowStock??5,'lowStock',0,999999);
  const product=await one('SELECT variants FROM products WHERE id=$1 AND business_id=$2',[productId,businessId]);assert(product&&product.variants.some(v=>v.id===variantId),400,'Product or variant not found');const br=await one('SELECT id FROM branches WHERE id=$1 AND business_id=$2',[branchId,businessId]);assert(br,404,'Branch not found');
  await sql('INSERT INTO inventory(business_id,branch_id,product_id,variant_id,quantity,low_stock) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(business_id,branch_id,product_id,variant_id) DO UPDATE SET quantity=EXCLUDED.quantity,low_stock=EXCLUDED.low_stock,updated_at=now()',[businessId,branchId,productId,variantId,qty,low]);await audit(businessId,actor.id,'stock.set',{productId,variantId,qty});return{ok:true};
 }
 case 'createStaff':{
  // Super Admin: any role, any store. General Admin: Cashier / Kitchen accounts for their own store only.
  authorize(actor,['super_admin','business_admin']);
  const isSuper=actor.role==='super_admin';
  const role=required(input.role,'role',40);assert(ROLES.includes(role),400,'Unknown role');
  if(!isSuper)assert(['cashier','kitchen'].includes(role),403,'General Admins can only create Cashier and Kitchen accounts');
  const email=required(input.email,'email',250).toLowerCase();assert(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email),400,'Invalid email');
  const displayName=required(input.displayName,'full name',90);
  let businessId=null,branchId=null;
  if(role!=='super_admin'){
   businessId=isSuper?required(input.businessId,'businessId'):actor.business_id;
   if(!isSuper&&input.businessId)assert(input.businessId===actor.business_id,403,'Different business');
   const business=await one('SELECT id,profile FROM businesses WHERE id=$1',[businessId]);assert(business,404,'Store not found');
   if(role==='kitchen')assert(business.profile==='food',409,'Kitchen accounts are only available for Food stores');
   if(role==='cashier'||role==='kitchen'){branchId=required(input.branchId,'branch');assert(await one('SELECT id FROM branches WHERE id=$1 AND business_id=$2',[branchId,businessId]),400,'Invalid branch')}
  }
  // The creator chooses the initial password. If none is supplied the server generates a one-time temporary one.
  const supplied=typeof input.password==='string'&&input.password.length>0;
  const password=supplied?strongPassword(input.password):`Sstw!${randomBytes(14).toString('base64url')}7`;
  const mustChange=supplied?input.requireChange!==false:true;
  const hash=await bcrypt.hash(password,12);
  const row=await one('INSERT INTO staff(email,password_hash,role,business_id,branch_id,display_name,must_change_password,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[email,hash,role,businessId,branchId,displayName,mustChange,actor.id]);
  await audit(businessId,actor.id,'staff.created',{uid:row.id,email,role,passwordSetByCreator:supplied,mustChange});
  return{uid:row.id,...(supplied?{}:{temporaryPassword:password})};
 }
 case 'setStaffStatus':{
  authorize(actor,['super_admin','business_admin']);const id=required(input.uid,'uid');assert(id!==actor.id,409,'You cannot change your own account status');
  const target=await one('SELECT id,email,role,business_id FROM staff WHERE id=$1',[id]);assert(target,404,'Staff not found');assert(canManage(actor,target),403,'You cannot manage this account');
  const disabled=Boolean(input.disabled);
  if(disabled&&target.role==='super_admin'){const others=await one("SELECT count(*)::int AS c FROM staff WHERE role='super_admin' AND disabled=false AND id<>$1",[id]);assert(others.c>0,409,'At least one active Super Admin must remain')}
  await sql('UPDATE staff SET disabled=$1 WHERE id=$2',[disabled,id]);if(disabled)await sql('DELETE FROM sessions WHERE user_id=$1',[id]);
  await audit(target.business_id,actor.id,disabled?'staff.disabled':'staff.enabled',{uid:id,email:target.email,role:target.role});return{ok:true};
 }
 case 'resetStaffPassword':{
  authorize(actor,['super_admin','business_admin']);const id=required(input.uid,'uid');assert(id!==actor.id,409,'Use “Change my password” for your own account');
  const target=await one('SELECT id,email,role,business_id FROM staff WHERE id=$1',[id]);assert(target,404,'Staff not found');assert(canManage(actor,target),403,'You cannot manage this account');
  const password=strongPassword(input.password);const hash=await bcrypt.hash(password,12);
  await sql('UPDATE staff SET password_hash=$1,must_change_password=$2 WHERE id=$3',[hash,input.requireChange!==false,id]);await sql('DELETE FROM sessions WHERE user_id=$1',[id]);
  await audit(target.business_id,actor.id,'staff.password_reset',{uid:id,email:target.email});return{ok:true};
 }
 case 'changeOwnPassword':{
  assert(actor&&!actor.disabled,403,'Sign in first');const current=String(input.currentPassword||'');const next=strongPassword(input.newPassword);
  const me=await one('SELECT password_hash FROM staff WHERE id=$1',[actor.id]);assert(me&&await bcrypt.compare(current,me.password_hash),403,'Current password is incorrect');
  assert(current!==next,400,'Choose a password different from the current one');
  await sql('UPDATE staff SET password_hash=$1,must_change_password=false WHERE id=$2',[await bcrypt.hash(next,12),actor.id]);
  if(req.sessionToken)await sql('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2',[actor.id,tokenHash(decodeURIComponent(req.sessionToken))]);
  await audit(actor.business_id,actor.id,'staff.password_changed',{uid:actor.id});return{ok:true};
 }
 case 'createKiosk':{
  const businessId=required(input.businessId,'businessId');authorize(actor,['super_admin','business_admin'],businessId);const branchId=required(input.branchId,'branch');const n=required(input.name,'kiosk name',60);
  assert(await one('SELECT id FROM branches WHERE id=$1 AND business_id=$2',[branchId,businessId]),400,'Invalid location');
  const code=newPairingCode();const row=await one("INSERT INTO kiosk_devices(business_id,branch_id,name,pairing_hash,pairing_expires,created_by) VALUES($1,$2,$3,$4,now()+interval '24 hours',$5) RETURNING id",[businessId,branchId,n,codeHash(code),actor.id]);
  await audit(businessId,actor.id,'kiosk.created',{kioskId:row.id,name:n});return{kioskId:row.id,pairingCode:prettyCode(code)};
 }
 case 'resetKiosk':{
  // Unpairs the tablet (it falls back to the setup screen) and issues a fresh 24-hour pairing code.
  const k=await kioskForAdmin(actor,input.kioskId);const code=newPairingCode();
  await sql("UPDATE kiosk_devices SET token_hash=NULL,paired_at=NULL,state='offline',pairing_hash=$1,pairing_expires=now()+interval '24 hours' WHERE id=$2",[codeHash(code),k.id]);
  await audit(k.business_id,actor.id,'kiosk.reset',{kioskId:k.id,name:k.name});return{pairingCode:prettyCode(code)};
 }
 case 'setKioskEnabled':{
  const k=await kioskForAdmin(actor,input.kioskId);const enabled=input.enabled!==false;await sql('UPDATE kiosk_devices SET enabled=$1 WHERE id=$2',[enabled,k.id]);
  await audit(k.business_id,actor.id,enabled?'kiosk.enabled':'kiosk.maintenance',{kioskId:k.id,name:k.name});return{ok:true};
 }
 case 'deleteKiosk':{
  const k=await kioskForAdmin(actor,input.kioskId);await sql('DELETE FROM kiosk_devices WHERE id=$1',[k.id]);await audit(k.business_id,actor.id,'kiosk.deleted',{name:k.name});return{ok:true};
 }
 case 'pairKiosk':{
  // Public: called by the tablet itself with the one-time code an admin created. Returns a long-lived device token.
  assert(!pairBlocked(req.ip),429,'Too many attempts. Wait a few minutes and try again.');
  const k=await one('SELECT id,name,business_id,branch_id FROM kiosk_devices WHERE pairing_hash=$1 AND pairing_expires>now()',[codeHash(input.code)]);
  if(!k){pairFailed(req.ip);throw new HttpError(404,'Pairing code not recognised or expired. Ask an admin for a new one.')}
  const token=randomBytes(32).toString('base64url');
  await sql("UPDATE kiosk_devices SET token_hash=$1,paired_at=now(),pairing_hash=NULL,pairing_expires=NULL,last_seen=now(),state='idle',user_agent=$2 WHERE id=$3",[tokenHash(token),String(req.get('user-agent')||'').slice(0,200),k.id]);
  await audit(k.business_id,null,'kiosk.paired',{kioskId:k.id,name:k.name});
  return{deviceToken:token,kiosk:{id:k.id,name:k.name,businessId:k.business_id,branchId:k.branch_id}};
 }
 case 'kioskHeartbeat':{
  // Public: the kiosk app calls this every ~20 s. It keeps the Admin/Cashier "online" indicator fresh and tells the tablet if it was reset or put into maintenance.
  const token=typeof input.deviceToken==='string'?input.deviceToken:'';if(!token)return{paired:false};
  const state=['idle','shopping','checkout'].includes(input.state)?input.state:'idle';
  const k=await one('UPDATE kiosk_devices SET last_seen=now(),state=$2 WHERE token_hash=$1 RETURNING id,name,business_id,branch_id,enabled',[tokenHash(token),state]);
  if(!k)return{paired:false};
  return{paired:true,enabled:k.enabled,kiosk:{id:k.id,name:k.name,businessId:k.business_id,branchId:k.branch_id}};
 }
 case 'checkout':{
  const{businessId,branchId}=scope(input);const items=cartItems(input.items);assert(['cash','ecocash','card','bank'].includes(input.method),400,'Invalid method');assert(['mobile','kiosk','pos'].includes(input.source),400,'Invalid source');if(input.source==='pos')authorize(actor,['super_admin','business_admin','cashier'],businessId,branchId);
  const currency=input.currency||'USD';assert(currencies.includes(currency),400,'Invalid currency');const key=required(input.idempotencyKey,'checkout key',100);assert(/^[a-zA-Z0-9-]{10,100}$/.test(key),400,'Invalid idempotency key');
  // Lock the customer's session row: ensures identical keys never create multiple orders on concurrent retries.
  return transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[guestId,key]);
   const previous=(await c.query('SELECT id,status,total_cents FROM orders WHERE customer_uid=$1 AND idempotency_key=$2',[guestId,key])).rows[0];if(previous)return{orderId:previous.id,status:previous.status,totalCents:previous.total_cents};
   let device=null;if(input.source==='kiosk'&&typeof input.deviceToken==='string'&&input.deviceToken){device=(await c.query('SELECT id,name,enabled,business_id,branch_id FROM kiosk_devices WHERE token_hash=$1',[tokenHash(input.deviceToken)])).rows[0]||null;assert(device&&device.business_id===businessId&&device.branch_id===branchId,403,'This kiosk is no longer paired. Ask an admin to pair it again.');assert(device.enabled,409,'This kiosk is temporarily out of service');}
   const b=(await c.query('SELECT * FROM businesses WHERE id=$1',[businessId])).rows[0];const br=(await c.query('SELECT * FROM branches WHERE id=$1 AND business_id=$2',[branchId,businessId])).rows[0];assert(b?.status==='active'&&br?.active,409,'Shop not active');const rate=Number(b.rates[currency]||0);assert(Number.isFinite(rate)&&rate>0,409,'Currency rate missing');
   const sorted=[...items].sort((a,b)=>(a.productId+a.variantId).localeCompare(b.productId+b.variantId));const lines=[];
   for(const i of sorted){
    const p=(await c.query('SELECT name,price_cents,variants,active FROM products WHERE id=$1 AND business_id=$2',[i.productId,businessId])).rows[0];assert(p?.active,409,'Product unavailable');const variant=p.variants.find(v=>v.id===i.variantId);assert(variant,400,'Invalid variant');
    const stock=(await c.query('SELECT quantity FROM inventory WHERE business_id=$1 AND branch_id=$2 AND product_id=$3 AND variant_id=$4 FOR UPDATE',[businessId,branchId,i.productId,i.variantId])).rows[0];assert(stock?.quantity>=i.quantity,409,`${p.name} is out of stock`);
    lines.push({productId:i.productId,variantId:i.variantId,name:p.name,variantName:variant.name,quantity:i.quantity,unitCents:p.price_cents,lineCents:p.price_cents*i.quantity});
   }
   const totalCents=lines.reduce((sum,l)=>sum+l.lineCents,0);assert(totalCents<=1e9,400,'Order too large');const totalMinor=Math.round(totalCents*rate);const pay=await authorizePayment({method:input.method,amountMinor:totalMinor,currency,orderRef:key,demoOutcome:input.demoOutcome});const extra=options(b.profile,input.method,input,pay.outcome);const status=extra.paymentOutcome==='pending'?'pending_cash':extra.paymentOutcome==='declined'?'failed':'paid';
   if(status==='paid')for(const i of sorted)await c.query('UPDATE inventory SET quantity=quantity-$1,updated_at=now() WHERE business_id=$2 AND branch_id=$3 AND product_id=$4 AND variant_id=$5',[i.quantity,businessId,branchId,i.productId,i.variantId]);
   const row=(await c.query('INSERT INTO orders(business_id,branch_id,customer_uid,idempotency_key,items,total_cents,currency,rate,total_minor,method,payment_outcome,service_type,order_note,status,source,kiosk_device_id,kiosk_name,payment_reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id',[businessId,branchId,guestId,key,JSON.stringify(lines),totalCents,currency,rate,totalMinor,input.method,extra.paymentOutcome,extra.serviceType,extra.orderNote,status,input.source,device?.id||null,device?.name||null,pay.reference||null])).rows[0];
   return{orderId:row.id,status,totalCents};
  });
 }
 case 'confirmCash':case 'cancelCash':{
  const{businessId,branchId}=scope(input);authorize(actor,['cashier','business_admin','super_admin'],businessId,branchId);const orderId=required(input.orderId,'order ID');return transaction(async c=>{
   const order=(await c.query('SELECT * FROM orders WHERE id=$1 AND business_id=$2 AND branch_id=$3 FOR UPDATE',[orderId,businessId,branchId])).rows[0];assert(order?.status==='pending_cash'&&order.method==='cash',409,'Not a pending cash order');
   if(name==='confirmCash'){
    const sorted=[...order.items].sort((a,b)=>(a.productId+a.variantId).localeCompare(b.productId+b.variantId));for(const i of sorted){const r=(await c.query('SELECT quantity FROM inventory WHERE business_id=$1 AND branch_id=$2 AND product_id=$3 AND variant_id=$4 FOR UPDATE',[businessId,branchId,i.productId,i.variantId])).rows[0];assert(r?.quantity>=i.quantity,409,`${i.name} out of stock`)}
    for(const i of sorted)await c.query('UPDATE inventory SET quantity=quantity-$1,updated_at=now() WHERE business_id=$2 AND branch_id=$3 AND product_id=$4 AND variant_id=$5',[i.quantity,businessId,branchId,i.productId,i.variantId]);
   }
   await c.query('UPDATE orders SET status=$1,handled_by=$2,updated_at=now() WHERE id=$3',[name==='confirmCash'?'paid':'cancelled',actor.id,orderId]);await c.query('INSERT INTO audit_logs(business_id,actor_id,action,details) VALUES($1,$2,$3,$4)',[businessId,actor.id,name==='confirmCash'?'order.cash_confirmed':'order.cash_cancelled',JSON.stringify({orderId})]);return{ok:true};
  });
 }
  case 'refundOrder':case 'voidOrder':{
   const{businessId,branchId}=scope(input);authorize(actor,['cashier','business_admin','super_admin'],businessId,branchId);
   const orderId=required(input.orderId,'order ID');const reason=required(input.reason,'reason',500);
   const reversal=name==='refundOrder'?'refunded':'voided';
   return transaction(async c=>{
    const order=(await c.query('SELECT * FROM orders WHERE id=$1 AND business_id=$2 AND branch_id=$3 FOR UPDATE',[orderId,businessId,branchId])).rows[0];
    assert(order,404,'Order not found');
    assert(order.status==='paid'||(name==='voidOrder'&&order.status==='pending_cash'),409,'Only a paid sale or pending cash sale can be reversed');
    for(const item of order.items.filter(()=>order.status==='paid')){
     await c.query('INSERT INTO inventory(business_id,branch_id,product_id,variant_id,quantity) VALUES($1,$2,$3,$4,$5) ON CONFLICT(business_id,branch_id,product_id,variant_id) DO UPDATE SET quantity=inventory.quantity+$5::int,updated_at=now()',[businessId,branchId,item.productId,item.variantId,item.quantity]);
    }
    await c.query("UPDATE orders SET status=$1,adjustment_reason=$2,adjusted_by=$3,adjusted_at=now(),updated_at=now() WHERE id=$4",[reversal,reason,actor.id,orderId]);
    await c.query('INSERT INTO audit_logs(business_id,actor_id,action,details) VALUES($1,$2,$3,$4)',[businessId,actor.id,`order.${name==='refundOrder'?'refunded':'voided'}`,JSON.stringify({orderId,type:name==='refundOrder'?'refund':'void',reason,stockRestored:name==='voidOrder'&&order.status==='pending_cash'?0:order.items.map(i=>({productId:i.productId,variantId:i.variantId,quantity:i.quantity}))})]);
    return{ok:true,status:reversal};
   });
  }
  case 'updateFulfillment':{
  // Kitchen display and Cashier station share this one endpoint; the role rules live in helpers.canAdvance().
  const{businessId,branchId}=scope(input);authorize(actor,['cashier','kitchen','business_admin','super_admin'],businessId,branchId);
  const b=await one('SELECT profile FROM businesses WHERE id=$1',[businessId]);assert(b&&b.profile!=='grocery',409,'Only food and fashion use fulfillment');
  const orderId=required(input.orderId,'order ID');const order=await one("SELECT fulfillment FROM orders WHERE id=$1 AND business_id=$2 AND branch_id=$3 AND status='paid'",[orderId,businessId,branchId]);assert(order,404,'Paid order not found');
  const target=input.fulfillment;assert(NEXT_FULFILLMENT[order.fulfillment]===target,409,'Invalid order status transition');
  assert(canAdvance(b.profile,actor.role,order.fulfillment,target),403,actor.role==='kitchen'?'The kitchen cannot hand over orders — the Cashier station does that':'Your role cannot perform this step for this store type');
  const r=await sql("UPDATE orders SET fulfillment=$1,handled_by=$2,updated_at=now() WHERE id=$3 AND fulfillment=$4 RETURNING id",[target,actor.id,orderId,order.fulfillment]);assert(r.rowCount,409,'Order was updated by another station — refresh');
  await audit(businessId,actor.id,'order.fulfillment',{orderId,from:order.fulfillment,to:target,station:actor.role});return{ok:true};
 }
 case 'verifyExit':{
  const{businessId,branchId}=scope(input);authorize(actor,['cashier','business_admin','super_admin'],businessId,branchId);const b=await one('SELECT profile FROM businesses WHERE id=$1',[businessId]);assert(b?.profile==='grocery',409,'Only grocery supports exit verification');const orderId=required(input.orderId,'order ID');
  const r=await sql("UPDATE orders SET exit_verified=true,updated_at=now() WHERE id=$1 AND business_id=$2 AND branch_id=$3 AND status='paid' AND exit_verified=false RETURNING id",[orderId,businessId,branchId]);if(!r.rowCount){const old=await one('SELECT exit_verified FROM orders WHERE id=$1 AND business_id=$2 AND branch_id=$3 AND status=$4',[orderId,businessId,branchId,'paid']);if(old?.exit_verified){await sql("INSERT INTO flags(business_id,branch_id,order_id,type,detected_by) VALUES($1,$2,$3,'duplicate_receipt',$4)",[businessId,branchId,orderId,actor.id]);throw new HttpError(409,'Receipt already verified — duplicate flagged')}throw new HttpError(409,'Paid receipt not found')}return{ok:true};
 }
 case 'saveShoppingSession':{
  const{businessId,branchId}=scope(input);const items=input.items?.length?cartItems(input.items):[];const status=input.status==='completed'?'completed':'shopping';const id=`${guestId}_${branchId}`;
  await sql('INSERT INTO shopping_sessions(id,business_id,branch_id,customer_uid,items,count,status) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET items=$5,count=$6,status=$7,updated_at=now()',[id,businessId,branchId,guestId,JSON.stringify(items),items.reduce((sum,x)=>sum+x.quantity,0),status]);return{ok:true};
 }
 case 'logReceiptPrint':{
  const{businessId,branchId}=scope(input);const id=required(input.orderId,'order ID');const o=await one('SELECT customer_uid,status FROM orders WHERE id=$1 AND business_id=$2 AND branch_id=$3',[id,businessId,branchId]);assert(o?.status==='paid',409,'Paid receipt not found');if(o.customer_uid!==guestId)authorize(actor,['cashier','business_admin','super_admin'],businessId,branchId);await sql('UPDATE orders SET reprints=reprints+1 WHERE id=$1',[id]);return{ok:true};
 }
 case 'finishPasswordSetup':{
  assert(actor&&actor.must_change_password,409,'Password setup not required');const password=strongPassword(input.newPassword);
  const me=await one('SELECT password_hash FROM staff WHERE id=$1',[actor.id]);assert(!(await bcrypt.compare(password,me.password_hash)),400,'Choose a password different from the temporary one');
  await sql('UPDATE staff SET password_hash=$1,must_change_password=false WHERE id=$2',[await bcrypt.hash(password,12),actor.id]);await sql('DELETE FROM sessions WHERE user_id=$1',[actor.id]);await audit(actor.business_id,actor.id,'staff.password_changed',{uid:actor.id,firstLogin:true});return{ok:true};
 }
 default:throw new HttpError(404,`Unknown backend operation: ${name}`);
 }
}
