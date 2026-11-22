import {Buffer} from 'node:buffer';
import {config} from './config.js';
import {HttpError} from './helpers.js';
import {normalizePhone} from './paynow.js';

const ENDPOINT='/transactions/amount/';

export class EcoCashError extends HttpError{
 constructor(status,message,definitive){super(status,message);this.definitive=definitive}
}

export const ecoCashEndUserId=phone=>{
 const normalized=normalizePhone('ecocash',phone);
 return normalized?normalized.slice(1):null;
};

export function verdictOf(response,{lookup=false}={}){
 const code=String(response?.responseCode||'').trim();
 if(lookup&&code==='888803')return'pending';
 const status=String(response?.transactionOperationStatus||'').trim().toLowerCase();
 if(code==='00'&&status==='charged')return'paid';
 if(['failed','declined','rejected','cancelled','canceled','refunded','reversed'].includes(status))return'failed';
 return'pending';
}

export function createEcoCashClient({
 username=config.ecocash.username,
 password=config.ecocash.password,
 merchantCode=config.ecocash.merchantCode,
 merchantPin=config.ecocash.merchantPin,
 merchantNumber=config.ecocash.merchantNumber,
 terminalId=config.ecocash.terminalId,
 location=config.ecocash.location,
 merchantName=config.ecocash.merchantName,
 superMerchantName=config.ecocash.superMerchantName,
 currency=config.ecocash.currency,
 base=config.ecocash.apiBaseUrl,
 fetchImpl=globalThis.fetch,
 timeoutMs=15000
}={}){
 const authorization=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
 const request=async(url,{method='GET',body,allowLookupNotFound=false}={})=>{
  let response;
  try{
   response=await fetchImpl(url,{method,headers:{authorization,accept:'application/json',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeoutMs)});
  }catch{
   throw new EcoCashError(502,'EcoCash did not confirm the request. The system will check its status before releasing the order.',false);
  }
  let data;
  try{data=await response.json()}catch{data=null}
  if(allowLookupNotFound&&String(data?.responseCode)==='888803')return data;
  if(!response.ok){
   const code=data?.responseCode?` (${String(data.responseCode).slice(0,30)})`:'';
   if(response.status>=500||response.status===408)throw new EcoCashError(502,'EcoCash did not confirm the request. The system will check its status before releasing the order.',false);
   const message=response.status===401
    ?'EcoCash sandbox credentials were rejected. Check the server configuration.'
    :response.status===422
     ?`EcoCash declined this payment${code}.`
     :`EcoCash rejected the payment request${code}. Check the merchant setup and whitelisted test number.`;
   throw new EcoCashError(502,message,true);
  }
  if(!data||typeof data!=='object')throw new EcoCashError(502,'EcoCash returned an unreadable response. The system will check the transaction status.',false);
  return data;
 };
 const checkCorrelator=(data,correlator)=>{
  if(String(data.clientCorrelator||'')!==String(correlator))
   throw new EcoCashError(502,'EcoCash returned a different transaction reference. The system will check the correct order status.',false);
 };
 return{
  async charge({clientCorrelator,referenceCode,phone,amountMinor,currency:orderCurrency}){
   const endUserId=ecoCashEndUserId(phone);
   if(!endUserId)throw new EcoCashError(400,'Enter a valid EcoCash number.',true);
   const data=await request(`${base}${ENDPOINT}`,{
    method:'POST',
    body:{
     clientCorrelator:String(clientCorrelator),
     referenceCode:String(referenceCode),
     tranType:'MER',
     endUserId,
     paymentAmount:{
      charginginformation:{
       amount:Number((amountMinor/100).toFixed(2)),
       currency:(orderCurrency||currency)==='ZIG'?'ZWG':orderCurrency||currency,
       description:'Till payment'
      },
      chargeMetaData:{channel:'WEB',purchaseCategoryCode:'Online Payment',onBeHalfOf:'ECOCASH'}
     },
     merchantCode,merchantPin,merchantNumber,countryCode:'ZW',terminalID:terminalId,location,
     superMerchantName,merchantName
    }
   });
   checkCorrelator(data,clientCorrelator);
   return{verdict:verdictOf(data),ecocashReference:data.ecocashReference||null};
  },
  async lookup({clientCorrelator,phone}){
   const endUserId=ecoCashEndUserId(phone);
   if(!endUserId)throw new EcoCashError(400,'The pending EcoCash customer number is invalid.',true);
   const data=await request(`${base}/${encodeURIComponent(endUserId)}/transactions/amount/${encodeURIComponent(String(clientCorrelator))}`,{allowLookupNotFound:true});
   if(String(data.responseCode)==='888803')return{verdict:'pending',ecocashReference:null};
   checkCorrelator(data,clientCorrelator);
   return{verdict:verdictOf(data,{lookup:true}),ecocashReference:data.ecocashReference||null};
  }
 };
}
