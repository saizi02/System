import test from 'node:test';
import assert from 'node:assert/strict';
import {createEcoCashClient,ecoCashEndUserId,verdictOf} from '../src/ecocash.js';

const settings={
 username:'sandbox-user',password:'sandbox-password',merchantCode:'001535',merchantPin:'0000',
 merchantNumber:'788732685',terminalId:'UAT00003',location:'Harare',
 merchantName:'UAT STORE 3',superMerchantName:'ECOCASH',currency:'USD',
 base:'https://sandbox.example/payment/v1'
};
const fakeFetch=handler=>async(url,init)=>handler(url,init);
const response=(data,{ok=true,status=200}={})=>({ok,status,json:async()=>data});

test('EcoCash accepts Zimbabwean mobile numbers and converts them to the API MSISDN form',()=>{
 assert.equal(ecoCashEndUserId('0771234567'),'771234567');
 assert.equal(ecoCashEndUserId('+263 78 123 4567'),'781234567');
 assert.equal(ecoCashEndUserId('0711234567'),null);
});

test('EcoCash charge uses Basic auth and the documented sandbox request shape',async()=>{
 let request;
 const client=createEcoCashClient({...settings,fetchImpl:fakeFetch((url,init)=>{
  request={url,init,body:JSON.parse(init.body)};
  return response({clientCorrelator:'order-1',ecocashReference:'EC-123',transactionOperationStatus:'Charged',responseCode:'00'});
 })});
 const result=await client.charge({clientCorrelator:'order-1',referenceCode:'SSTWAS_order-1',phone:'0771234567',amountMinor:1250,currency:'USD'});
 assert.equal(request.url,'https://sandbox.example/payment/v1/transactions/amount/');
 assert.equal(request.init.headers.authorization,`Basic ${Buffer.from('sandbox-user:sandbox-password').toString('base64')}`);
 assert.equal(request.body.endUserId,'771234567');
 assert.equal(request.body.paymentAmount.charginginformation.amount,12.5);
 assert.equal(request.body.paymentAmount.charginginformation.currency,'USD');
 assert.equal(request.body.merchantPin,'0000');
 assert.equal(result.verdict,'paid');
 assert.equal(result.ecocashReference,'EC-123');
});

test('EcoCash converts ZIG to ZWG and looks up pending transaction status',async()=>{
 const requests=[];
 const client=createEcoCashClient({...settings,fetchImpl:fakeFetch((url,init)=>{
  requests.push({url,init});
  return response({clientCorrelator:'order-2',ecocashReference:'EC-456',transactionOperationStatus:'Pending',responseCode:'01'});
 })});
 const charge=await client.charge({clientCorrelator:'order-2',referenceCode:'SSTWAS_order-2',phone:'0771234567',amountMinor:250,currency:'ZIG'});
 assert.equal(requests[0].init.body.includes('"currency":"ZWG"'),true);
 assert.equal(charge.verdict,'pending');
 const lookupClient=createEcoCashClient({...settings,fetchImpl:fakeFetch((url,init)=>{
  requests.push({url,init});
  return response({clientCorrelator:'order-3',transactionOperationStatus:'Processing',responseCode:'00'});
 })});
 const pending=await lookupClient.lookup({clientCorrelator:'order-3',phone:'0771234567'});
 assert.equal(requests[1].url,'https://sandbox.example/payment/v1/771234567/transactions/amount/order-3');
 assert.equal(pending.verdict,'pending');
});

test('EcoCash lookup treats not-found as pending, while declined charges are definitive',async()=>{
 const lookup=createEcoCashClient({...settings,fetchImpl:fakeFetch(()=>response({responseCode:'888803'},{ok:false,status:400}))});
 assert.equal((await lookup.lookup({clientCorrelator:'missing',phone:'0771234567'})).verdict,'pending');
 const declined=createEcoCashClient({...settings,fetchImpl:fakeFetch(()=>response({responseCode:'INSUFFICIENT_FUNDS'},{ok:false,status:422}))});
 await assert.rejects(declined.charge({clientCorrelator:'order-4',referenceCode:'TEST',phone:'0771234567',amountMinor:100,currency:'USD'}),error=>error.definitive===true);
});

test('only confirmed success/failure states settle; unknown states remain pending',()=>{
 assert.equal(verdictOf({responseCode:'00',transactionOperationStatus:'Charged'}),'paid');
 assert.equal(verdictOf({responseCode:'01',transactionOperationStatus:'Pending'}),'pending');
 assert.equal(verdictOf({responseCode:'00',transactionOperationStatus:'Processing'}),'pending');
 assert.equal(verdictOf({responseCode:'888803'},{lookup:true}),'pending');
});
