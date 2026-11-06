import {useMemo,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {LogOut,ScanLine,ShieldCheck} from 'lucide-react';
import {listResource,detailResource} from '../lib/resources';
import {useSession} from '../lib/auth';
import {useDoc,useLive} from '../lib/live';
import {call} from '../lib/api';
import {Brand,LiveBadge} from '../components/UI';
import {Scanner} from './Scanner';
import type {Branch,Business} from '../lib/types';

export default function ExitVerifier(){
 const me=useSession(),go=useNavigate();
 const [receiptId,setReceiptId]=useState(''),[camera,setCamera]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const storeRef=useMemo(()=>me.businessId?detailResource('businesses',me.businessId):null,[me.businessId]);
 const {value:store}=useDoc<Business>(storeRef,[me.businessId]);
 const branchesRef=useMemo(()=>me.businessId?listResource('businesses',me.businessId,'branches'):null,[me.businessId]);
 const {items:branches}=useLive<Branch>(branchesRef,[me.businessId]);
 const branchId=me.branchId||branches[0]?.id||'';

 const verify=async()=>{
  if(!me.businessId||!branchId||!receiptId.trim())return;
  setBusy(true);setError('');setSuccess('');
  try{
   await call('verifyExit',{businessId:me.businessId,branchId,orderId:receiptId.trim()});
   setSuccess('Receipt verified — customer may exit.');
   setReceiptId('');
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 };

 return <div className="kds">
  <header className="kds-bar"><div className="kds-id"><Brand/><span className="kds-title"><ShieldCheck size={19}/> EXIT VERIFICATION</span></div>
   <div className="kds-where"><b>{store?.name||'—'}</b><span>{branches.find(b=>b.id===branchId)?.name||'—'}</span></div>
   <div className="kds-tools"><LiveBadge synced={null}/><button className="kds-btn" onClick={()=>void me.logout().then(()=>go('/exit-verifier'))}><LogOut size={16}/> Sign out</button></div>
  </header>
  <main className="verify-station">
   <section className="verify-station-card">
    <div className="verify-station-icon"><ScanLine size={42}/></div>
    <h1>Verify grocery purchase</h1>
    <p>Scan the receipt QR or enter the transaction ID.</p>
    <label className="field">Receipt transaction ID<input value={receiptId} onChange={e=>setReceiptId(e.target.value.trim())} placeholder="Paste or scan order ID" autoFocus/></label>
    <div className="form-actions"><button type="button" className="btn btn-outline" onClick={()=>setCamera(v=>!v)}>{camera?'Close camera':'Use camera'}</button><button type="button" className="btn btn-primary" disabled={busy||!receiptId.trim()} onClick={()=>void verify()}>{busy?'Verifying…':'Verify purchase'}</button></div>
    {camera&&<Scanner caption="Scan the receipt QR" onScan={value=>{setReceiptId(value);setCamera(false)}}/>}
    {error&&<p className="error" role="alert">{error}</p>}
    {success&&<p className="success-toast" role="status">{success}</p>}
   </section>
  </main>
 </div>;
}
