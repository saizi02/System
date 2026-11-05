import {useCallback,useEffect,useRef,useState} from 'react';
import {Expand,KeyRound,PlugZap,Wrench} from 'lucide-react';
import {call} from '../lib/api';
import {clearKioskDevice,getKioskDevice,saveKioskDevice,type KioskDevice} from '../lib/kiosk';
import {Brand} from '../components/UI';
import Shop from './Shop';
type Phase='checking'|'setup'|'ready'|'maintenance'|'unreachable';
type ShopState='idle'|'shopping'|'checkout';
/**
 * Dedicated kiosk application for a tablet or POS terminal (address: /kiosk).
 * 1. First run: an admin-issued one-time code pairs the device with a store location.
 * 2. Afterwards it opens straight into the self-service shop for that location, with no exit links.
 * 3. It reports its status to the server every 20 s, so Admin and Cashier see it online and Admin can reset it or set maintenance mode.
 * Orders, stock, kitchen and cashier screens all use the same API/database as every other part of SSTWAS.
 */
export default function KioskApp(){
 const [device,setDevice]=useState<KioskDevice|null>(()=>getKioskDevice());
 const [phase,setPhase]=useState<Phase>(device?'checking':'setup');
 const [message,setMessage]=useState('');
 const [shopState,setShopState]=useState<ShopState>('idle');
 const stateRef=useRef<ShopState>('idle');stateRef.current=shopState;
 const [full,setFull]=useState(!!document.fullscreenElement||window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);

 // Make the installed app identify as "Tillora Kiosk" (own manifest, name, no scrolling/zoom gestures).
 useEffect(()=>{
  let link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');const created=!link;const previous=link?.getAttribute('href')||null;
  if(!link){link=document.createElement('link');link.rel='manifest';document.head.appendChild(link)}
  link.setAttribute('href','/kiosk.webmanifest');
  const title=document.title;document.title='Tillora Kiosk';document.body.classList.add('kiosk-device');
  return()=>{if(created)link!.remove();else if(previous)link!.setAttribute('href',previous);document.title=title;document.body.classList.remove('kiosk-device')};
 },[]);
 // Keep the screen awake while the kiosk is open.
 useEffect(()=>{
  let lock:{release?:()=>Promise<void>}|null=null;
  const request=async()=>{try{lock=await (navigator as unknown as {wakeLock?:{request:(t:string)=>Promise<typeof lock>}}).wakeLock?.request('screen')??null}catch{/* not supported or denied */}};
  void request();const visible=()=>{if(document.visibilityState==='visible')void request()};document.addEventListener('visibilitychange',visible);
  const fs=()=>setFull(!!document.fullscreenElement||window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);document.addEventListener('fullscreenchange',fs);
  return()=>{document.removeEventListener('visibilitychange',visible);document.removeEventListener('fullscreenchange',fs);void lock?.release?.()};
 },[]);

 const unpaired=useCallback((why:string)=>{clearKioskDevice();setDevice(null);setMessage(why);setPhase('setup')},[]);
 const beat=useCallback(async()=>{
  const d=getKioskDevice();if(!d)return;
  try{
   const r=await call<{paired:boolean;enabled?:boolean;kiosk?:{name:string}}>('kioskHeartbeat',{deviceToken:d.token,state:stateRef.current});
   if(!r.paired){unpaired('This kiosk was unpaired by an administrator. Enter a new pairing code to continue.');return}
   if(r.kiosk&&r.kiosk.name!==d.name){const next={...d,name:r.kiosk.name};saveKioskDevice(next);setDevice(next)}
   setPhase(r.enabled===false?'maintenance':'ready');
  }catch{setPhase(p=>p==='ready'||p==='maintenance'?p:'unreachable')}
 },[unpaired]);
 useEffect(()=>{if(!device)return;void beat();const t=setInterval(()=>void beat(),20000);return()=>clearInterval(t)},[device?.token,beat]);
 useEffect(()=>{if(device&&phase==='ready')void beat()},[shopState]); // report customer activity straight away

 const pair=useCallback(async(code:string)=>{
  setMessage('');
  try{const r=await call<{deviceToken:string;kiosk:{id:string;name:string;businessId:string;branchId:string}}>('pairKiosk',{code});
   const d:KioskDevice={token:r.deviceToken,...r.kiosk};saveKioskDevice(d);setDevice(d);setPhase('checking');window.history.replaceState(null,'','/kiosk')}
  catch(e){setMessage((e as Error).message);setPhase('setup')}
 },[]);
 // Deep link from the admin QR code: /kiosk?pair=ABCD1234
 useEffect(()=>{const code=new URLSearchParams(window.location.search).get('pair');if(code&&!getKioskDevice())void pair(code)},[pair]);

 const goFull=()=>{void document.documentElement.requestFullscreen?.().catch(()=>{})};
 const fullButton=!full&&typeof document.documentElement.requestFullscreen==='function'?<button className="kiosk-fullscreen" onClick={goFull}><Expand size={16}/> Full screen</button>:null;

 if(phase==='setup')return <KioskSetup message={message} onPair={pair} fullButton={fullButton}/>;
 if(phase==='checking'||!device)return <main className="kiosk-screen"><Brand locked/><p>Connecting to the store system…</p></main>;
 if(phase==='unreachable')return <main className="kiosk-screen"><Brand locked/><PlugZap size={44}/><h1>Can't reach the store system</h1><p>Retrying automatically. Please check the network cable or Wi-Fi.</p></main>;
 if(phase==='maintenance')return <main className="kiosk-screen maintenance"><Brand locked/><Wrench size={46}/><h1>Kiosk temporarily out of service</h1><p>Please see a member of staff, or use another till.</p></main>;
 return <>{fullButton}<Shop key={device.token} mode="kiosk" scope={{businessId:device.businessId,branchId:device.branchId,deviceToken:device.token}} onState={setShopState}/></>;
}
function KioskSetup({message,onPair,fullButton}:{message:string;onPair:(code:string)=>Promise<void>;fullButton:React.ReactNode}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false);
 const shown=code.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);const pretty=shown.length>4?`${shown.slice(0,4)}-${shown.slice(4)}`:shown;
 return <main className="kiosk-screen setup">{fullButton}<Brand locked/><span className="eyebrow">SET UP THIS KIOSK</span><h1>Pair this device with a store</h1>
  <p>An administrator creates the kiosk in <b>Admin → Kiosk devices</b> and gets a pairing code. Enter it here once; this device then opens straight into that store's self-service till.</p>
  <form className="pair-form" onSubmit={e=>{e.preventDefault();setBusy(true);void onPair(shown).finally(()=>setBusy(false))}}>
   <input value={pretty} onChange={e=>setCode(e.target.value)} placeholder="ABCD-EFGH" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-label="Pairing code"/>
   <button className="btn btn-primary" disabled={busy||shown.length<8}><KeyRound size={18}/> {busy?'Pairing…':'Pair kiosk'}</button></form>
  {message&&<p className="error" role="alert">{message}</p>}</main>;
}
