import type {Order} from './types';
import {money,timestamp,type Business} from './types';
import {isAndroidPrinterAvailable,printBluetooth} from './nativePrinter';
const esc=(s:string)=>s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
const COLUMNS=32;
const wrap=(value:string,width=COLUMNS):string[]=>{
 const words=value.split(/\s+/),lines:string[]=[];let line='';
 for(let word of words){
  if(!word)continue;
  if(line&&line.length+word.length+1>width){lines.push(line);line=''}
  while(word.length>width){if(line)lines.push(line);lines.push(word.slice(0,width));word=word.slice(width)}
  line=line?`${line} ${word}`:word;
 }
 if(line)lines.push(line);
 return lines;
};
const centered=(value:string)=>wrap(value).map(line=>line.padStart(Math.floor((COLUMNS+line.length)/2)));
const divider='-'.repeat(COLUMNS);
const pair=(label:string,value:string)=>wrap(`${label}: ${value}`);
export function receiptPrintText(order:Order,business:Business|null|undefined,vatRate:number){
 const lines=[
  ...centered(business?.name||'Tillcore'),
  ...(business?.address?wrap(business.address):[]),
  ...(business?.phone?wrap(business.phone):[]),
  ...(business?.taxNumber?wrap(`Tax No: ${business.taxNumber}`):[]),
  ...centered('SELF-SERVICE CHECKOUT RECEIPT'),
  divider,
  ...pair('Order',order.payNumber||order.id),
  ...pair('Date',timestamp(order.createdAt)),
  ...pair('Payment',order.method.toUpperCase()),
  ...pair('Type',order.serviceType==='dine_in'?'Dine in':'Takeaway'),
  divider
 ];
 for(const item of order.items){
  lines.push(...wrap(`${item.quantity} x ${item.name}`));
  if(item.variantName&&item.variantName!=='Standard')lines.push(...wrap(item.variantName));
  lines.push(...wrap(`USD ${money(item.lineCents).replace(/^USD\s*/,'')}`));
 }
 const netCents=vatRate>0?Math.round(order.totalCents/(1+vatRate/100)):order.totalCents;
 const taxCents=order.totalCents-netCents;
 lines.push(divider,...pair('Net amount',money(netCents)));
 if(vatRate>0)lines.push(...pair(`Tax (${vatRate}%)`,money(taxCents)));
 lines.push(...pair('Total USD',money(order.totalCents)),...pair(`Total ${order.currency}`,money(order.totalMinor,order.currency)));
 lines.push(...pair('Rate',`1 USD = ${order.rate} ${order.currency}`));
 if(order.orderNote)lines.push(divider,...wrap(`NOTE: ${order.orderNote}`));
 lines.push(divider,...centered(business?.receiptFooter||'Thank you for shopping with us.'),'');
 return lines.join('\n');
}

function kitchenPrintText(order:Order,shopName:string){
 const lines=[
  ...centered(shopName),
  ...centered('FOOD PREPARATION TICKET'),
  ...centered(`#${order.payNumber||order.id.slice(-7).toUpperCase()}`),
  ...centered(timestamp(order.createdAt)),
  ...centered(order.serviceType==='dine_in'?'DINE IN':'TAKEAWAY'),
  divider
 ];
 for(const item of order.items){
  lines.push(...wrap(`${item.quantity} x ${item.name}`));
  if(item.variantName&&item.variantName!=='Standard')lines.push(...wrap(item.variantName));
 }
 if(order.orderNote)lines.push(divider,...wrap(`NOTES: ${order.orderNote}`));
 lines.push(divider,...centered('ORDER PAID'),'');
 return lines.join('\n');
}

/** Browser printing to a configured 80 mm thermal printer; no privileged hardware access. */
export async function printKitchenTicket(order:Order,shopName:string){
 if(order.status!=='paid')return;
 if(isAndroidPrinterAvailable()){
  try{await printBluetooth({text:kitchenPrintText(order,shopName),qrData:order.id})}
  catch(e){window.alert((e as Error).message)}
  return;
 }
 const win=window.open('','_blank','width=400,height=650');
 if(!win){window.alert('Allow popups for the kitchen ticket print dialog.');return}
 const items=order.items.map(i=>`<div class="item"><b>${i.quantity} × ${esc(i.name)}</b><small>${esc(i.variantName)}</small></div>`).join('');
 const orderNumber=order.payNumber||order.id.slice(-7).toUpperCase();
 win.document.write(`<!doctype html><html><head><title>Order ${esc(orderNumber)}</title><style>
 @page{size:80mm auto;margin:3mm}body{width:72mm;margin:0 auto;padding:5mm 0;font:14px monospace;color:#111}h1{text-align:center;font-size:17px;margin:0}h2{text-align:center;font-size:24px}p{text-align:center;font-size:12px}hr{border:0;border-top:1px dashed #555;margin:15px 0}.item{padding:7px 0;border-bottom:1px dashed #aaa}.item small{display:block;padding:3px 0}footer{text-align:center;font-weight:bold;margin:15px 0}
 </style></head><body><h1>${esc(shopName)}</h1><p>FOOD PREPARATION TICKET</p><h2>#${esc(orderNumber)}</h2><p>${esc(timestamp(order.createdAt))}</p><p>${order.serviceType==='dine_in'?'DINE IN':'TAKEAWAY'}</p><hr/>${items}${order.orderNote?`<hr/><p>NOTES: ${esc(order.orderNote)}</p>`:''}<hr/><footer>ORDER PAID</footer><script>window.addEventListener('load',()=>window.print())</script></body></html>`);
 win.document.close();
}
