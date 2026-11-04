import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {BrowserMultiFormatReader,type IScannerControls} from '@zxing/browser';
import {X,Zap,ZapOff,Keyboard,ShoppingCart,CheckCircle2,AlertTriangle} from 'lucide-react';
export type ScanResult={ok:boolean;message:string};
type Feedback=ScanResult&{id:number};
function beep(){try{const C=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;const ctx=new C(),o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=880;g.gain.value=.08;o.connect(g);g.connect(ctx.destination);o.start();setTimeout(()=>{o.stop();void ctx.close()},110)}catch{/* sound is optional */}}
/** Full-screen phone scanner: stays open so a shopper can scan several items in a row. */
export default function ScanOverlay({onScan,onClose,count,totalText,onOpenCart}:{onScan:(value:string)=>ScanResult;onClose:()=>void;count:number;totalText:string;onOpenCart:()=>void}){
 const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null),last=useRef({value:'',at:0}),onScanRef=useRef(onScan);
 onScanRef.current=onScan;
 const[error,setError]=useState(''),[torch,setTorch]=useState(false),[canTorch,setCanTorch]=useState(false),[manual,setManual]=useState(false),[typed,setTyped]=useState(''),[feedback,setFeedback]=useState<Feedback|null>(null),[starting,setStarting]=useState(true);
 const handle=useCallback((value:string)=>{
  const now=Date.now();if(value===last.current.value&&now-last.current.at<2500)return;last.current={value,at:now};
  const r=onScanRef.current(value);setFeedback({...r,id:now});
  try{navigator.vibrate?.(r.ok?60:[80,60,80])}catch{/* not supported */}
  if(r.ok)beep();
 },[]);
 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){setError('The camera needs a secure (https) connection. Open the store link over https, or type the barcode below.');setManual(true);setStarting(false);return}
   try{
    const reader=new BrowserMultiFormatReader();
    const c=await reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}}},video.current!,res=>{if(res&&!cancelled)handle(res.getText())});
    if(cancelled){c.stop();return}
    controls.current=c;setStarting(false);
    const track=(video.current?.srcObject as MediaStream|null)?.getVideoTracks()[0];
    const caps=track&&(track.getCapabilities?.() as MediaTrackCapabilities&{torch?:boolean});setCanTorch(!!caps?.torch);
   }catch(e){
    const n=(e as Error).name;
    setError(n==='NotAllowedError'?'Camera access was blocked. Allow the camera for this site in your browser settings, then reopen the scanner.':n==='NotFoundError'?'No camera was found on this device.':`The camera could not start: ${(e as Error).message}`);setManual(true);setStarting(false)
   }
  })();
  return()=>{cancelled=true;controls.current?.stop();controls.current=null};
 },[handle]);
 useEffect(()=>{if(!feedback)return;const t=setTimeout(()=>setFeedback(f=>f&&f.id===feedback.id?null:f),2600);return()=>clearTimeout(t)},[feedback]);
 useEffect(()=>{const prev=document.body.style.overflow;document.body.style.overflow='hidden';const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',k);return()=>{document.body.style.overflow=prev;window.removeEventListener('keydown',k)}},[onClose]);
 const flip=async()=>{const track=(video.current?.srcObject as MediaStream|null)?.getVideoTracks()[0];if(!track)return;try{await track.applyConstraints({advanced:[{torch:!torch}] as unknown as MediaTrackConstraintSet[]});setTorch(!torch)}catch{setCanTorch(false)}};
 const submit=(e:FormEvent)=>{e.preventDefault();const v=typed.trim();if(!v)return;handle(v);setTyped('')};
 return <div className="scan-overlay" role="dialog" aria-modal="true" aria-label="Scan product">
  <video ref={video} className="scan-video" playsInline muted/>
  <div className="scan-top"><button type="button" className="scan-round" onClick={onClose} aria-label="Close scanner"><X size={22}/></button><strong>Scan a product QR or barcode</strong>{canTorch?<button type="button" className="scan-round" onClick={()=>void flip()} aria-label={torch?'Turn torch off':'Turn torch on'}>{torch?<ZapOff size={20}/>:<Zap size={20}/>}</button>:<span className="scan-round ghost"/>}</div>
  {!error&&<div className="scan-frame" aria-hidden="true"><i/><i/><i/><i/>{starting&&<span>Starting camera…</span>}</div>}
  {error&&<p className="scan-error" role="alert"><AlertTriangle size={18}/> {error}</p>}
  {feedback&&<p key={feedback.id} className={'scan-feedback '+(feedback.ok?'ok':'bad')} role="status">{feedback.ok?<CheckCircle2 size={18}/>:<AlertTriangle size={18}/>} {feedback.message}</p>}
  <div className="scan-bottom">
   {manual?<form className="scan-manual" onSubmit={submit}><input inputMode="numeric" autoFocus value={typed} onChange={e=>setTyped(e.target.value)} placeholder="Type the barcode number" aria-label="Barcode number"/><button className="btn btn-primary">Add</button></form>:<button type="button" className="scan-link" onClick={()=>setManual(true)}><Keyboard size={16}/> Enter barcode manually</button>}
   <button type="button" className="scan-cart" onClick={()=>{onClose();onOpenCart()}}><ShoppingCart size={18}/> {count} in cart · {totalText} <b>View cart</b></button>
  </div>
 </div>
}
