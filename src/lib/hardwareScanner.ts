import {useCallback,useEffect,useRef,useState} from 'react';
import {cleanCode} from './barcode';
/** Hardware barcode scanner support for the kiosk.
 *  1) Keyboard mode (default): USB or Bluetooth scanners that "type" the code and press Enter.
 *  2) Serial mode: USB-serial / RS-232 scanners through the browser Web Serial API (Chrome or Edge, https or localhost). */
export type ScannerSettings={mode:'keyboard'|'serial';minLength:number;maxGapMs:number;baud:number;beep:boolean};
export const defaultScannerSettings:ScannerSettings={mode:'keyboard',minLength:4,maxGapMs:60,baud:9600,beep:true};
const KEY='sstwas_scanner_settings';
export function loadScannerSettings():ScannerSettings{try{return{...defaultScannerSettings,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return defaultScannerSettings}}
export function saveScannerSettings(s:ScannerSettings){try{localStorage.setItem(KEY,JSON.stringify(s))}catch{/* private mode */}}
export const serialSupported=()=>typeof navigator!=='undefined'&&'serial' in navigator&&window.isSecureContext;
export type ScanEvent={code:string;at:number;source:'keyboard'|'serial';gapMs:number};
type Serial={requestPort:()=>Promise<SerialPortLike>;getPorts:()=>Promise<SerialPortLike[]>;addEventListener:(t:string,f:()=>void)=>void;removeEventListener:(t:string,f:()=>void)=>void};
type SerialPortLike={open:(o:{baudRate:number})=>Promise<void>;close:()=>Promise<void>;readable:ReadableStream<Uint8Array>|null;getInfo?:()=>{usbVendorId?:number;usbProductId?:number}};
let audio:AudioContext|null=null;
export function scanTone(ok:boolean,enabled=true){if(!enabled)return;try{const C=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;audio=audio||new C();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=ok?1200:260;g.gain.value=.12;o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+(ok?.09:.28))}catch{/* sound optional */}}

/** Listens for scanner input and calls onScan(code). enabled=false pauses it (for example while a dialog is open). */
export function useHardwareScanner(onScan:(e:ScanEvent)=>void,enabled:boolean,settings:ScannerSettings){
 const cb=useRef(onScan);cb.current=onScan;
 const[serialState,setSerialState]=useState<'off'|'connecting'|'connected'|'error'>('off'),[serialInfo,setSerialInfo]=useState(''),[last,setLast]=useState<ScanEvent|null>(null),[count,setCount]=useState(0);
 const portRef=useRef<SerialPortLike|null>(null),readerRef=useRef<ReadableStreamDefaultReader<Uint8Array>|null>(null),keepOpen=useRef(false);
 const emit=useCallback((e:ScanEvent)=>{setLast(e);setCount(n=>n+1);cb.current(e)},[]);
 // Keyboard wedge: characters arriving faster than maxGapMs, ended by Enter/Tab, are a scan; slower typing is ignored.
 useEffect(()=>{
  if(!enabled||settings.mode!=='keyboard')return;
  let buf='',lastAt=0,firstAt=0;
  const onKey=(ev:KeyboardEvent)=>{
   if(ev.ctrlKey||ev.metaKey||ev.altKey)return;
   const el=ev.target as HTMLElement|null;if(el&&el.tagName==='TEXTAREA')return;
   const now=Date.now();
   if(ev.key==='Enter'||ev.key==='Tab'){
    const code=cleanCode(buf);const fast=buf.length>0&&(buf.length<2||(now-firstAt)/(buf.length)<=settings.maxGapMs);
    buf='';
    if(code.length>=settings.minLength&&fast){ev.preventDefault();ev.stopPropagation();emit({code,at:now,source:'keyboard',gapMs:Math.round((lastAt-firstAt)/Math.max(1,code.length-1))})}
    return
   }
   if(ev.key.length!==1)return;
   if(now-lastAt>settings.maxGapMs*2){buf='';firstAt=now}
   if(!buf)firstAt=now;
   buf+=ev.key;lastAt=now;
  };
  window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true)
 },[enabled,settings.mode,settings.minLength,settings.maxGapMs,emit]);
 const closePort=useCallback(async()=>{keepOpen.current=false;try{await readerRef.current?.cancel()}catch{}try{readerRef.current?.releaseLock()}catch{}try{await portRef.current?.close()}catch{}readerRef.current=null;portRef.current=null;setSerialState('off');setSerialInfo('')},[]);
 const readLoop=useCallback(async(port:SerialPortLike)=>{
  const dec=new TextDecoder();let text='';
  try{
   while(keepOpen.current&&port.readable){
    const reader=port.readable.getReader();readerRef.current=reader;
    try{for(;;){const{value,done}=await reader.read();if(done)break;text+=dec.decode(value,{stream:true});let m;while((m=text.search(/[\r\n]/))>=0){const code=cleanCode(text.slice(0,m));text=text.slice(m+1);if(code.length>=settings.minLength)emit({code,at:Date.now(),source:'serial',gapMs:0})}}}finally{reader.releaseLock()}
   }
  }catch(e){if(keepOpen.current){setSerialState('error');setSerialInfo((e as Error).message||'The scanner was disconnected')}}
 },[emit,settings.minLength]);
 const openPort=useCallback(async(port:SerialPortLike)=>{
  setSerialState('connecting');
  try{await port.open({baudRate:settings.baud});portRef.current=port;keepOpen.current=true;const i=port.getInfo?.();setSerialInfo(i?.usbVendorId?`USB device ${i.usbVendorId.toString(16)}:${(i.usbProductId||0).toString(16)}`:'Serial scanner');setSerialState('connected');void readLoop(port)}
  catch(e){setSerialState('error');setSerialInfo((e as Error).message)}
 },[settings.baud,readLoop]);
 /** Must be called from a click: the browser asks the operator to pick the scanner's port. */
 const connectSerial=useCallback(async()=>{const s=(navigator as unknown as {serial?:Serial}).serial;if(!s){setSerialState('error');setSerialInfo('Web Serial is not available. Use Chrome or Edge over https or localhost.');return}try{const port=await s.requestPort();await closePort();await openPort(port)}catch(e){if((e as Error).name!=='NotFoundError'){setSerialState('error');setSerialInfo((e as Error).message)}}},[openPort,closePort]);
 // Reconnect to a previously approved port on reload, and notice unplugging.
 useEffect(()=>{
  if(settings.mode!=='serial'||!serialSupported())return;
  const s=(navigator as unknown as {serial:Serial}).serial;let alive=true;
  void s.getPorts().then(ps=>{if(alive&&ps[0]&&!portRef.current)void openPort(ps[0])});
  const gone=()=>{if(keepOpen.current){setSerialState('error');setSerialInfo('Scanner unplugged. Plug it back in and press Connect.')}};
  s.addEventListener('disconnect',gone);
  return()=>{alive=false;s.removeEventListener('disconnect',gone);void closePort()}
 },[settings.mode]);// eslint-disable-line react-hooks/exhaustive-deps
 return{serialState,serialInfo,connectSerial,disconnectSerial:closePort,last,count};
}
