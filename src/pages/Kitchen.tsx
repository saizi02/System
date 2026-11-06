import {useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Bell,BellOff,ChefHat,Flame,LogOut,Printer,UtensilsCrossed,CheckCircle2,Hand} from 'lucide-react';
import {listResource,detailResource,filterResource,equals} from '../lib/resources';
import {useSession} from '../lib/auth';
import {useDoc,useLive} from '../lib/live';
import {call} from '../lib/api';
import {useArrivals,useChime} from '../lib/alerts';
import {printKitchenTicket} from '../lib/printing';
import {Brand,LiveBadge} from '../components/UI';
import type {Branch,Business,Order} from '../lib/types';

const stages=[
 {key:'new' as const,title:'New',hint:'Just paid — start preparing',action:'Start preparing',next:'preparing'},
 {key:'preparing' as const,title:'Preparing',hint:'On the line',action:'Mark ready',next:'ready'},
 {key:'ready' as const,title:'Ready',hint:'Waiting for the cashier to hand over',action:'',next:''},
];
const clock=(ms:number)=>{const s=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};
/**
 * Stand-alone Kitchen Display. It talks to the same Express API / PostgreSQL database as every other module:
 * paid orders from phones, kiosks and the cashier POS appear here within 3 seconds, and "Ready" is shown on the Cashier station.
 */
export default function Kitchen(){
 const me=useSession(),go=useNavigate(),supervisor=me.role!=='kitchen';
 const [chosenStore,setChosenStore]=useState(me.businessId||''),[chosenBranch,setChosenBranch]=useState(''),[error,setError]=useState(''),[busyId,setBusyId]=useState(''),[now,setNow]=useState(Date.now()),[banner,setBanner]=useState('');
 const chime=useChime('sstwas-kitchen-chime');
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
 const allRef=useMemo(()=>me.role==='super_admin'?listResource('businesses'):null,[me.role]);
 const {items:allStores}=useLive<Business>(allRef,[me.role]);
 const ownRef=useMemo(()=>me.role!=='super_admin'&&me.businessId?detailResource('businesses',me.businessId):null,[me.role,me.businessId]);
 const {value:ownStore}=useDoc<Business>(ownRef,[me.role,me.businessId]);
 const foodStores=(me.role==='super_admin'?allStores:ownStore?[ownStore]:[]).filter(s=>s.profile==='food');
 const storeId=me.role==='super_admin'?(foodStores.find(s=>s.id===chosenStore)?chosenStore:foodStores[0]?.id||''):(me.businessId||'');
 const store=foodStores.find(s=>s.id===storeId)||(ownStore?.id===storeId?ownStore:null);
 const branchRef=useMemo(()=>storeId?listResource('businesses',storeId,'branches'):null,[storeId]);
 const {items:branches}=useLive<Branch>(branchRef,[storeId]);
 const branchId=me.role==='kitchen'?me.branchId||'':(branches.find(b=>b.id===chosenBranch)?chosenBranch:branches[0]?.id||'');
 const ordersRef=useMemo(()=>storeId&&branchId?filterResource(listResource('businesses',storeId,'orders'),equals('branchId',branchId)):null,[storeId,branchId]);
 const {items:orders,error:orderErr,synced}=useLive<Order>(ordersRef,[storeId,branchId]);
 const board=orders.filter(o=>o.status==='paid'&&o.fulfillment!=='collected').sort((a,b)=>new Date(a.updatedAt||a.createdAt).getTime()-new Date(b.updatedAt||b.createdAt).getTime());
 const newIds=board.filter(o=>o.fulfillment==='new').map(o=>o.id);
 useArrivals(newIds,synced!==null,fresh=>{chime.play();setBanner(`${fresh.length} new order${fresh.length>1?'s':''} — #${fresh.map(id=>orders.find(o=>o.id===id)?.id.slice(-7).toUpperCase()).join(', #')}`);setTimeout(()=>setBanner(''),6000)});
 const advance=async(o:Order,next:string)=>{setBusyId(o.id);setError('');try{await call('updateFulfillment',{businessId:storeId,branchId,orderId:o.id,fulfillment:next})}catch(e){setError((e as Error).message)}finally{setBusyId('')}};
 const collectedRecently=orders.filter(o=>o.status==='paid'&&o.fulfillment==='collected').length;
 return <div className="kds">
  <header className="kds-bar"><div className="kds-id"><Brand/><span className="kds-title"><ChefHat size={19}/> KITCHEN DISPLAY</span></div>
   <div className="kds-where"><b>{store?.name||'—'}</b>{branches.length>1&&supervisor?<select value={branchId} onChange={e=>setChosenBranch(e.target.value)} aria-label="Location">{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>:<span>{branches.find(b=>b.id===branchId)?.name}</span>}
    {me.role==='super_admin'&&foodStores.length>1&&<select value={storeId} onChange={e=>{setChosenStore(e.target.value);setChosenBranch('')}} aria-label="Store">{foodStores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}</div>
   <div className="kds-tools"><LiveBadge synced={synced} error={orderErr}/>
    <button className={'kds-btn '+(chime.enabled?'on':'')} onClick={chime.toggle} title="Sound alert for new orders">{chime.enabled?<Bell size={16}/>:<BellOff size={16}/>}{chime.enabled?'Sound on':'Sound off'}</button>
    <button className="kds-btn" onClick={()=>void me.logout().then(()=>go('/kitchen'))}><LogOut size={16}/> Sign out</button></div></header>
  {banner&&<div className="kds-banner" role="status"><Flame size={18}/> {banner}</div>}
  {(error||orderErr)&&<p className="error kds-error" role="alert">{error||orderErr}</p>}
  {!store?<div className="kds-empty"><UtensilsCrossed size={42}/><h2>No Food store available</h2><p>The kitchen display is only used by Food stores. {supervisor?'Register a Food store in the Admin console first.':'Ask your administrator to check your account.'}</p></div>
  :!branchId?<div className="kds-empty"><h2>No location assigned</h2></div>
  :<main className="kds-board">{stages.map(st=>{const list=board.filter(o=>o.fulfillment===st.key);return <section key={st.key} className={'kds-col stage-'+st.key}><header><h2>{st.title}<b>{list.length}</b></h2><span>{st.hint}</span></header>
    <div className="kds-list">{list.map(o=>{const waited=now-new Date(o.updatedAt||o.createdAt).getTime();const late=st.key!=='ready'&&waited>10*60000,warn=st.key!=='ready'&&waited>5*60000;
     return <article key={o.id} className={'kds-ticket'+(late?' late':warn?' warn':'')}>
      <div className="kds-ticket-head"><strong>#{o.id.slice(-7).toUpperCase()}</strong><span className="kds-time">{clock(waited)}</span></div>
      <div className="kds-chips"><span className={'chip '+(o.serviceType==='dine_in'?'dine':'take')}>{o.serviceType==='dine_in'?'DINE IN':'TAKEAWAY'}</span><span className="chip src">{o.source==='pos'?'Till':o.source==='kiosk'?'Kiosk':'Phone'}</span></div>
      <ul className="kds-items">{o.items.map(i=><li key={i.productId+i.variantId}><b>{i.quantity}×</b> {i.name}{i.variantName!=='Standard'&&<small> {i.variantName}</small>}</li>)}</ul>
      {o.orderNote&&<p className="kds-note"><b>NOTE:</b> {o.orderNote}</p>}
      {st.action?<div className="kds-actions"><button className="kds-go" disabled={busyId===o.id} onClick={()=>void advance(o,st.next)}>{busyId===o.id?'Updating…':st.action}</button><button className="kds-print" aria-label="Print kitchen ticket" onClick={()=>store&&printKitchenTicket(o,store.name)}><Printer size={18}/></button></div>
      :<p className="kds-wait"><Hand size={16}/> Cashier will hand this over</p>}
     </article>})}
     {!list.length&&<p className="kds-none">{st.key==='new'?'No new orders':st.key==='preparing'?'Nothing on the line':'Nothing waiting'}</p>}</div></section>})}
   </main>}
  {store&&<footer className="kds-foot"><CheckCircle2 size={14}/> {collectedRecently} order{collectedRecently===1?'':'s'} collected in the last 30 minutes · Orders arrive automatically from phones, kiosks and the till</footer>}
 </div>;
}
