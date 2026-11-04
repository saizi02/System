import {useMemo,useState} from 'react';
import {Copy,ExternalLink,Plus,RotateCcw,Tablet,Trash2,Wrench} from 'lucide-react';
import {QRCodeSVG} from 'qrcode.react';
import {listResource} from '../lib/resources';
import {useLive} from '../lib/live';
import {kioskStatus,type KioskUnit} from '../lib/kiosk';
import {timestamp} from '../lib/types';
import type {Branch} from '../lib/types';
import {Empty} from './UI';
export const KioskStatusBadge=({k}:{k:KioskUnit})=>{const s=kioskStatus(k);return <span className={'kiosk-status tone-'+s.tone}><i/>{s.label}</span>};
type Run=(name:string,data:Record<string,unknown>,success?:string)=>Promise<Record<string,any>|null>;
const kioskUrl=(code?:string)=>`${window.location.origin}/kiosk${code?`?pair=${code.replace('-','')}`:''}`;

/** Read-only status of this location's kiosks, shown on the Cashier station. */
export function KioskOverview({storeId}:{storeId:string}){
 const ref=useMemo(()=>storeId?listResource('businesses',storeId,'kiosks'):null,[storeId]);
 const {items}=useLive<KioskUnit>(ref,[storeId]);
 const paired=items.filter(k=>!k.unpaired);
 return <section className="panel"><div className="panel-head"><div><h2><Tablet size={18}/> Self-service kiosks</h2><p>Live status of the tablets and POS terminals at this location.</p></div></div>
  {paired.length?<div className="kiosk-cards">{paired.map(k=><article key={k.id} className="kiosk-card"><strong>{k.name}</strong><KioskStatusBadge k={k}/><small>{k.branchName}</small></article>)}</div>:<Empty title="No kiosks paired" detail="An admin can add one under Kiosk devices."/>}</section>;
}

/** Admin: register tablets/POS terminals, pair them with a one-time code, reset or put them in maintenance mode. */
export function KioskManager({storeId,branches,busy,run}:{storeId:string;branches:Branch[];busy:boolean;run:Run}){
 const ref=useMemo(()=>listResource('businesses',storeId,'kiosks'),[storeId]);
 const {items,error}=useLive<KioskUnit>(ref,[storeId]);
 const [name,setName]=useState(''),[branch,setBranch]=useState(''),[shown,setShown]=useState<{name:string;code:string}|null>(null),[copied,setCopied]=useState(false);
 const branchId=branches.some(b=>b.id===branch)?branch:branches[0]?.id||'';
 const create=async(e:React.FormEvent)=>{e.preventDefault();const r=await run('createKiosk',{businessId:storeId,branchId,name},'Kiosk registered — pair the tablet with the code below');if(r){setShown({name,code:r.pairingCode});setName('')}};
 const reset=async(k:KioskUnit)=>{if(!window.confirm(`Unpair “${k.name}”? The tablet will return to its setup screen until it is paired again.`))return;const r=await run('resetKiosk',{kioskId:k.id},'Kiosk unpaired — new pairing code issued');if(r)setShown({name:k.name,code:r.pairingCode})};
 const remove=async(k:KioskUnit)=>{if(window.confirm(`Remove “${k.name}” permanently?`))await run('deleteKiosk',{kioskId:k.id},'Kiosk removed')};
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1500)}catch{/* clipboard unavailable */}};
 return <>
  <section className="panel"><div className="panel-head"><div><h2>Register a kiosk</h2><p>Each tablet or POS terminal that customers use gets its own entry, so you can see whether it is online and which orders came from it.</p></div></div>
   <form className="inline-form" onSubmit={e=>void create(e)}><label className="field">Kiosk name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Front entrance kiosk" required maxLength={60}/></label>
    <label className="field">Location<select value={branchId} onChange={e=>setBranch(e.target.value)}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <button className="btn btn-primary" disabled={busy||!branchId}><Plus size={17}/> Register kiosk</button></form>
   {shown&&<div className="credential-box pair-box" role="status"><strong>Pair “{shown.name}”</strong><p>On the tablet open <code>{kioskUrl()}</code>, then enter this code — or scan the QR code with the tablet's camera. The code works once and expires in 24 hours.</p>
    <div className="pair-row"><div className="pair-code">{shown.code}</div><QRCodeSVG value={kioskUrl(shown.code)} size={130}/></div>
    <div className="table-actions"><button className="btn btn-outline" onClick={()=>void copy(shown.code)}><Copy size={15}/> {copied?'Copied':'Copy code'}</button><a className="btn btn-outline" href={kioskUrl()} target="_blank" rel="noreferrer">Open kiosk page <ExternalLink size={14}/></a><button className="btn btn-outline" onClick={()=>setShown(null)}>Dismiss</button></div></div>}
  </section>
  <section className="panel"><div className="panel-head"><div><h2>Kiosk devices</h2><p>Live status, refreshed every few seconds. “Maintenance mode” shows an out-of-service screen on the tablet.</p></div></div>
   {error&&<p className="error">{error}</p>}
   <div className="table-scroll"><table><thead><tr><th>Kiosk</th><th>Location</th><th>Status</th><th>Last seen</th><th>Actions</th></tr></thead><tbody>{items.map(k=><tr key={k.id}><td><strong>{k.name}</strong></td><td>{k.branchName}</td><td><KioskStatusBadge k={k}/></td><td>{k.lastSeen?timestamp(k.lastSeen):'Never'}</td>
    <td><div className="table-actions">{!k.unpaired&&<button disabled={busy} onClick={()=>void run('setKioskEnabled',{kioskId:k.id,enabled:!k.enabled},k.enabled?'Kiosk set to maintenance mode':'Kiosk back in service')}><Wrench size={12}/> {k.enabled?'Maintenance':'Back in service'}</button>}<button disabled={busy} onClick={()=>void reset(k)}><RotateCcw size={12}/> {k.unpaired?'New code':'Unpair'}</button><button disabled={busy} onClick={()=>void remove(k)}><Trash2 size={12}/> Remove</button></div></td></tr>)}</tbody></table></div>
   {!items.length&&<Empty title="No kiosks registered yet" detail="Register your first tablet above."/>}
  </section>
  <section className="panel"><div className="panel-head"><div><h2>Installing the kiosk app on a tablet or POS</h2></div></div>
   <ol className="install-steps"><li>On the device, open Chrome (Android/Windows) or Edge and go to <code>{kioskUrl()}</code>. The device must reach this server — same Wi-Fi/network, or the public address once hosted.</li><li>Enter the pairing code. The device is now permanently tied to this store location; customers cannot leave the kiosk screens.</li><li>Open the browser menu and choose <b>Install app</b> / <b>Add to Home screen</b>. It installs as “SSTWAS Kiosk” and opens full-screen.</li><li>Optional lock-down: Android <i>Screen pinning</i> / iPad <i>Guided Access</i>, or Windows <i>Assigned access</i>, so the device only runs the kiosk.</li></ol>
   <p className="fineprint">Installing a web app requires a secure address (HTTPS) or <code>localhost</code>. For tablets on a plain-HTTP test network you can still pair and use the kiosk in the browser; see docs/KIOSK-DEVICES.md for the install options.</p></section>
 </>;
}
