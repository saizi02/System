import test from 'node:test';import assert from 'node:assert/strict';
import {makeHash,parseMessage,normalizePhone,verdictOf,createClient,isTrustedPollUrl} from '../src/paynow.js';
const KEY='3e9fed89-60e1-4ce5-ab6e-6b1eb2d4f977';
/** Builds a signed Paynow-style response, as Paynow would send it. */
const signed=fields=>new URLSearchParams({...fields,hash:makeHash(Object.values(fields),KEY)}).toString();
const fakeFetch=(handler)=>async(url,init)=>{const r=handler(url,init);return{ok:r.ok!==false,status:r.status||200,text:async()=>r.body}};

test("hash matches the example in Paynow's own documentation",()=>{
 const concatenated='Okhttps://staging.paynow.co.zw/Payment/ConfirmPayment/9510https://staging.paynow.co.zw/Interface/CheckPayment/?guid=c7ed41da-0159-46da-b428-69549f7704139510';
 assert.equal(makeHash([concatenated],KEY),'750DD0B0DF374678707BB5AF915AF81C228B9058AD57BB7120569EC68BBB9C2EFC1B26C6375D2BC562AC909B3CD6B2AF1D42E1A5E479FFAC8F4FB3FDCE71DF4D');
 assert.equal(makeHash([concatenated],KEY.toUpperCase()),makeHash([concatenated],KEY));
});
test('parseMessage accepts a correct signature and rejects a tampered one',()=>{
 const good=signed({status:'Paid',reference:'abc',amount:'5.00',paynowreference:'123'});
 const m=parseMessage(good,KEY);assert.equal(m.valid,true);assert.equal(m.fields.status,'Paid');
 assert.equal(parseMessage(good.replace('5.00','0.01'),KEY).valid,false);
 assert.equal(parseMessage(good,'another-key').valid,false);
 assert.equal(parseMessage('status=Paid&reference=abc',KEY).valid,false);
});
test('parseMessage reads a form body object in message order and ignores key casing',()=>{
 const values={Reference:'r1',Amount:'1.50',Status:'Paid'};
 const body={...values,Hash:makeHash(Object.values(values),KEY)};
 assert.equal(parseMessage(body,KEY).valid,true);
});
test('Zimbabwean phone numbers are normalised per network',()=>{
 assert.equal(normalizePhone('ecocash','0771234567'),'0771234567');
 assert.equal(normalizePhone('ecocash','+263 77 123 4567'),'0771234567');
 assert.equal(normalizePhone('ecocash','0781234567'),'0781234567');
 assert.equal(normalizePhone('ecocash','0711234567'),null);
 assert.equal(normalizePhone('onemoney','0711234567'),'0711234567');
 assert.equal(normalizePhone('onemoney','0771234567'),null);
 assert.equal(normalizePhone('card','0771234567'),null);
 assert.equal(normalizePhone('ecocash',''),null);
});
test('statuses map to paid, failed or keep waiting',()=>{
 for(const s of ['Paid','Awaiting Delivery','delivered'])assert.equal(verdictOf(s),'paid');
 for(const s of ['Cancelled','Failed','Refunded'])assert.equal(verdictOf(s),'failed');
 for(const s of ['Created','Sent','Disputed','',undefined])assert.equal(verdictOf(s),'pending');
});
test('only Paynow addresses may be polled',()=>{
 assert.equal(isTrustedPollUrl('https://www.paynow.co.zw/Interface/CheckPayment/?guid=1'),true);
 assert.equal(isTrustedPollUrl('https://staging.paynow.co.zw/x'),true);
 assert.equal(isTrustedPollUrl('http://www.paynow.co.zw/x'),false);
 assert.equal(isTrustedPollUrl('https://paynow.co.zw.evil.com/x'),false);
 assert.equal(isTrustedPollUrl('https://evil.com/?https://www.paynow.co.zw'),false);
 assert.equal(isTrustedPollUrl('not a url'),false);
});
const order={reference:'11111111-1111-1111-1111-111111111111',amountMinor:1250,info:'Till payment',returnUrl:'https://shop.example/receipt/b/o',resultUrl:'https://shop.example/api/payments/paynow/result'};
test('mobile payment sends a signed request with the right fields and reads the instructions',async()=>{
 let sent;
 const client=createClient({id:'1234',key:KEY,authEmail:'me@shop.co.zw',mode:'test',fetchImpl:fakeFetch((url,init)=>{sent={url,params:new URLSearchParams(init.body)};return{body:signed({status:'Ok',instructions:'Dial *151*2*2# to approve',pollurl:'https://www.paynow.co.zw/Interface/CheckPayment/?guid=abc'})}})});
 const r=await client.initiateMobile({...order,phone:'0771111111',method:'ecocash'});
 assert.equal(sent.url,'https://www.paynow.co.zw/interface/remotetransaction');
 assert.equal(sent.params.get('amount'),'12.50');assert.equal(sent.params.get('id'),'1234');assert.equal(sent.params.get('method'),'ecocash');assert.equal(sent.params.get('phone'),'0771111111');assert.equal(sent.params.get('authemail'),'me@shop.co.zw');assert.equal(sent.params.get('status'),'Message');
 assert.deepEqual([...sent.params.keys()],['resulturl','returnurl','reference','amount','id','additionalinfo','authemail','phone','method','status','hash']);
 assert.equal(sent.params.get('additionalinfo'),'Till%20payment');
 const entries=[...sent.params].filter(([k])=>k!=='hash');
 assert.equal(sent.params.get('hash'),makeHash(entries.map(([,v])=>v),KEY));
 assert.equal(r.pollUrl,'https://www.paynow.co.zw/Interface/CheckPayment/?guid=abc');assert.match(r.instructions,/approve/);
});
test('card payment returns the Paynow page address; live mode sends an empty merchant email',async()=>{
 let params;
 const client=createClient({id:'1234',key:KEY,authEmail:'me@shop.co.zw',mode:'live',fetchImpl:fakeFetch((url,init)=>{params=new URLSearchParams(init.body);return{body:signed({status:'Ok',browserurl:'https://www.paynow.co.zw/Payment/ConfirmPayment/9',pollurl:'https://www.paynow.co.zw/Interface/CheckPayment/?guid=z'})}})});
 const r=await client.initiate(order);
 assert.equal(r.browserUrl,'https://www.paynow.co.zw/Payment/ConfirmPayment/9');assert.equal(params.get('authemail'),'');
});
test('a Paynow error, a bad signature and an unreachable service all stop the payment',async()=>{
 const mk=h=>createClient({id:'1',key:KEY,authEmail:'a@b.co',fetchImpl:fakeFetch(h)});
 await assert.rejects(mk(()=>({body:'status=Error&error=Invalid+amount+field'})).initiate(order),/Invalid amount field/);
 await assert.rejects(mk(()=>({body:'status=Ok&browserurl=https%3A%2F%2Fwww.paynow.co.zw%2Fx&pollurl=https%3A%2F%2Fwww.paynow.co.zw%2Fy&hash=BAD'})).initiate(order),/invalid response/);
 await assert.rejects(mk(()=>({ok:false,status:500,body:''})).initiate(order),/not available/);
 await assert.rejects(createClient({id:'1',key:KEY,authEmail:'a@b.co',fetchImpl:async()=>{throw new Error('down')}}).initiate(order),/could not be reached/);
});
test('polling returns the verdict and amount, and refuses foreign addresses',async()=>{
 const client=createClient({id:'1',key:KEY,authEmail:'a@b.co',fetchImpl:fakeFetch(()=>({body:signed({reference:'r',paynowreference:'777',amount:'12.50',status:'Paid',pollurl:'https://www.paynow.co.zw/p'})}))});
 const r=await client.poll('https://www.paynow.co.zw/Interface/CheckPayment/?guid=abc');
 assert.equal(r.verdict,'paid');assert.equal(r.amount,12.5);assert.equal(r.paynowReference,'777');
 await assert.rejects(client.poll('https://evil.example/x'),/unknown address/);
});
