import {useState} from 'react';
import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,ChefHat,LockKeyhole,LogOut,ShieldCheck,Wallet} from 'lucide-react';
import {useSession} from '../lib/auth';
import {homeFor,portalName,portalRoles,roleLabel,type Portal} from '../lib/types';
import {Brand} from './UI';
const meta:Record<Portal,{icon:ReactNode;tag:string;blurb:string;accent:string}>={
 admin:{icon:<ShieldCheck size={64}/>,tag:'ADMINISTRATION',blurb:'Stores, products, inventory, staff accounts and business reports.',accent:'admin'},
 cashier:{icon:<Wallet size={64}/>,tag:'CASHIER STATION',blurb:'Confirm cash, assist shoppers, hand over orders and verify grocery exits.',accent:'cashier'},
 kitchen:{icon:<ChefHat size={64}/>,tag:'KITCHEN DISPLAY',blurb:'Live food orders from the tills. Prepare, mark ready, and the cashier is told.',accent:'kitchen'},
};
/** Stand-alone sign-in for one dashboard. The server only accepts accounts that belong to this portal. */
export function StationLogin({portal}:{portal:Portal}){
 const session=useSession(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);const m=meta[portal];
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await session.login(email,password,portal)}catch(ex){setError((ex as Error).message)}finally{setBusy(false)}};
 return <main className={'auth-page station-auth '+m.accent}><div className="auth-left"><Brand/><span className="eyebrow station-tag">{m.tag}</span><h1>{portalName[portal]}<br/><em>SSTWAS 2.0</em></h1><p>{m.blurb}</p><div className="auth-decor">{m.icon}</div></div>
  <div className="auth-right"><form onSubmit={e=>void submit(e)} className="auth-form"><span className="eyebrow">SECURE STAFF ACCESS</span><h2>Sign in to the {portalName[portal].toLowerCase()}</h2><p>Use the account your administrator created for this station.</p>
   <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label>
   <label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
   {error&&<p className="error" role="alert">{error}</p>}
   <button disabled={busy} type="submit" className="btn btn-primary">{busy?'Signing in…':'Open station'} <ArrowRight size={18}/></button>
   <div className="station-switch"><span>Other stations:</span>{(['admin','cashier','kitchen'] as Portal[]).filter(p=>p!==portal).map(p=><Link key={p} to={'/'+(p==='admin'?'admin':p)}>{portalName[p]}</Link>)}</div>
   <Link className="back-link" to="/">Customer storefront</Link></form></div></main>;
}
/** Shown when a signed-in account opens a dashboard that belongs to a different role. */
export function WrongStation({portal}:{portal:Portal}){
 const s=useSession();
 return <main className="setup-screen station-denied"><LockKeyhole size={44}/><h1>This account can't open the {portalName[portal]}</h1><p>You are signed in as <b>{s.user?.email}</b> ({s.role?roleLabel[s.role]:''}).</p>
  <div className="denied-actions"><Link className="btn btn-primary" to={homeFor(s.role)}>Go to my dashboard</Link><button className="btn btn-outline" onClick={()=>void s.logout()}><LogOut size={16}/> Sign out</button></div></main>;
}
/** Route guard: signed-out visitors get this station's own login screen, wrong roles get a clear message. */
export function StationGate({portal,children}:{portal:Portal;children:ReactNode}){
 const s=useSession();
 if(s.loading)return <div className="loading">Checking staff permissions…</div>;
 if(!s.role)return <StationLogin portal={portal}/>;
 if(!portalRoles[portal].includes(s.role))return <WrongStation portal={portal}/>;
 return <>{children}</>;
}
