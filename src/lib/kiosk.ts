/** A tablet/POS that has been paired with the store system. The token lives only on that device. */
export type KioskDevice={token:string;id:string;name:string;businessId:string;branchId:string};
const KEY='sstwas_kiosk_device';
export const getKioskDevice=():KioskDevice|null=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&v.token&&v.businessId&&v.branchId?v as KioskDevice:null}catch{return null}};
export const saveKioskDevice=(d:KioskDevice)=>{try{localStorage.setItem(KEY,JSON.stringify(d))}catch{/* private mode: pairing will not persist */}};
export const clearKioskDevice=()=>{try{localStorage.removeItem(KEY)}catch{/* ignore */}};
/** Row returned by `businesses/:id/kiosks` (status only — never codes or tokens). */
export type KioskUnit={id:string;name:string;branchId:string;branchName:string;enabled:boolean;state:'idle'|'shopping'|'checkout'|'offline';lastSeen?:string|null;pairedAt?:string|null;unpaired:boolean;awaitingPairing:boolean;secondsSinceSeen:number|null};
export type KioskTone='ok'|'busy'|'warn'|'off';
export function kioskStatus(k:KioskUnit):{label:string;tone:KioskTone}{
 if(k.unpaired)return k.awaitingPairing?{label:'Waiting to be paired',tone:'warn'}:{label:'Not paired',tone:'off'};
 if(!k.enabled)return{label:'Maintenance mode',tone:'warn'};
 if(k.secondsSinceSeen===null||k.secondsSinceSeen>120)return{label:'Offline',tone:'off'};
 if(k.state==='checkout')return{label:'Customer paying',tone:'busy'};
 if(k.state==='shopping')return{label:'Customer shopping',tone:'busy'};
 return{label:'Online · ready',tone:'ok'};
}
