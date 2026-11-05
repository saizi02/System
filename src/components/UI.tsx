import {useEffect,useState} from 'react';import {Link} from 'react-router-dom';import{ShoppingBag,ArrowRight,LogOut,LayoutDashboard,ScanLine,ShieldCheck}from'lucide-react';import{useSession}from'../lib/auth';import{homeFor,roleLabel,type Role}from'../lib/types';
export function Brand({locked=false}:{locked?:boolean}){const inner=<><span className="brand-emblem"><ShoppingBag size={21}/></span><span>Tillora <b>Retail</b><small>SMART RETAIL PLATFORM</small></span></>;return locked?<span className="brand">{inner}</span>:<Link className="brand" to="/">{inner}</Link>}
export function Header(){const{role,logout}=useSession();return <header className="topbar"><Brand/><nav><Link to="/">Explore shops</Link>{role&&<Link to={homeFor(role)}><LayoutDashboard size={16}/> {role==='cashier'?'Cashier':role==='kitchen'?'Kitchen':'Admin'}</Link>}<Link to="/login"><ShieldCheck size={16}/> {role?'Staff account':'Staff login'}</Link>{role&&<button className="linkbtn" onClick={()=>void logout()}><LogOut size={16}/> Sign out</button>}</nav></header>}
export function Empty({title,detail}:{title:string;detail?:string}){return <div className="empty"><ScanLine size={30}/><h3>{title}</h3><p>{detail||'Nothing to display here yet.'}</p></div>}
export function PageTitle({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode}){return <div className="page-head"><div><span className="eyebrow">{eyebrow||'TILLORA RETAIL'}</span><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div>}
export function Pill({text}:{text:string}){return <span className={'pill pill-'+text.replace(/[^a-z]/g,'_')}>{text.replaceAll('_',' ')}</span>}
export function Stat({label,value,detail}:{label:string;value:string|number;detail?:string}){return <div className="metric"><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>}
export function Action({children,onClick,secondary=false,disabled=false}:{children:React.ReactNode;onClick?:()=>void;secondary?:boolean;disabled?:boolean}){return <button type="button" className={'btn '+(secondary?'btn-outline':'btn-primary')} onClick={onClick} disabled={disabled}>{children}<ArrowRight size={16}/></button>}

export function RoleBadge({role}:{role:Role}){return <span className={'role-badge role-'+role}>{roleLabel[role]}</span>}
/** Green "Live" dot while data is syncing from the shared PostgreSQL database; red when the API cannot be reached. */
export function LiveBadge({synced,error}:{synced:number|null;error?:string}){
 const [,tick]=useState(0);useEffect(()=>{const t=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(t)},[]);
 const age=synced?Math.max(0,Math.round((Date.now()-synced)/1000)):null;const offline=!!error||age===null||age>10;
 return <span className={'live-badge '+(offline?'offline':'online')} title={error||'Synced with the shared PostgreSQL database every 3 seconds'}><i/>{offline?(age===null&&!error?'Connecting…':'Reconnecting…'):`Live · ${age}s`}</span>;
}
