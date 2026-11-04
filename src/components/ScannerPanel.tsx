import {Usb,Keyboard,X,CheckCircle2,AlertTriangle,Plug,Unplug} from 'lucide-react';
import {inspectBarcode} from '../lib/barcode';
import {serialSupported,defaultScannerSettings,type ScannerSettings,type ScanEvent} from '../lib/hardwareScanner';
type Hw={serialState:'off'|'connecting'|'connected'|'error';serialInfo:string;connectSerial:()=>Promise<void>;disconnectSerial:()=>Promise<void>;last:ScanEvent|null;count:number};
/** Small status chip for the kiosk header. */
export function ScannerChip({settings,hw,onClick}:{settings:ScannerSettings;hw:Hw;onClick:()=>void}){
 const serial=settings.mode==='serial';const ok=serial?hw.serialState==='connected':true;const bad=serial&&(hw.serialState==='error'||hw.serialState==='off');
 return <button type="button" className={'scanner-chip '+(bad?'bad':ok?'ok':'')} onClick={onClick} aria-label="Barcode scanner settings"><Usb size={16}/> {serial?(hw.serialState==='connected'?'Scanner connected':hw.serialState==='connecting'?'Connecting…':'Scanner not connected'):hw.count?'Scanner working':'Scanner ready'}</button>
}
export default function ScannerPanel({settings,onChange,hw,onClose}:{settings:ScannerSettings;onChange:(s:ScannerSettings)=>void;hw:Hw;onClose:()=>void}){
 const info=hw.last?inspectBarcode(hw.last.code):null;const set=(p:Partial<ScannerSettings>)=>onChange({...settings,...p});
 return <div className="scanner-panel-backdrop" role="dialog" aria-modal="true" aria-label="Barcode scanner setup"><section className="scanner-panel">
  <header><div><h2><Usb size={20}/> Barcode scanner</h2><p>Connect the handheld or counter scanner, then scan any product to test it.</p></div><button type="button" className="scan-round dark" onClick={onClose} aria-label="Close"><X size={20}/></button></header>
  <div className="scanner-modes">
   <button type="button" className={settings.mode==='keyboard'?'on':''} onClick={()=>set({mode:'keyboard'})}><Keyboard size={20}/><b>USB / Bluetooth (keyboard mode)</b><small>Plug in and scan. Works with almost every scanner. Nothing to pair in the browser.</small></button>
   <button type="button" className={settings.mode==='serial'?'on':''} onClick={()=>set({mode:'serial'})} disabled={!serialSupported()}><Usb size={20}/><b>USB serial / RS-232</b><small>{serialSupported()?'For scanners set to serial (virtual COM) mode.':'Needs Chrome or Edge on https or localhost.'}</small></button>
  </div>
  {settings.mode==='serial'&&<div className="scanner-serial">
   <p className={'scanner-state '+hw.serialState}>{hw.serialState==='connected'?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>} {hw.serialState==='connected'?`Connected · ${hw.serialInfo}`:hw.serialState==='connecting'?'Connecting…':hw.serialInfo||'Not connected'}</p>
   <div className="scanner-row"><label>Baud rate<select value={settings.baud} onChange={e=>set({baud:Number(e.target.value)})}>{[9600,19200,38400,57600,115200].map(b=><option key={b}>{b}</option>)}</select></label>
    {hw.serialState==='connected'?<button type="button" className="btn btn-outline" onClick={()=>void hw.disconnectSerial()}><Unplug size={16}/> Disconnect</button>:<button type="button" className="btn btn-primary" onClick={()=>void hw.connectSerial()}><Plug size={16}/> Connect scanner</button>}</div>
  </div>}
  <div className="scanner-test" aria-live="polite">
   <span className="eyebrow">TEST</span>
   {hw.last&&info?<><strong className="scanner-code">{hw.last.code}</strong><p>{info.message||'Code received'} · {hw.last.code.length} characters{hw.last.source==='keyboard'?` · ${hw.last.gapMs} ms between keys`:' · serial'}</p><p className="muted">{hw.count} scan{hw.count===1?'':'s'} received since this page opened.</p></>:<p>Waiting for a scan… point the scanner at any barcode and pull the trigger.</p>}
  </div>
  {settings.mode==='keyboard'&&<details className="scanner-advanced"><summary>Advanced</summary>
   <div className="scanner-row"><label>Minimum code length<input type="number" min={1} max={20} value={settings.minLength} onChange={e=>set({minLength:Math.max(1,Math.min(20,Number(e.target.value)||4))})}/></label><label>Max gap between keys (ms)<input type="number" min={20} max={300} value={settings.maxGapMs} onChange={e=>set({maxGapMs:Math.max(20,Math.min(300,Number(e.target.value)||60))})}/></label></div>
   <small className="muted">If a scan is ignored, raise the gap (slow Bluetooth scanners). If staff typing is mistaken for scans, lower it.</small></details>}
  <label className="scanner-check"><input type="checkbox" checked={settings.beep} onChange={e=>set({beep:e.target.checked})}/> Beep on every scan (high = added, low = problem)</label>
  <div className="scanner-actions"><button type="button" className="btn btn-outline" onClick={()=>onChange(defaultScannerSettings)}>Reset to defaults</button><button type="button" className="btn btn-primary" onClick={onClose}>Done</button></div>
 </section></div>
}
