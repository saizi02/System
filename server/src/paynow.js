import {createHash,timingSafeEqual} from 'node:crypto';
import {config} from './config.js';
import {HttpError} from './helpers.js';
/** Paynow Zimbabwe client. Every message is signed with SHA-512 over the field values (in message order) plus the integration key.
 *  Docs: https://developers.paynow.co.zw/docs/ . The integration key never leaves the server. */
const BASE='https://www.paynow.co.zw';
export const makeHash=(values,key)=>createHash('sha512').update(values.join('')+key,'utf8').digest('hex').toUpperCase();
const safeEqual=(a,b)=>{const x=Buffer.from(String(a).toUpperCase()),y=Buffer.from(String(b).toUpperCase());return x.length===y.length&&timingSafeEqual(x,y)};
/** Parse a URL-encoded Paynow message. Returns the lower-cased fields and whether the hash is valid for `key`. */
export function parseMessage(source,key){
 const pairs=typeof source==='string'?[...new URLSearchParams(source)]:Object.entries(source||{}).map(([k,v])=>[k,Array.isArray(v)?v[0]:String(v)]);
 const fields={};let hash='';const values=[];
 for(const [k,v] of pairs){const name=k.toLowerCase();if(name==='hash'){hash=v;continue}fields[name]=v;values.push(v)}
 return{fields,hash,valid:!!hash&&!!key&&safeEqual(makeHash(values,key),hash)};
}
/** Zimbabwean mobile numbers: EcoCash is Econet (077/078), OneMoney is NetOne (071). Accepts 0771234567, +263771234567, 263 77 123 4567. */
export function normalizePhone(method,input){
 let d=String(input||'').replace(/[\s()-]/g,'');
 if(d.startsWith('+263'))d='0'+d.slice(4);else if(d.startsWith('263'))d='0'+d.slice(3);
 const ok=method==='ecocash'?/^07[78]\d{7}$/.test(d):method==='onemoney'?/^071\d{7}$/.test(d):false;
 return ok?d:null;
}
/** Maps Paynow's status text to what the till needs: paid, failed (stop waiting) or pending (keep waiting). */
export function verdictOf(status){
 const s=String(status||'').trim().toLowerCase();
 if(['paid','awaiting delivery','delivered'].includes(s))return'paid';
 if(['cancelled','failed','refunded'].includes(s))return'failed';
 return'pending';
}
const trustedPollUrl=u=>{try{const x=new URL(u);return x.protocol==='https:'&&(x.hostname==='paynow.co.zw'||x.hostname.endsWith('.paynow.co.zw'))}catch{return false}};
export const isTrustedPollUrl=trustedPollUrl;
export function createClient({id=config.paynow.id,key=config.paynow.key,authEmail=config.paynow.authEmail,mode=config.paynow.mode,fetchImpl=globalThis.fetch,base=BASE,timeoutMs=15000}={}){
 const send=async(url,fields)=>{
  const body=fields?new URLSearchParams({...fields,hash:makeHash(Object.values(fields).map(String),key)}).toString():'';
  let res,text;
  try{res=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(timeoutMs)});text=await res.text()}
  catch{throw new HttpError(502,'The payment service could not be reached. Please try again in a moment.')}
  if(!res.ok)throw new HttpError(502,'The payment service is not available right now. Please try again.');
  const msg=parseMessage(text,key);
  if(msg.fields.status?.toLowerCase()==='error')throw new HttpError(502,`Payment was not started: ${msg.fields.error||'Paynow refused the request'}`);
  if(!msg.valid)throw new HttpError(502,'The payment service returned an invalid response. Nothing was charged.');
  return msg.fields;
 };
 const common=r=>({id,reference:r.reference,amount:Number(r.amountMinor/100).toFixed(2),additionalinfo:r.info||'',returnurl:r.returnUrl,resulturl:r.resultUrl});
 return{
  /** Card, Zimswitch and everything else: the customer is redirected to Paynow's page (browserUrl). */
  async initiate(r){
   const f={...common(r),...(mode==='test'?{authemail:authEmail}:{}),status:'Message'};
   const out=await send(`${base}/interface/initiatetransaction`,f);
   if(!out.browserurl||!out.pollurl)throw new HttpError(502,'Paynow did not return a payment page.');
   return{browserUrl:out.browserurl,pollUrl:out.pollurl};
  },
  /** EcoCash / OneMoney express checkout: Paynow prompts the customer's phone, no redirect. */
  async initiateMobile(r){
   const f={...common(r),authemail:authEmail,phone:r.phone,method:r.method,status:'Message'};
   const out=await send(`${base}/interface/remotetransaction`,f);
   if(!out.pollurl)throw new HttpError(502,'Paynow did not return a payment status address.');
   return{pollUrl:out.pollurl,instructions:out.instructions||'Check your phone and approve the payment with your PIN.'};
  },
  /** Ask Paynow for the current status. Only Paynow addresses are ever called. */
  async poll(pollUrl){
   if(!trustedPollUrl(pollUrl))throw new HttpError(502,'Refusing to poll an unknown address.');
   const out=await send(pollUrl,null);
   return{status:out.status||'',verdict:verdictOf(out.status),amount:out.amount!==undefined?Number(out.amount):null,paynowReference:out.paynowreference||null,reference:out.reference||null};
  }
 };
}
