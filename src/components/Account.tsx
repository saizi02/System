import {useState} from 'react';
import {KeyRound,ShieldCheck,X} from 'lucide-react';
import {call} from '../lib/api';
import {useSession} from '../lib/auth';
import {roleLabel} from '../lib/types';
import {passwordOk} from '../lib/password';
import PasswordField from './PasswordField';
/** "Change my password" form, used inside the Admin console and the station account dialog. */
export function ChangeOwnPassword({onDone}:{onDone?:()=>void}){
 const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[ok,setOk]=useState(false),[busy,setBusy]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');setOk(false);
  if(!passwordOk(next)){setError('The new password does not meet all requirements');return}
  if(next!==confirm){setError('The new passwords do not match');return}
  setBusy(true);try{await call('changeOwnPassword',{currentPassword:current,newPassword:next});setOk(true);setCurrent('');setNext('');setConfirm('');onDone?.()}catch(ex){setError((ex as Error).message)}finally{setBusy(false)}};
 return <form className="account-form" onSubmit={e=>void submit(e)}>
  <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" showRules={false}/>
  <PasswordField label="New password" value={next} onChange={setNext}/>
  <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} showRules={false}/>
  {error&&<p className="error" role="alert">{error}</p>}{ok&&<p className="success-toast" role="status">Password updated. Your other signed-in devices were signed out.</p>}
  <button className="btn btn-primary" disabled={busy}><KeyRound size={16}/> {busy?'Saving…':'Update password'}</button>
 </form>;
}
export function AccountDialog({onClose}:{onClose:()=>void}){
 const me=useSession();
 return <div className="dialog-overlay" role="presentation" onClick={onClose}><section className="dialog-sheet" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={e=>e.stopPropagation()}>
  <button className="dialog-close" onClick={onClose} aria-label="Close"><X size={18}/></button>
  <span className="eyebrow">MY ACCOUNT</span><h2 id="account-title">{me.user?.displayName||me.user?.email}</h2>
  <p className="muted account-meta"><ShieldCheck size={15}/> {me.role?roleLabel[me.role]:''} · {me.user?.email}</p>
  <h3>Change password</h3><ChangeOwnPassword/>
 </section></div>;
}
