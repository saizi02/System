import {useCallback,useEffect,useRef,useState} from 'react';
import {Expand,KeyRound,PlugZap,Wrench} from 'lucide-react';
import {call} from '../lib/api';
import {clearKioskDevice,getKioskDevice,saveKioskDevice,type KioskDevice} from '../lib/kiosk';
import {Brand} from '../components/UI';
import Shop from './Shop';
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
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
 const [networkOnline,setNetworkOnline]=useState(()=>navigator.onLine);
 const [installPrompt,setInstallPrompt]=useState<InstallPrompt|null>(null);
 const [installed,setInstalled]=useState(()=>window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
 useEffect(()=>{const receive=(e:Event)=>{e.preventDefault();setInstallPrompt(e as InstallPrompt)};window.addEventListener('beforeinstallprompt',receive);return()=>window.removeEventListener('beforeinstallprompt',receive)},[]);
 useEffect(()=>{const online=()=>setNetworkOnline(true),offline=()=>setNetworkOnline(false);window.addEventListener('online',online);window.addEventListener('offline',offline);return()=>{window.removeEventListener('online',online);window.removeEventListener('offline',offline)}},[]);

 // Make the installed kiosk use its dedicated Tillcore manifest and title.
 useEffect(()=>{
  let link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');const created=!link;const previous=link?.getAttribute('href')||null;
  if(!link){link=document.createElement('link');link.rel='manifest';document.head.appendChild(link)}
  link.setAttribute('href','/kiosk.webmanifest');
  const title=document.title;document.title='Tillcore Kiosk';document.body.classList.add('kiosk-device');
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
  try{  const r=await call<{deviceToken:string;kiosk:{id:string;name:string;businessId:string;branchId:string;profile:KioskDevice['profile']}}>('pairKiosk',{code});
   const d:KioskDevice={token:r.deviceToken,...r.kiosk};saveKioskDevice(d);setDevice(d);setPhase('checking');window.history.replaceState(null,'','/kiosk')}
  catch(e){setMessage((e as Error).message);setPhase('setup')}
 },[]);
 // Deep link from the admin QR code: /kiosk?pair=ABCD1234
 useEffect(()=>{const code=new URLSearchParams(window.location.search).get('pair');if(code&&!getKioskDevice())void pair(code)},[pair]);

 const goFull=()=>{void document.documentElement.requestFullscreen?.().catch(()=>{})};
 const install=async()=>{if(!installPrompt)return;await installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice.outcome==='accepted')setInstalled(true);setInstallPrompt(null)};
 const fullButton=!full&&typeof document.documentElement.requestFullscreen==='function'?<button className="kiosk-fullscreen" onClick={goFull}><Expand size={16}/> Full screen</button>:null;

 if(phase==='setup')return <KioskSetup message={message} onPair={pair} fullButton={fullButton} canInstall={!!installPrompt&&!installed} onInstall={install}/>;
 if(phase==='checking'||!device)return <main className="kiosk-screen"><Brand locked/><p>Connecting to the store system…</p></main>;
 if(phase==='unreachable'||!networkOnline)return <main className="kiosk-screen kiosk-error-screen" role="alert"><Brand locked/><div className="kiosk-error-icon"><PlugZap size={44}/></div><span className="eyebrow">CONNECTION PROBLEM</span><h1>{networkOnline?'The store system is unavailable':'The kiosk has lost internet connection'}</h1><p>{networkOnline?'We are trying to reconnect automatically. If payment is not available, please wait before trying again.':'You can keep the kiosk screen open, but shopping and payments need internet access.'}</p><ol className="kiosk-recovery"><li>Check that the Wi-Fi is connected, or that the network cable is plugged in.</li><li>Wait 30 seconds and try the connection again.</li><li>If it still does not work, ask a staff member to restart the kiosk connection.</li></ol><button className="btn btn-primary" onClick={()=>{setNetworkOnline(navigator.onLine);void beat()}}>Retry connection</button></main>;
 if(phase==='maintenance')return <main className="kiosk-screen maintenance"><Brand locked/><Wrench size={46}/><h1>Kiosk temporarily out of service</h1><p>Please see a member of staff, or use another till.</p></main>;
 return <>{fullButton}{!installed&&!installPrompt&&<button className="kiosk-install" onClick={goFull}><Expand size={16}/> Enter full screen</button>}<Shop key={device.token} mode="kiosk" scope={{businessId:device.businessId,branchId:device.branchId,deviceToken:device.token}} onState={setShopState}/></>;
}
function KioskSetup({message,onPair,fullButton,canInstall,onInstall}:{message:string;onPair:(code:string)=>Promise<void>;fullButton:React.ReactNode;canInstall:boolean;onInstall:()=>Promise<void>}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false);
 const shown=code.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);const pretty=shown.length>4?`${shown.slice(0,4)}-${shown.slice(4)}`:shown;
 return <main className="kiosk-screen setup">{fullButton}<Brand locked/><span className="eyebrow">SET UP THIS KIOSK</span><h1>Pair this device with a store</h1>
  <p>An administrator creates the kiosk in <b>Admin → Kiosk devices</b> and gets a pairing code. Enter it here once; this device then opens straight into that store's self-service till.</p>
  {canInstall&&<button className="btn btn-outline kiosk-install-button" type="button" onClick={()=>void onInstall()}><Expand size={18}/> Install Tillcore Kiosk</button>}
  <form className="pair-form" onSubmit={e=>{e.preventDefault();setBusy(true);void onPair(shown).finally(()=>setBusy(false))}}>
   <input value={pretty} onChange={e=>setCode(e.target.value)} placeholder="ABCD-EFGH" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-label="Pairing code"/>
   <button className="btn btn-primary" disabled={busy||shown.length<8}><KeyRound size={18}/> {busy?'Pairing…':'Pair kiosk'}</button></form>
  {message&&<p className="error" role="alert">{message}</p>}</main>;
}
