import {useEffect,useState} from 'react';
import {CheckCircle2,CreditCard,Loader2,LockKeyhole,Smartphone,Wallet,X} from 'lucide-react';
import {money} from '../lib/types';
type Method='ecocash'|'onemoney'|'card'|'cash'|'bank';
const labels:Record<Method,string>={ecocash:'EcoCash',onemoney:'OneMoney',card:'Card (Visa, Mastercard, ZimSwitch)',cash:'Cash at the cashier',bank:'Bank transfer'};
/** Accepts 0771234567, +263771234567 or 263 77 123 4567; EcoCash is Econet (077/078), OneMoney is NetOne (071). Returns null when invalid. */
export function normalizeZwPhone(method:Method,input:string):string|null{
 let d=input.replace(/[\s()-]/g,'');
 if(d.startsWith('+263'))d='0'+d.slice(4);else if(d.startsWith('263'))d='0'+d.slice(3);
 const ok=method==='ecocash'?/^07[78]\d{7}$/.test(d):method==='onemoney'?/^071\d{7}$/.test(d):false;
 return ok?d:null;
}
type Props={method:Method;totalMinor:number;currency:string;storeName:string;busy:boolean;online:boolean;testMode:boolean;onClose:()=>void;onSubmit:(phone?:string)=>Promise<boolean>};
/** The real payment step: phone number for EcoCash / OneMoney, a redirect to Paynow for cards, a pending order for cash. */
export default function PaynowCheckout({method,totalMinor,currency,storeName,busy,online,testMode,onClose,onSubmit}:Props){
 const [phone,setPhone]=useState(''),[working,setWorking]=useState(false);
 const mobile=method==='ecocash'||method==='onemoney';
 const valid=!mobile||!!normalizeZwPhone(method,phone);
 const locked=busy||working;
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!locked)onClose()};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[locked,onClose]);
 const go=async()=>{
  if(locked||!online||!valid)return;
  setWorking(true);
  const ok=await onSubmit(mobile?normalizeZwPhone(method,phone)!:undefined).catch(()=>false);
  // On failure the shop page shows the reason, so close this sheet to reveal it.
  if(!ok)onClose();
  setWorking(false);
 };
 const Icon=mobile?Smartphone:method==='card'?CreditCard:Wallet;
 return <div className="pn-overlay" role="presentation">
  <section className="pn-sheet" role="dialog" aria-modal="true" aria-labelledby="pn-heading">
   <button className="pn-close" type="button" onClick={onClose} disabled={locked} aria-label="Close payment"><X size={18}/></button>
   <div className="pn-icon"><Icon size={26}/></div>
   <span className="eyebrow">{labels[method]}</span>
   <h2 id="pn-heading">{method==='cash'?'Pay at the cashier':'Pay '+money(totalMinor,currency)}</h2>
   <p className="muted">{storeName}</p>
   <div className="pn-amount"><span>Amount due</span><strong>{money(totalMinor,currency)}</strong></div>
   {testMode&&method!=='cash'&&<p className="pn-test" role="note">Paynow TEST MODE: no real money moves.{mobile?' Use 0771111111 to simulate a successful payment.':' Choose "TESTING: Faked Success" on the Paynow page.'}</p>}
   {mobile&&<label className="field">{labels[method]} number
    <input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={16} placeholder={method==='ecocash'?'0771234567':'0712345678'} aria-invalid={!!phone&&!valid}/>
    {!!phone&&!valid&&<small className="pn-bad">{method==='ecocash'?'Enter an Econet number starting 077 or 078.':'Enter a NetOne number starting 071.'}</small>}
   </label>}
   {mobile&&<p className="fineprint"><LockKeyhole size={12}/> You will get a prompt on your phone to enter your PIN. We never see your PIN.</p>}
   {method==='card'&&<p className="fineprint"><LockKeyhole size={12}/> You will be taken to Paynow's secure page to pay by card. Your card details are never entered on this site.</p>}
   {method==='cash'&&<p className="fineprint">Your order stays pending until the cashier confirms your cash. You will get a short number to give them.</p>}
   {!online&&<p className="error" role="alert">You are offline. Payment is unavailable until you reconnect.</p>}
   <button className="btn btn-primary btn-full" disabled={locked||!online||!valid} onClick={()=>void go()}>
    {working?<><Loader2 size={17} className="pn-spin"/> {mobile?'Sending request…':'Please wait…'}</>:<><CheckCircle2 size={17}/> {method==='cash'?'Create cash order':method==='card'?'Continue to Paynow':'Send payment request'}</>}
   </button>
   <button className="btn btn-outline btn-full" type="button" disabled={locked} onClick={onClose}>Cancel</button>
  </section>
 </div>
}
