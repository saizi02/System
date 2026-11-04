import {useRef,type ReactNode} from 'react';
import {ScanLine} from 'lucide-react';
import {cleanCode} from '../lib/barcode';
/** Text input made for hardware scanners: Enter (sent by the scanner) never submits the surrounding form. */
export default function ScanField({label,value,onChange,onCode,placeholder,hint,autoFocus}:{label:string;value:string;onChange:(v:string)=>void;onCode?:(code:string)=>void;placeholder?:string;hint?:ReactNode;autoFocus?:boolean}){
 const ref=useRef<HTMLInputElement>(null);
 return <label className="field scan-field">{label}<span className="scan-field-box"><ScanLine size={18}/><input ref={ref} value={value} autoFocus={autoFocus} inputMode="numeric" autoComplete="off" placeholder={placeholder||'Click here, then scan the barcode'} onChange={e=>onChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();const c=cleanCode(value);onChange(c);if(c)onCode?.(c)}}}/></span>{hint&&<small className="muted">{hint}</small>}</label>
}
