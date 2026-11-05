import{useEffect,useMemo,useRef,useState}from'react';import{useNavigate,useParams,useSearchParams,Link}from'react-router-dom';import{listResource,detailResource,filterResource,equals}from'../lib/resources';import{QRCodeSVG}from'qrcode.react';import{ArrowLeft,ArrowRight,Minus,Plus,ShoppingCart,Search,Smartphone,Monitor,Ticket,PackageCheck,Trash2,ScanLine,CheckCircle2,ScanBarcode,Keyboard}from'lucide-react';
import{useConfig}from'../lib/config';import{useOnline}from'../lib/network';import{call}from'../lib/api';import{useDoc,useLive}from'../lib/live';import{money,profileLabel,sku,type Business,type Branch,type Product,type Inventory,type CartLine}from'../lib/types';import{Brand,Header,Empty,PageTitle}from'../components/UI';import KioskKeypad from'../components/KioskKeypad';import ScanOverlay,{type ScanResult}from'../components/ScanOverlay';import{parseScan}from'../lib/scan';import ScannerPanel,{ScannerChip}from'../components/ScannerPanel';import{useHardwareScanner,loadScannerSettings,saveScannerSettings,scanTone}from'../lib/hardwareScanner';import PaymentSimulator from'../components/PaymentSimulator';
export default function Shop({mode='mobile',scope,onState}:{mode?:'mobile'|'kiosk'|'pos';scope?:{businessId:string;branchId:string;deviceToken?:string};onState?:(s:'idle'|'shopping'|'checkout')=>void}){
 const online=useOnline();const{config:appConfig}=useConfig();const methods=appConfig.payments.methods,isSim=appConfig.payments.simulated; const params=useParams(),nav=useNavigate();const[query,setQuery]=useSearchParams();const[notice,setNotice]=useState('');const linkHandled=useRef(false);const businessId=scope?.businessId??params.businessId??'',branchId=scope?.branchId??params.branchId??'';const key=`sstwas_cart_${businessId}_${branchId}_${mode}`;const checkoutKey=useRef(sessionStorage.getItem(`sstwas_checkout_key_${businessId}_${branchId}_${mode}`)||crypto.randomUUID());
 const checkoutLock=useRef(false);
 const [addedProduct,setAddedProduct]=useState<string|null>(null);
 const addedTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [cart,setCart]=useState<CartLine[]>(()=>{if(mode==='kiosk')return [];try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}}),[search,setSearch]=useState(''),[scanner,setScanner]=useState(false),[variant,setVariant]=useState<Record<string,string>>({}),[showCart,setShowCart]=useState(false),[method,setMethod]=useState<'bank'|'card'|'cash'|'ecocash'>('ecocash'),[currency,setCurrency]=useState('USD'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[serviceType,setServiceType]=useState<'dine_in'|'takeaway'>('takeaway'),[orderNote,setOrderNote]=useState(''),[paymentDialog,setPaymentDialog]=useState(false),[kioskStarted,setKioskStarted]=useState(false);
 useEffect(()=>{if(!methods.includes(method))setMethod(methods[0]||'cash')},[methods.join(),method]);
 useEffect(()=>{onState?.(mode==='kiosk'&&!kioskStarted?'idle':paymentDialog?'checkout':cart.length?'shopping':'idle')},[kioskStarted,paymentDialog,cart.length,mode]);
 useEffect(()=>{if(mode==='kiosk')return;try{localStorage.setItem(key,JSON.stringify(cart))}catch{}},[key,cart,mode]);
 useEffect(()=>{if(mode!=='kiosk')return;localStorage.removeItem(key);let timer:ReturnType<typeof setTimeout>;const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>{setCart([]);setShowCart(false);setKioskStarted(false);setSearch('')},180000)};reset();window.addEventListener('pointerdown',reset);window.addEventListener('keydown',reset);return()=>{clearTimeout(timer);window.removeEventListener('pointerdown',reset);window.removeEventListener('keydown',reset)}},[key,mode]);
 useEffect(()=>{if(!businessId||!branchId)return;const t=setTimeout(()=>{void call('saveShoppingSession',{businessId,branchId,items:cart}).catch(()=>{})},1600);return()=>clearTimeout(t)},[businessId,branchId,cart]);
 const businessRef=useMemo(()=>detailResource('businesses',businessId),[businessId]);const branchRef=useMemo(()=>detailResource('businesses',businessId,'branches',branchId),[businessId,branchId]);
 const prodRef=useMemo(()=>filterResource(listResource('businesses',businessId,'products'),equals('active',true)),[businessId]);const stockRef=useMemo(()=>listResource('businesses',businessId,'branches',branchId,'inventory'),[businessId,branchId]);
 const{value:business}=useDoc<Business>(businessRef,[businessId]);const{value:branch}=useDoc<Branch>(branchRef,[businessId,branchId]);const{items:products,error:prodError}=useLive<Product>(prodRef,[businessId]);const{items:stock,synced:stockSynced}=useLive<Inventory>(stockRef,[businessId,branchId]);
 const cacheKey=`sstwas_catalogue_${businessId}_${branchId}`;
 const [cached,setCached]=useState<{products:Product[];stock:Inventory[]}|null>(()=>{try{return JSON.parse(localStorage.getItem(`sstwas_catalogue_${businessId}_${branchId}`)||'null')}catch{return null}});
 useEffect(()=>{if(!online||!products.length)return;const next={products,stock};setCached(next);try{localStorage.setItem(cacheKey,JSON.stringify(next))}catch{}},[online,cacheKey,products,stock]);
 const catalogue=(!online&&!products.length)?cached?.products||[]:products;
 const inventoryRows=(!online&&!stock.length)?cached?.stock||[]:stock;
 const stockFor=(p:string,v:string)=>inventoryRows.find(s=>s.id===sku(p,v))?.quantity||0;
 const lines=cart.map(x=>{const p=catalogue.find(p=>p.id===x.productId);return p?{...x,product:p}:null}).filter(Boolean) as (CartLine&{product:Product})[];
 const unitPrice=(p:Product,variantId:string)=>p.priceCents+(p.variants.find(v=>v.id===variantId)?.surchargeCents||0);
 const total=lines.reduce((s,x)=>s+unitPrice(x.product,x.variantId)*x.quantity,0);const rate=Number(business?.rates?.[currency]||1);const displayTotal=Math.round(total*rate);
 const add=(p:Product,variantId?:string):boolean=>{const v=variantId||p.variants?.[0]?.id||'default';const inCart=cart.find(c=>c.productId===p.id&&c.variantId===v)?.quantity||0;if(inCart>=stockFor(p.id,v)){setError('Insufficient stock for this item');return false}setError('');setCart(a=>{const match=a.find(x=>x.productId===p.id&&x.variantId===v);return match?a.map(x=>x===match?{...x,quantity:x.quantity+1}:x):[...a,{productId:p.id,variantId:v,quantity:1}]});return true};
 const adjust=(l:CartLine,change:number)=>setCart(a=>a.map(x=>x.productId===l.productId&&x.variantId===l.variantId?{...x,quantity:Math.min(stockFor(l.productId,l.variantId),x.quantity+change)}:x).filter(x=>x.quantity>0));
 const animateAdd=(p:Product,variantId:string)=>{if(!add(p,variantId))return;if(addedTimer.current)clearTimeout(addedTimer.current);setAddedProduct(`${p.id}:${variantId}`);addedTimer.current=setTimeout(()=>setAddedProduct(null),700)};
 const removeFromCart=(l:CartLine)=>setCart(a=>a.filter(x=>!(x.productId===l.productId&&x.variantId===l.variantId)));
 const checked=async(presentationOutcome:'approved'|'declined'='approved'):Promise<boolean>=>{
  if(checkoutLock.current||!cart.length)return false;
  if(!online){setError('Internet connection lost. Your basket has been kept, but checkout cannot continue yet. Restore Wi-Fi or the network cable, wait a moment, then retry.');return false}
  checkoutLock.current=true;
  sessionStorage.setItem(`sstwas_checkout_key_${businessId}_${branchId}_${mode}`,checkoutKey.current);
  setBusy(true);setError('');
  try{
   const response=await call<{orderId:string;status:string}>('checkout',{
    businessId,branchId,items:cart,method,currency,source:mode,
    idempotencyKey:checkoutKey.current,deviceToken:scope?.deviceToken,
    serviceType:business?.profile==='food'?serviceType:null,
    orderNote,
    demoOutcome:method==='cash'?'approved':presentationOutcome
   });
   sessionStorage.removeItem(`sstwas_checkout_key_${businessId}_${branchId}_${mode}`);
   checkoutKey.current=crypto.randomUUID();
   if(response.status==='failed'){
    setPaymentDialog(false);
    setError('The presentation payment was declined. No stock was deducted. Please select another method or retry.');
    return true;
   }
   setPaymentDialog(false);setCart([]);setOrderNote('');
   void call('saveShoppingSession',{businessId,branchId,items:[],status:'completed'}).catch(()=>{});
   nav(`/receipt/${businessId}/${response.orderId}`);
   return true;
  }catch(e){const message=(e as Error).message;if(message.includes('connection was interrupted'))setError(`${message} Your basket has been kept — do not pay again unless checkout or the payment has been confirmed.`);else setError(message);return false}
  finally{checkoutLock.current=false;setBusy(false)}
 };
 const scan=(raw:string):ScanResult=>{
  const t=parseScan(raw);const p=catalogue.find(x=>(t.productId&&x.id===t.productId)||(t.code&&(x.barcode===t.code||x.id===t.code)));
  if(!p)return{ok:false,message:'This code is not from this store.'};
  const v=p.variants?.[0]?.id||'default';
  if(!stockFor(p.id,v))return{ok:false,message:`${p.name} is out of stock.`};
  if(!add(p,v))return{ok:false,message:`No more ${p.name} in stock.`};
  return{ok:true,message:`Added ${p.name} · ${money(p.priceCents)}`}
 };
 const canScan=(mode==='mobile'||mode==='kiosk')&&business?.profile==='grocery';
 const report=(r:ScanResult)=>{if(r.ok){setNotice(r.message);setError('')}else{setNotice('');setError(r.message)}};const reportRef=useRef(report);reportRef.current=report;
 // A product QR opened with the phone's own camera lands here as ?add=<productId>.
 const linkId=query.get('add');
 useEffect(()=>{
  if(!linkId||linkHandled.current||!catalogue.length||(online&&!stockSynced))return;
  linkHandled.current=true;
  report(scan(linkId));
  const next=new URLSearchParams(query);next.delete('add');setQuery(next,{replace:true});
 },[linkId,catalogue.length,stockSynced,online]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t)},[notice]);
 // Hardware barcode scanner (USB/Bluetooth keyboard mode or USB serial) on the kiosk.
 const scanRef=useRef(scan);scanRef.current=scan;
 const[scanSettings,setScanSettings]=useState(loadScannerSettings),[panelOpen,setPanelOpen]=useState(false),[keypad,setKeypad]=useState(false);const panelRef=useRef(false);panelRef.current=panelOpen;const startedRef=useRef(false);startedRef.current=kioskStarted;
 const changeScanSettings=(v:typeof scanSettings)=>{setScanSettings(v);saveScannerSettings(v)};
 const hw=useHardwareScanner(ev=>{
  if(panelRef.current)return;
  const r=scanRef.current(ev.code);scanTone(r.ok,scanSettings.beep);
  if(r.ok&&!startedRef.current)setKioskStarted(true);
  reportRef.current(r);setSearch('')
 },canScan&&mode==='kiosk'&&!scanner&&!paymentDialog,scanSettings);
 const scannerUi=canScan&&mode==='kiosk'?<><ScannerChip settings={scanSettings} hw={hw} onClick={()=>setPanelOpen(true)}/>{panelOpen&&<ScannerPanel settings={scanSettings} onChange={changeScanSettings} hw={hw} onClose={()=>setPanelOpen(false)}/>}</>:null;
 const itemCount=cart.reduce((s,x)=>s+x.quantity,0);
 const found=catalogue.filter(p=>(p.name+' '+p.category+' '+(p.barcode||'')).toLowerCase().includes(search.toLowerCase()));
 if(mode==='kiosk'&&!kioskStarted)return <div className="kiosk-entry"><div className="kiosk-entry-panel"><div className="kiosk-entry-mark"><Monitor size={48}/></div><span className="eyebrow">SSTWAS 2.0 · SELF-SERVICE TILL</span><h1>Welcome to {business?.name||'your store'}</h1><p>{business?.profile==='grocery'?'Scan each item\'s barcode, check your cart and pay right here at the till.':'Browse products, add to your cart and check out right here using the touchscreen.'}</p><div className="kiosk-entry-actions"><button className="btn btn-primary" onClick={()=>setKioskStarted(true)}><ShoppingCart size={21}/> Start shopping <ArrowRight size={19}/></button></div>{scannerUi}<small>Guest checkout · No account needed · {isSim?'Payments simulated · ':''}Physical receipt available</small>{!scope&&<Link to="/" className="back-link">Back to store list</Link>}</div></div>;
 return <div className={`${mode==='kiosk'?'kiosk-mode':'shop-mode'} ${addedProduct?'added-to-cart':''}`}>{mode==='kiosk'?<header className="kiosk-header"><Brand locked={!!scope}/><span>SELF-SERVICE TOUCHSCREEN • {branch?.name||'Kiosk'}</span>{scannerUi}{!scope&&<Link to="/">Exit kiosk</Link>}</header>:<Header/>}<main className="shopping-layout"><section className="shopping-products"><div className="shop-intro">{!scope&&<Link to="/" className="back-link"><ArrowLeft size={16}/> All businesses</Link>}<span className="eyebrow">{mode==='pos'?'STAFF ASSISTED CHECKOUT':mode==='kiosk'?'SELF-SERVICE KIOSK':'MOBILE SCAN & GO'}</span><h1>{business?.name||'Loading store…'}</h1><p>{branch?.name||''} · {business?profileLabel(business.profile):''} · Browse, select and checkout</p></div><div className="catalogue-controls"><div className="search-wrap"><Search size={20}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&canScan){const t=search.trim();if(t&&catalogue.some(x=>x.barcode===t)){e.preventDefault();report(scan(t));setSearch('')}}}} placeholder="Find products, categories or barcodes"/></div>{canScan&&mode==='mobile'&&<button className="btn btn-primary scan-start" onClick={()=>setScanner(true)}><ScanLine size={18}/> Scan a product</button>}{mode==='kiosk'&& <button className={`btn btn-outline ${addedProduct?'product-cart-bump':''}`} onClick={()=>setShowCart(true)}>Cart ({cart.length})</button>}</div>{canScan&&mode==='kiosk'&&<div className="kiosk-scan-zone"><div className="ksz-icon"><ScanBarcode size={46}/></div><div className="ksz-text"><h2>Scan your items here</h2><p>Hold each barcode under the scanner. It beeps when the item is added to your cart.</p></div><button className="btn btn-outline" onClick={()=>setKeypad(true)}><Keyboard size={18}/> Type barcode</button></div>} {mode==='kiosk'&&!online&&<div className="kiosk-offline-panel" role="alert"><strong>Internet connection lost</strong><span>1. Check Wi-Fi or network cable.</span><span>2. Your basket is still on screen.</span><span>3. Restore the connection, wait a moment, then retry checkout.</span></div>}
 {notice&&<p className="scan-toast" role="status"><CheckCircle2 size={16}/> {notice}</p>}{keypad&&<KioskKeypad onClose={()=>setKeypad(false)} onSubmit={code=>{const r=scan(code);report(r);return r.ok}}/>}{scanner&&mode==='mobile'&&<ScanOverlay onScan={scan} onClose={()=>setScanner(false)} count={itemCount} totalText={money(total)} onOpenCart={()=>setShowCart(true)}/>}{!online&&<p className="offline-banner" role="status">Offline mode: catalogue and your draft cart may be available, but prices/stock cannot be confirmed and checkout is paused.</p>}{prodError&&<p className="error">{prodError}</p>}{error&&<p className="error" role="alert">{error}</p>}<div className="products-grid">{found.map(p=>{const v=variant[p.id]||p.variants?.[0]?.id||'default';const qty=stockFor(p.id,v); return  <article className={`product-card ${qty?'product-card-clickable':''} ${addedProduct===`${p.id}:${v}`?'product-card-added':''}`} key={p.id} role={qty?'button':undefined} tabIndex={qty?0:undefined} aria-label={qty?`Add ${p.name} to cart`:undefined}  onClick={()=>{if(qty)animateAdd(p,v)}}  onKeyDown={e=>{ if(qty&&(e.key==='Enter'||e.key===' ')){ e.preventDefault();animateAdd(p,v)}}}><div className="product-image">{p.image?<img src={p.image} alt={p.name} loading="lazy"/>:<div className="product-placeholder"><ShoppingCart size={35}/></div>}<span className="stock-chip">{qty?`${qty} available`:'Out of stock'}</span></div><div className="product-content"><small>{p.category}</small><h3>{p.name}</h3><p>{p.description||'Available in store'}</p><div className="product-bottom"><strong>{money(p.priceCents)}</strong>{p.variants?.length>1&&<select aria-label={`Choose variant for ${p.name}`} value={v} onChange={e=>setVariant(a=>({...a,[p.id]:e.target.value}))}>{p.variants.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>}</div> <button className="btn btn-primary btn-full" onClick={e=>{e.stopPropagation();animateAdd(p,v)}} disabled={!qty}><Plus size={16}/> Add to cart</button></div></article>})}</div>{!found.length&&<Empty title="No products available" detail="The administrator must add products and stock before checkout can begin."/>}</section><aside className={'checkout-aside '+(showCart?'cart-open':'')}><div className="aside-header"><h2><ShoppingCart size={20}/> Your cart</h2><button className="mobile-close" onClick={()=>setShowCart(false)}>Close</button></div>{lines.length?lines.map(l=><div key={sku(l.productId,l.variantId)} className="cart-row"><div><strong>{l.product.name}</strong><small>{l.product.variants?.find(v=>v.id===l.variantId)?.name} · {money(l.product.priceCents)} each</small></div><div className="cart-controls"><div className="quantity"><button type="button" aria-label={`Decrease ${l.product.name} quantity`} onClick={()=>adjust(l,-1)}><Minus size={13}/></button><b>{l.quantity}</b><button type="button" aria-label={`Increase ${l.product.name} quantity`} onClick={()=>adjust(l,1)}><Plus size={13}/></button></div><button type="button" className="remove-cart-item" aria-label={`Remove ${l.product.name} from cart`} title={`Remove ${l.product.name}`} onClick={()=>removeFromCart(l)}><Trash2 size={16}/></button></div></div>):<Empty title="Cart is empty" detail={canScan&&mode==='kiosk'?'Scan an item to begin.':'Tap Add to cart on any item.'}/>}<div className="checkout-total"><span>Subtotal</span><strong>{money(total)}</strong></div><label className="field">Display/payment currency<select value={currency} onChange={e=>setCurrency(e.target.value)}>{['USD','ZIG','ZAR'].map(c=><option key={c}>{c}</option>)}</select></label><div className="checkout-total grand"><span>Total</span><strong>{money(displayTotal,currency)}</strong></div><p className="fineprint">Prices are based on USD. Applied exchange rate is recorded with the order.</p>  <label className="field">Payment method<select value={methods.includes(method)?method:methods[0]} onChange={e=>setMethod(e.target.value as any)}>{methods.includes('ecocash')&&<option value="ecocash">EcoCash{isSim?' — presentation':''}</option>}{methods.includes('bank')&&<option value="bank">Bank transfer{isSim?' — presentation':''}</option>}{methods.includes('card')&&<option value="card">Card{isSim?' — presentation':''}</option>}<option value="cash">Cash — pay at the cashier</option></select></label>{business?.profile==='food'&&<><label className="field">Order type<select value={serviceType} onChange={e=>setServiceType(e.target.value as 'dine_in'|'takeaway')}><option value="takeaway">Takeaway</option><option value="dine_in">Dine in</option></select></label><label className="field">Special instructions (optional)<textarea rows={2} maxLength={200} placeholder="e.g. no onions, extra sauce" value={orderNote} onChange={e=>setOrderNote(e.target.value)}/></label></>}{error&&<p className="error" role="alert">{error}</p>}<button disabled={busy||!online||!cart.length||business?.status!=='active'} className="btn btn-primary btn-full checkout-button" onClick={()=>setPaymentDialog(true)}>{busy?'Processing…':method==='cash'?'Proceed to cashier payment':isSim?'Proceed to simulated payment':'Proceed to payment'} <ArrowRight size={18}/></button>{isSim&&<small className="simulation-label">PAYMENT SIMULATION • NOT REAL MONEY</small>}</aside></main>{mode!=='kiosk'&&<div className="mobile-dock">{canScan&&<button className="dock-scan" onClick={()=>setScanner(true)} aria-label="Scan a product"><ScanLine size={22}/></button>}<button className="mobile-cart-fab" onClick={()=>setShowCart(true)}><ShoppingCart size={18}/> Cart ({itemCount}) • {money(total)}</button></div>}{paymentDialog&&<PaymentSimulator
  method={method}
  totalMinor={displayTotal}
  currency={currency}
  storeName={business?.name||'Tillora Store'}
  online={online}
  busy={busy}
  onClose={()=>setPaymentDialog(false)}
  onDecision={checked}
 />}</div>
}
