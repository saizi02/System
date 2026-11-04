import {useState} from 'react';
import {Delete,X} from 'lucide-react';
/** On-screen number pad so a shopper can key in a barcode that will not scan (damaged label, scanner offline). */
export default function KioskKeypad({onSubmit,onClose}:{onSubmit:(code:string)=>boolean;onClose:()=>void}){
 const[code,setCode]=useState(''),[bad,setBad]=useState(false);
 const press=(d:string)=>{setBad(false);setCode(c=>(c+d).slice(0,20))};
 const submit=()=>{if(code.length<4){setBad(true);return}if(onSubmit(code)){onClose()}else setBad(true)};
 return <div className="scanner-panel-backdrop" role="dialog" aria-modal="true" aria-label="Type a barcode"><section className="scanner-panel keypad">
  <header><div><h2>Type the barcode</h2><p>Enter the number printed under the barcode.</p></div><button type="button" className="scan-round dark" onClick={onClose} aria-label="Close"><X size={20}/></button></header>
  <output className={'keypad-display'+(bad?' bad':'')} aria-live="polite">{code||'•••• ••••'}</output>
  {bad&&<p className="error" role="alert">That barcode was not found. Check the number and try again.</p>}
  <div className="keypad-grid">{['1','2','3','4','5','6','7','8','9'].map(d=><button type="button" key={d} onClick={()=>press(d)}>{d}</button>)}<button type="button" className="alt" onClick={()=>{setCode(c=>c.slice(0,-1));setBad(false)}} aria-label="Delete"><Delete size={24}/></button><button type="button" onClick={()=>press('0')}>0</button><button type="button" className="go" onClick={submit}>Add</button></div>
 </section></div>
}
