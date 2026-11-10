import {randomBytes} from 'node:crypto';
import {config} from './config.js';
import {HttpError} from './helpers.js';
import {normalizePhone} from './paynow.js';
/** Payment provider interface.
 *  authorize({method,amountMinor,currency,orderRef,demoOutcome}) -> {outcome:'approved'|'declined'|'pending',reference}
 *    'pending' means a person must confirm it (cash at the cashier).
 *  To add a real gateway (Paynow, EcoCash API, a card-terminal bridge): add an entry to `providers`, set PAYMENT_PROVIDER=<name>.
 *  Keep secrets in environment variables, never in the browser. */
const simulated={
 name:'simulated',
 methods:['cash','ecocash','card','bank'],
 async authorize({method,demoOutcome}){
  if(method==='cash')return{outcome:'pending',reference:null};
  return{outcome:demoOutcome==='declined'?'declined':'approved',reference:'SIM-'+randomBytes(5).toString('hex').toUpperCase()}
 }
};
/** Paynow Zimbabwe. EcoCash/OneMoney prompt the customer's phone; card goes through Paynow's secure page.
 *  'awaiting' means the order is saved first and Paynow is asked to start the payment (see paynowOrders.js). */
const paynow={
 name:'paynow',
 methods:['cash','ecocash','onemoney','card'],
 async authorize({method,currency,phone}){
  if(method==='cash')return{outcome:'pending',reference:null};
  if(currency!==config.paynow.currency)throw new HttpError(409,`Online payments are taken in ${config.paynow.currency}. Please switch the currency to ${config.paynow.currency}, or choose cash.`);
  if((method==='ecocash'||method==='onemoney')&&!normalizePhone(method,phone))throw new HttpError(400,method==='ecocash'?'Enter a valid EcoCash number, for example 0771234567.':'Enter a valid OneMoney number, for example 0712345678.');
  return{outcome:'awaiting',reference:null};
 }
};
const cashOnly={name:'cash-only',methods:['cash'],async authorize(){return{outcome:'pending',reference:null}}};
export const providers={simulated,paynow,'cash-only':cashOnly};
export function getProvider(){
 const p=providers[config.paymentProvider];if(!p)throw Error(`Unknown PAYMENT_PROVIDER "${config.paymentProvider}". Available: ${Object.keys(providers).join(', ')}`);
 return p.name==='simulated'&&!config.allowSimulatedPayments?cashOnly:p
}
export const enabledMethods=()=>getProvider().methods;
export async function authorizePayment(args){
 const p=getProvider();
 if(!p.methods.includes(args.method))throw new HttpError(409,'That payment method is not enabled for this store. Please choose cash and pay at the cashier.');
 return p.authorize(args)
}
