import type {Order} from './types';
import {timestamp} from './types';
const esc=(s:string)=>s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
/** Browser printing to a configured 80 mm thermal printer; no privileged hardware access. */
export function printKitchenTicket(order:Order,shopName:string){
 if(order.status!=='paid')return;
 const win=window.open('','_blank','width=400,height=650');
 if(!win){window.alert('Allow popups for the kitchen ticket print dialog.');return}
 const items=order.items.map(i=>`<div class="item"><b>${i.quantity} × ${esc(i.name)}</b><small>${esc(i.variantName)}</small></div>`).join('');
 const orderNumber=order.payNumber||order.id.slice(-7).toUpperCase();
 win.document.write(`<!doctype html><html><head><title>Order ${esc(orderNumber)}</title><style>
 @page{size:80mm auto;margin:3mm}body{width:72mm;margin:0 auto;padding:5mm 0;font:14px monospace;color:#111}h1{text-align:center;font-size:17px;margin:0}h2{text-align:center;font-size:24px}p{text-align:center;font-size:12px}hr{border:0;border-top:1px dashed #555;margin:15px 0}.item{padding:7px 0;border-bottom:1px dashed #aaa}.item small{display:block;padding:3px 0}footer{text-align:center;font-weight:bold;margin:15px 0}
 </style></head><body><h1>${esc(shopName)}</h1><p>FOOD PREPARATION TICKET</p><h2>#${esc(orderNumber)}</h2><p>${esc(timestamp(order.createdAt))}</p><p>${order.serviceType==='dine_in'?'DINE IN':'TAKEAWAY'}</p><hr/>${items}${order.orderNote?`<hr/><p>NOTES: ${esc(order.orderNote)}</p>`:''}<hr/><footer>ORDER PAID</footer><script>window.addEventListener('load',()=>window.print())</script></body></html>`);
 win.document.close();
}
