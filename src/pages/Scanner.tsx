import {useEffect,useRef,useState} from 'react';import {BrowserMultiFormatReader,type IScannerControls} from '@zxing/browser';import {Camera,CameraOff}from'lucide-react';
export function Scanner({onScan,caption='Scan a barcode or QR code'}:{onScan:(value:string)=>void;caption?:string}){
 const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null);const[active,setActive]=useState(false),[error,setError]=useState('');
 useEffect(()=>()=>controls.current?.stop(),[]);
 const start=async()=>{setError('');if(!video.current)return;try{const reader=new BrowserMultiFormatReader();controls.current=await reader.decodeFromVideoDevice(undefined,video.current,(result)=>{if(result){onScan(result.getText());controls.current?.stop();setActive(false)}});setActive(true)}catch(e){setError((e as Error).message)}};
 const stop=()=>{controls.current?.stop();controls.current=null;setActive(false)};
 return <div className="scanner"><div className="scanner-tools"><span><Camera size={18}/> {caption}</span><button className="btn btn-outline" type="button" onClick={active?stop:()=>void start()}>{active?<><CameraOff size={16}/> Stop camera</>:<><Camera size={16}/> Start camera</>}</button></div><video ref={video} playsInline muted className={active?'scanner-video visible':'scanner-video'}/>{error&&<p role="alert" className="error">{error}. Use manual entry if the camera isn't available.</p>}<small>Allow camera access. HTTPS is required when used on a phone outside localhost.</small></div>
}
