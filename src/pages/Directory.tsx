import {useEffect, useMemo, useState} from 'react';
import {listResource, filterResource, equals} from '../lib/resources';
import {Link} from 'react-router-dom';
import {ArrowRight, BadgeCheck, ChevronRight, CircleCheck, Download, Monitor, PackageCheck, ScanBarcode, ShieldCheck, Shirt, ShoppingBasket, Smartphone, Store, UtensilsCrossed, WifiOff} from 'lucide-react';
import {useLive} from '../lib/live';
import {Brand, Empty} from '../components/UI';
import {useSession} from '../lib/auth';
import {homeFor} from '../lib/types';
import type {Business, Branch, Profile} from '../lib/types';

const profiles = [
  {id:'grocery' as Profile, title:'Grocery & supermarkets', subtitle:'Scan & Go, fast checkout and exit verification', icon:ShoppingBasket, number:'01', style:'grocery'},
  {id:'food' as Profile, title:'Food & quick service', subtitle:'Order meals, choose collection and track preparation', icon:UtensilsCrossed, number:'02', style:'food'},
  {id:'clothing' as Profile, title:'Fashion & clothing', subtitle:'Choose sizes and colours, pay and collect', icon:Shirt, number:'03', style:'clothing'},
];

type InstallPrompt = Event & {prompt:()=>Promise<void>; userChoice:Promise<{outcome:string}>};
function useInstallPrompt(){
  const [event,setEvent]=useState<InstallPrompt|null>(null);
  useEffect(()=>{
    const receive=(e:Event)=>{e.preventDefault();setEvent(e as InstallPrompt)};
    window.addEventListener('beforeinstallprompt',receive);
    return()=>window.removeEventListener('beforeinstallprompt',receive);
  },[]);
  return {canInstall:!!event,install:async()=>{if(!event)return;await event.prompt();await event.userChoice;setEvent(null)}};
}
/**
 * Photo backdrop for the landing hero. Drop up to 4 landscape photos into public/hero/ named hero-1.jpg … hero-4.jpg
 * (for example Black/African shoppers in a supermarket). Only files that exist are used; with none, the hero keeps its dark blue design.
 */
function HeroBackdrop({onFound}:{onFound:(count:number)=>void}){
  const [slides,setSlides]=useState<string[]>([]),[active,setActive]=useState(0);
  useEffect(()=>{
    let alive=true;
    const found:string[]=[];let pending=4;
    for(let i=1;i<=4;i++){const url=`/hero/hero-${i}.jpg`;const img=new Image();img.onload=()=>{found.push(url);if(--pending===0&&alive){setSlides(found.sort());onFound(found.length)}};img.onerror=()=>{if(--pending===0&&alive){setSlides(found.sort());onFound(found.length)}};img.src=url}
    return()=>{alive=false};
  },[]);
  useEffect(()=>{if(slides.length<2||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const t=setInterval(()=>setActive(a=>(a+1)%slides.length),7000);return()=>clearInterval(t)},[slides.length]);
  if(!slides.length)return null;
  return <div className="hero-backdrop" aria-hidden="true">{slides.map((u,i)=><div key={u} className={'slide'+(i===active?' on':'')} style={{backgroundImage:`url(${u})`}}/>)}</div>;
}
function ActiveBusiness({store}:{store:Business}){
  const ref=useMemo(()=>filterResource(listResource('businesses',store.id,'branches'),equals('active',true)),[store.id]);
  const {items:locations,error}=useLive<Branch>(ref,[store.id]);
  const style=profiles.find(p=>p.id===store.profile)||profiles[0];
  const Icon=style.icon;
  return <article className="landing-store-card">
    <div className={'landing-store-art '+style.style}><span className="store-icon-frame"><Icon size={31}/></span><span className="store-profile-tag">{style.title}</span></div>
    <div className="landing-store-body"><h3>{store.name}</h3><p>{locations.length} checkout {locations.length===1?'location':'locations'} available</p>
      {error&&<p className="error" role="alert">{error}</p>}
      {locations.map(branch=><div key={branch.id} className="landing-location">
        <div><Store size={16}/><span>{branch.name}</span></div>
        <div className="landing-location-buttons"><Link to={`/shop/${store.id}/${branch.id}`}>Mobile <Smartphone size={14}/></Link><Link to={`/kiosk/${store.id}/${branch.id}`}>Kiosk <Monitor size={14}/></Link></div>
      </div>)}
    </div>
  </article>;
}

export default function Directory(){
  const {role}=useSession();const {canInstall,install}=useInstallPrompt();
  const [hasPhoto,setHasPhoto]=useState(false);const [profile,setProfile]=useState<'all'|Profile>('all');const [search,setSearch]=useState('');
  const activeStores=useMemo(()=>filterResource(listResource('businesses'),equals('status','active')),[]);
  const {items:stores,error}=useLive<Business>(activeStores,[]);
  const visible=stores.filter(s=>(profile==='all'||s.profile===profile)&&s.name.toLowerCase().includes(search.toLowerCase()));
  const goToStores=(id:'all'|Profile)=>{setProfile(id);document.getElementById('browse-stores')?.scrollIntoView({behavior:'smooth'})};
  return <div className="landing-page">
    <header className="landing-topbar"><Brand/><nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#browse-stores">Find a store</a><Link className="landing-staff" to={role?homeFor(role):'/login'}><ShieldCheck size={17}/>{role?'Workspace':'Staff login'}</Link></nav></header>
    <main>
      <section className={'landing-hero'+(hasPhoto?' has-photo':'')} aria-labelledby="landing-title">
        <HeroBackdrop onFound={n=>setHasPhoto(n>0)}/>
        <div className="landing-glow left"/><div className="landing-glow right"/>
        <div className="landing-copy">
          <span className="landing-kicker"><span className="kicker-dot"/> A SMARTER WAY TO CHECK OUT</span>
          <h1 id="landing-title">Your shopping.<br/><span>Your checkout.</span><br/>Your way.</h1>
          <p>Skip the queue and take control. Shop from your phone or use the in-store touchscreen kiosk—across supermarkets, food outlets and clothing stores.</p>
          <div className="landing-hero-buttons"><a className="landing-primary" href="#browse-stores">Start shopping <ArrowRight size={18}/></a><a className="landing-secondary" href="#how-it-works">See how it works <ChevronRight size={17}/></a></div>
          <div className="landing-trust"><span><CircleCheck size={17}/> Mobile Scan & Go</span><span><CircleCheck size={17}/> No phone? Use the kiosk</span><span><CircleCheck size={17}/> Physical receipts</span></div>
        </div>
        <div className="landing-visual" aria-label="Illustration of mobile shopping and self-service kiosk">
          <div className="landing-halo"/>
          <div className="kiosk-mock">
            <div className="kiosk-display"><div className="kiosk-display-top"><span><ShoppingBasket size={17}/> TILLORA</span><span>SELF CHECKOUT</span></div>
              <div className="mock-success"><CircleCheck size={42}/></div><strong>Checkout made easy.</strong><small>Shop • Pay • Print</small>
              <div className="mock-products"><span>Fresh groceries</span><b>$8.50</b></div><div className="mock-products"><span>Your basket</span><b>3 items</b></div><div className="mock-pay">Complete checkout <ArrowRight size={15}/></div>
            </div><div className="kiosk-neck"/><div className="kiosk-foot"/>
          </div>
          <div className="mobile-mock"><div className="mobile-top"><span>TILLORA</span><span>● ● ●</span></div><div className="mobile-camera"><ScanBarcode size={48}/><span>SCAN PRODUCT</span></div><div className="mobile-mini-label">Added to your cart</div><div className="mobile-mini-price"><span>Fresh essentials</span><b>$5.20</b></div><div className="mobile-bottom"><div/><div/><div/></div></div>
          <div className="floating-token token-print"><PackageCheck size={19}/> Real printed receipts</div><div className="floating-token token-secure"><ShieldCheck size={19}/> Secure checkout</div>
        </div>
      </section>
      <section className="landing-profile-section" aria-label="Shopping profiles">
        <div className="landing-section-heading"><span className="landing-overline">BUILT FOR EVERYDAY SHOPPING</span><h2>Three ways to shop. One seamless system.</h2><p>Choose the experience that fits the store you’re visiting.</p></div>
        <div className="landing-profile-grid">{profiles.map(p=>{const Icon=p.icon;return <button type="button" key={p.id} className={'landing-profile '+p.style} onClick={()=>goToStores(p.id)}><div className="profile-number">{p.number} / SHOP PROFILE</div><div className="landing-profile-icon"><Icon size={32}/></div><h3>{p.title}</h3><p>{p.subtitle}</p><span className="profile-go">Browse this profile <ArrowRight size={17}/></span></button>})}</div>
      </section>
      <section id="how-it-works" className="landing-process"><div><span className="landing-overline">THREE SIMPLE STEPS</span><h2>Self-service that feels effortless.</h2><p>A genuine self-service till, whether you own a smartphone or not.</p></div><div className="landing-steps"><div><span>01</span><Smartphone size={26}/><h3>Choose your store</h3><p>Open Tillora on your phone, or start directly from the store kiosk.</p></div><div><span>02</span><ScanBarcode size={26}/><h3>Add your items</h3><p>Scan with your phone camera, or browse the kiosk's touch-friendly catalogue.</p></div><div><span>03</span><BadgeCheck size={26}/><h3>Check out & collect</h3><p>Complete the presentation payment flow, get a receipt, and collect your items.</p></div></div></section>
      <section id="browse-stores" className="landing-browse"><div className="landing-section-heading"><span className="landing-overline">FIND YOUR CHECKOUT</span><h2>Choose a store to begin.</h2><p>Explore all stores active on Tillora.</p></div>
        <div className="landing-filter-row"><div className="landing-pills"><button onClick={()=>setProfile('all')} className={profile==='all'?'active':''}>All stores</button>{profiles.map(p=><button key={p.id} onClick={()=>setProfile(p.id)} className={profile===p.id?'active':''}>{p.title.split(' & ')[0]}</button>)}</div><input aria-label="Search stores" placeholder="Search for a store…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        {error&&<p role="alert" className="error">{error}</p>}
        <div className="landing-business-grid">{visible.map(b=><ActiveBusiness key={b.id} store={b}/>)}</div>
        {!visible.length&&<div className="landing-empty"><Empty title={stores.length?'No stores match your search':'No shops registered yet'} detail={stores.length?'Try a different profile or business name.':'The Main Admin can register the first grocery, food or fashion outlet in the Admin module.'}/>{role==='super_admin'&&<Link className="landing-primary" to="/admin">Set up a store <ArrowRight size={16}/></Link>}</div>}
      </section>
      <section className="landing-footer-cta"><div><h2>Shopping without the queue.</h2><p>Install Tillora as an app, or use it directly in your browser.</p></div>{canInstall?<button className="landing-primary" onClick={()=>void install()}><Download size={18}/> Install Tillora</button>:<span><Monitor size={19}/> Web • Mobile • Kiosk</span>}</section>
    </main>
    <footer className="landing-footer"><span>© {new Date().getFullYear()} Tillora Retail · Smart Self-Service Checkout</span><span><WifiOff size={15}/> Secure shopping, even when connectivity changes</span><span>Connected retail for stores, kiosks and customers.</span></footer>
  </div>;
}
