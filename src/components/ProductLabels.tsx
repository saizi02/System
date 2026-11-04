import {useEffect} from 'react';
import {createPortal} from 'react-dom';
import {QRCodeSVG} from 'qrcode.react';
import {Printer,X} from 'lucide-react';
import {productLink} from '../lib/scan';import {ean13Modules} from '../lib/barcode';
import {money,type Product} from '../lib/types';
/** Printable shelf labels. Each QR opens the store on the shopper's phone with that product already in the cart. */
export default function ProductLabels({products,businessId,branchId,storeName,onClose}:{products:Product[];businessId:string;branchId:string;storeName:string;onClose:()=>void}){
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',k);document.body.classList.add('printing-labels');return()=>{window.removeEventListener('keydown',k);document.body.classList.remove('printing-labels')}},[onClose]);
 return createPortal(<div className="label-overlay" role="dialog" aria-modal="true" aria-label="Product QR labels">
  <div className="label-bar"><div><strong>{products.length===1?'Product QR label':`${products.length} product QR labels`}</strong><small>Shoppers scan with their phone camera and the item is added to their cart.</small></div><div className="label-bar-actions"><button className="btn btn-primary" onClick={()=>window.print()}><Printer size={16}/> Print</button><button className="btn btn-outline" onClick={onClose}><X size={16}/> Close</button></div></div>
  <div className="label-sheet">{products.map(p=><figure className="label-card" key={p.id}><QRCodeSVG value={productLink(window.location.origin,businessId,branchId,p.id)} size={150} level="M" includeMargin/><figcaption><strong>{p.name}</strong><span>{money(p.priceCents)}</span><Bars code={p.barcode||''}/><small>{storeName} · Scan to add</small></figcaption></figure>)}</div>
 </div>,document.body)
}

/** Printed EAN-13 bars so a laser or imager scanner at the kiosk can read in-store labels. */
function Bars({code}:{code:string}){
 const m=ean13Modules(code);if(!m)return code?<code>{code}</code>:null;
 const w=95+18;let x=9;const rects:JSX.Element[]=[];
 for(let i=0;i<m.length;){if(m[i]==='1'){let j=i;while(m[j]==='1')j++;rects.push(<rect key={i} x={x+i} y={0} width={j-i} height={46} />);i=j}else i++}
 return <svg className="label-bars" viewBox={`0 0 ${w} 58`} role="img" aria-label={`EAN-13 barcode ${code}`}><rect width={w} height="58" fill="#fff"/>{rects}<text x={w/2} y="56" textAnchor="middle" fontSize="9" fontFamily="monospace">{code}</text></svg>
}
