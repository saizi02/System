import {useState} from 'react';
import {Check,Eye,EyeOff,Sparkles} from 'lucide-react';
import {generatePassword,passwordRules} from '../lib/password';
/** Password input with show/hide, live rule checklist and an optional "Generate" button. */
export default function PasswordField({label,value,onChange,autoComplete='new-password',showRules=true,allowGenerate=false,required=true}:{label:string;value:string;onChange:(v:string)=>void;autoComplete?:string;showRules?:boolean;allowGenerate?:boolean;required?:boolean}){
 const [visible,setVisible]=useState(false);
 return <div className="field password-field"><label>{label}
  <span className="password-input"><input type={visible?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} autoComplete={autoComplete} required={required} spellCheck={false}/>
   <button type="button" className="icon-toggle" onClick={()=>setVisible(v=>!v)} aria-label={visible?'Hide password':'Show password'}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></span></label>
  {allowGenerate&&<button type="button" className="smallbtn gen-btn" onClick={()=>{onChange(generatePassword());setVisible(true)}}><Sparkles size={13}/> Generate strong password</button>}
  {showRules&&value.length>0&&<ul className="rule-list" aria-live="polite">{passwordRules.map(r=><li key={r.id} className={r.test(value)?'ok':''}><Check size={12}/> {r.label}</li>)}</ul>}
 </div>;
}
