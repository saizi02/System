import {sql,transaction} from './db.js';
import {config,publicOrigin} from './config.js';
import {createClient,normalizePhone,parseMessage} from './paynow.js';
import {nextPayNumber} from './payNumber.js';
import {HttpError} from './helpers.js';
/** Order handling for Paynow payments. An order is created as 'awaiting_payment' with its stock reserved, then moves to
 *  'paid' (customer approved) or 'failed' (declined, cancelled or timed out; stock is returned).
 *  Paynow tells us through the result URL, and we always confirm by asking Paynow's poll address before changing an order. */
let client=null;
const paynow=()=>client||(client=createClient());
export const setClientForTests=c=>{client=c};
const origin=()=>(publicOrigin||'http://localhost:5173').split(',')[0].trim().replace(/\/$/,'');
const tag=(c,reason,ref)=>c.query("SELECT set_config('app.stock_reason',$1,true),set_config('app.stock_ref',$2,true),set_config('app.stock_actor','',true)",[reason,String(ref||'')]);
const mask=p=>p.length>=7?`${p.slice(0,3)}****${p.slice(-3)}`:'****';

/** Called right after the order is saved: ask Paynow to start the payment. On failure the order is cancelled and stock returned. */
export async function beginPayment({orderId},{method,phone}){
 const o=(await sql('SELECT id,business_id,branch_id,total_minor,currency FROM orders WHERE id=$1',[orderId])).rows[0];
 if(!o)throw new HttpError(404,'Order not found');
 const base={reference:o.id,amountMinor:o.total_minor,info:'Till payment',returnUrl:`${origin()}/receipt/${o.business_id}/${o.id}`,resultUrl:`${origin()}/api/payments/paynow/result`};
 try{
  let r,masked=null;
  if(method==='card')r=await paynow().initiate(base);
  else{const normalized=normalizePhone(method,phone);r=await paynow().initiateMobile({...base,phone:normalized,method});masked=mask(normalized)}
  const expires=new Date(Date.now()+config.paynow.expiryMinutes*60000);
  await sql('UPDATE orders SET poll_url=$2,browser_url=$3,payment_instructions=$4,payment_phone=$5,payment_expires_at=$6,payment_simulated=false,updated_at=now() WHERE id=$1',[o.id,r.pollUrl,r.browserUrl||null,r.instructions||null,masked,expires]);
  return{browserUrl:r.browserUrl||null,instructions:r.instructions||null};
 }catch(e){
  await settle(o.id,'failed');
  throw e instanceof HttpError?e:new HttpError(502,'The payment could not be started. Nothing was charged.');
 }
}

/** Move an awaiting order to paid or failed, once. Safe to call repeatedly and concurrently. */
export async function settle(orderId,verdict,{amount=null,paynowReference=null}={}){
 return transaction(async c=>{
  const o=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
  if(!o||o.status!=='awaiting_payment')return{changed:false,status:o?.status||null};
  if(verdict==='paid'){
   if(amount!==null&&Math.abs(amount-o.total_minor/100)>0.005){
    await c.query('UPDATE orders SET payment_checked_at=now() WHERE id=$1',[orderId]);
    await c.query('INSERT INTO audit_logs(business_id,actor_id,action,details) VALUES($1,NULL,$2,$3)',[o.business_id,'payment.amount_mismatch',JSON.stringify({orderId,expected:o.total_minor/100,reported:amount})]);
    return{changed:false,status:o.status};
   }
   const {payNumber,payDay}=await nextPayNumber(c,o.business_id,o.branch_id);
   await c.query("UPDATE orders SET status='paid',payment_outcome='approved',payment_simulated=false,payment_reference=COALESCE($2,payment_reference),pay_number=$3,pay_day=$4,payment_checked_at=now(),updated_at=now() WHERE id=$1",[orderId,paynowReference,payNumber,payDay]);
   await c.query('INSERT INTO audit_logs(business_id,actor_id,action,details) VALUES($1,NULL,$2,$3)',[o.business_id,'payment.paynow_paid',JSON.stringify({orderId,paynowReference,method:o.method})]);
   return{changed:true,status:'paid'};
  }
  const sorted=[...o.items].sort((a,b)=>(a.productId+a.variantId).localeCompare(b.productId+b.variantId));
  await tag(c,'payment_failed',orderId);
  for(const i of sorted)await c.query('UPDATE inventory SET quantity=quantity+$1,updated_at=now() WHERE business_id=$2 AND branch_id=$3 AND product_id=$4 AND variant_id=$5',[i.quantity,o.business_id,o.branch_id,i.productId,i.variantId]);
  await c.query("UPDATE orders SET status='failed',payment_outcome='declined',payment_checked_at=now(),updated_at=now() WHERE id=$1",[orderId]);
  await c.query('INSERT INTO audit_logs(business_id,actor_id,action,details) VALUES($1,NULL,$2,$3)',[o.business_id,'payment.paynow_failed',JSON.stringify({orderId,method:o.method})]);
  return{changed:true,status:'failed'};
 });
}

const lastPoll=new Map();
/** Ask Paynow where this order's payment stands and update the order. Throttled per order so Paynow is never hammered. */
export async function refreshOrder(orderId,{minGapMs=5000}={}){
 const o=(await sql('SELECT id,status,poll_url,payment_expires_at,created_at FROM orders WHERE id=$1',[orderId])).rows[0];
 if(!o)return null;
 if(o.status!=='awaiting_payment'){lastPoll.delete(orderId);return o.status}
 const now=Date.now();
 if(now-(lastPoll.get(orderId)||0)<minGapMs)return o.status;
 lastPoll.set(orderId,now);
 const expired=o.payment_expires_at?new Date(o.payment_expires_at).getTime()<now:now-new Date(o.created_at).getTime()>config.paynow.expiryMinutes*60000+120000;
 let verdict='pending',detail={};
 if(o.poll_url){
  try{const r=await paynow().poll(o.poll_url);verdict=r.verdict;detail={amount:r.amount,paynowReference:r.paynowReference}}
  catch(e){console.error(JSON.stringify({t:new Date().toISOString(),paynowPollError:e.message,orderId}))}
 }
 await sql('UPDATE orders SET payment_checked_at=now() WHERE id=$1 AND status=$2',[orderId,'awaiting_payment']).catch(()=>{});
 if(verdict==='pending'&&expired)verdict='failed';
 if(verdict==='pending')return'awaiting_payment';
 const r=await settle(orderId,verdict,detail);lastPoll.delete(orderId);
 return r.status;
}

/** Paynow's server-to-server notice. The signature is checked, then Paynow is asked directly before anything changes. */
export async function handleResult(body){
 const msg=parseMessage(body,config.paynow.key);
 if(!msg.valid)return{ok:false};
 const ref=String(msg.fields.reference||'');
 if(!/^[0-9a-f-]{36}$/i.test(ref))return{ok:true};
 await refreshOrder(ref,{minGapMs:0});
 return{ok:true};
}

/** Safety net: confirm and expire orders that are still waiting (customer closed the page, notice never arrived). */
export async function sweep(){
 const rows=(await sql("SELECT id FROM orders WHERE status='awaiting_payment' AND (payment_checked_at IS NULL OR payment_checked_at<now()-interval '25 seconds') ORDER BY created_at LIMIT 25")).rows;
 for(const r of rows)await refreshOrder(r.id,{minGapMs:20000}).catch(e=>console.error(JSON.stringify({t:new Date().toISOString(),sweepError:e.message,orderId:r.id})));
}
