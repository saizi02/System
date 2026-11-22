import {sql} from './db.js';
import {config} from './config.js';
import {HttpError} from './helpers.js';
import {settle} from './paynowOrders.js';
import {createEcoCashClient} from './ecocash.js';
import {normalizePhone} from './paynow.js';

let client=null;
const ecoCash=()=>client||(client=createEcoCashClient());
export const setEcoCashClientForTests=value=>{client=value};

/** Submit the charge after the order and stock reservation have committed. */
export async function beginEcoCashPayment({orderId},{phone}){
 const order=(await sql('SELECT id,total_minor,currency FROM orders WHERE id=$1',[orderId])).rows[0];
 if(!order)throw new HttpError(404,'Order not found');
 const normalized=normalizePhone('ecocash',phone);
 if(!normalized)throw new HttpError(400,'Enter a valid EcoCash number, for example 0771234567.');
 const expires=new Date(Date.now()+config.ecocash.expiryMinutes*60000);
 await sql('UPDATE orders SET payment_phone=$2,payment_instructions=$3,payment_expires_at=$4,payment_simulated=false,updated_at=now() WHERE id=$1',[order.id,normalized,'Check the EcoCash prompt on your phone. Do not submit this order again while payment is being checked.',expires]);
 let result;
 try{
  result=await ecoCash().charge({
   clientCorrelator:order.id,
   referenceCode:`SSTWAS_${order.id.replace(/-/g,'')}`,
   phone:normalized,
   amountMinor:order.total_minor,
   currency:order.currency
  });
 }catch(error){
  console.error(JSON.stringify({t:new Date().toISOString(),ecoCashStartError:error.message,orderId:order.id,status:error.status}));
  if(error.definitive){
   await settle(order.id,'failed',{provider:'ecocash'});
   throw error;
  }
  const instructions='EcoCash has not confirmed this request yet. The receipt will update automatically; please do not pay twice.';
  await sql('UPDATE orders SET payment_instructions=$2,updated_at=now() WHERE id=$1 AND status=$3',[order.id,instructions,'awaiting_payment']);
  return{status:'awaiting_payment',instructions};
 }
 if(result.verdict==='pending')return{status:'awaiting_payment'};
 const settled=await settle(order.id,result.verdict,{paymentReference:result.ecocashReference,provider:'ecocash'});
 return{status:settled.status};
}

const lastLookup=new Map();
/** Resolve a delayed EcoCash response without retrying its charge request. */
export async function refreshEcoCashOrder(orderId,{minGapMs=5000}={}){
 const order=(await sql('SELECT id,status,payment_phone,payment_expires_at,created_at FROM orders WHERE id=$1',[orderId])).rows[0];
 if(!order)return null;
 if(order.status!=='awaiting_payment'){lastLookup.delete(orderId);return order.status}
 const now=Date.now();
 if(now-(lastLookup.get(orderId)||0)<minGapMs)return order.status;
 lastLookup.set(orderId,now);
 const expired=order.payment_expires_at
  ?new Date(order.payment_expires_at).getTime()<now
  :now-new Date(order.created_at).getTime()>config.ecocash.expiryMinutes*60000+120000;
 let verdict='pending',paymentReference=null,lookupSucceeded=!order.payment_phone;
 if(order.payment_phone){
  try{
   const result=await ecoCash().lookup({clientCorrelator:order.id,phone:order.payment_phone});
   verdict=result.verdict;
   paymentReference=result.ecocashReference;
   lookupSucceeded=true;
  }catch(error){
   console.error(JSON.stringify({t:new Date().toISOString(),ecoCashLookupError:error.message,orderId:order.id,status:error.status}));
  }
 }
 await sql('UPDATE orders SET payment_checked_at=now() WHERE id=$1 AND status=$2',[order.id,'awaiting_payment']);
 if(verdict==='pending'&&expired&&lookupSucceeded)verdict='failed';
 if(verdict==='pending')return'awaiting_payment';
 const result=await settle(order.id,verdict,{paymentReference,provider:'ecocash'});
 lastLookup.delete(orderId);
 return result.status;
}

export async function sweepEcoCash(){
 const rows=(await sql("SELECT id FROM orders WHERE status='awaiting_payment' AND (payment_checked_at IS NULL OR payment_checked_at<now()-interval '25 seconds') ORDER BY created_at LIMIT 25")).rows;
 for(const row of rows)await refreshEcoCashOrder(row.id,{minGapMs:20000}).catch(error=>console.error(JSON.stringify({t:new Date().toISOString(),ecoCashSweepError:error.message,orderId:row.id})));
}
