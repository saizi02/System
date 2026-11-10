import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
/** Deployment settings from /api/config: single-store lock, enabled payment methods, whether payments are simulated. */
export type AppConfig={storeMode:'single'|'shared';store:{id:string;name:string;profile:string;branches:{id:string;name:string}[]}|null;payments:{methods:('cash'|'ecocash'|'onemoney'|'card'|'bank')[];simulated:boolean;provider?:string;currency?:string|null;testMode?:boolean};timezone:string;version:string};
const fallback:AppConfig={storeMode:'shared',store:null,payments:{methods:['cash'],simulated:false,provider:'cash-only'},timezone:'Africa/Harare',version:''};
let current:AppConfig=fallback;
/** For non-React code such as receipt printing. */
export const isSimulated=()=>current.payments.simulated;
const Ctx=createContext<{config:AppConfig;ready:boolean}>({config:fallback,ready:false});
export function ConfigProvider({children}:{children:ReactNode}){
 const[state,setState]=useState<{config:AppConfig;ready:boolean}>({config:fallback,ready:false});
 useEffect(()=>{
  let alive=true;
  const load=()=>fetch('/api/config',{credentials:'include'}).then(r=>r.ok?r.json():Promise.reject()).then((c:AppConfig)=>{if(alive){current=c;setState({config:c,ready:true})}}).catch(()=>{if(alive)setState(s=>({...s,ready:true}))});
  void load();const t=setInterval(()=>void load(),5*60000);return()=>{alive=false;clearInterval(t)}
 },[]);
 return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}
export const useConfig=()=>useContext(Ctx);
