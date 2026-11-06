import {useEffect,useMemo,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {listResource,detailResource,filterResource,equals} from '../lib/resources';
import {QRCodeSVG} from 'qrcode.react';
import ProductLabels from '../components/ProductLabels';import {useConfig} from '../lib/config';import DayReport from '../components/DayReport';import ScanField from '../components/ScanField';import {inspectBarcode,cleanCode} from '../lib/barcode';import {scanTone} from '../lib/hardwareScanner';import {productLink} from '../lib/scan';
import {Activity,BarChart3,ChefHat,ClipboardList,Crown,ExternalLink,FileWarning,Home,KeyRound,LogOut,Menu,Monitor,
 Package,Plus,Printer,QrCode,Settings,ShieldCheck,ShoppingCart,Store,Tablet,Truck,UserCog,Users,Wallet,Warehouse,X} from 'lucide-react';
import {useSession} from '../lib/auth';
import {useDoc,useLive} from '../lib/live';
import {call,uploadProductImage} from '../lib/api';
import {Brand,Empty,PageTitle,Pill,RoleBadge,Stat} from '../components/UI';
import PasswordField from '../components/PasswordField';
import {KioskManager} from '../components/Kiosks';
import {ChangeOwnPassword} from '../components/Account';
import {generatePassword,passwordOk} from '../lib/password';
import {money,profileLabel,roleLabel,sku,timestamp} from '../lib/types';
import type {AuditEntry,Business,Branch,Product,Inventory,Order,Membership,Profile,Role,Supplier,PurchaseOrder} from '../lib/types';

type Section='overview'|'stores'|'staff'|'products'|'stock'|'suppliers'|'orders'|'sessions'|'flags'|'qr'|'kiosks'|'reports'|'activity'|'settings'|'account';
type Run=(name:string,data:Record<string,unknown>,success?:string)=>Promise<Record<string,any>|null>;
const navItems:{key:Section;name:string;icon:ReactNode;owner?:boolean;general?:boolean}[]=[ // owner: Super Admin only · general: day-to-day store work, hidden from the Super Admin
 {key:'overview',name:'Overview',icon:<Home/>},
 {key:'stores',name:'Stores',icon:<Store/>,owner:true},
 {key:'staff',name:'Staff accounts',icon:<Users/>},
 {key:'products',name:'Products',icon:<Package/>,general:true},
 {key:'stock',name:'Inventory',icon:<Warehouse/>,general:true},
 {key:'suppliers',name:'Suppliers',icon:<Truck/>,general:true},
 {key:'orders',name:'Transactions',icon:<ClipboardList/>,general:true},
 {key:'sessions',name:'Shopper sessions',icon:<Monitor/>},
 {key:'flags',name:'Flagged scans',icon:<FileWarning/>,general:true},
 {key:'qr',name:'Shop QR codes',icon:<QrCode/>,general:true},
 {key:'kiosks',name:'Kiosk devices',icon:<Tablet/>},
 {key:'reports',name:'Reports',icon:<BarChart3/>},
 {key:'activity',name:'Activity log',icon:<Activity/>},
 {key:'settings',name:'Settings',icon:<Settings/>},
 {key:'account',name:'My account',icon:<UserCog/>},
];
const profileOptions=[{id:'grocery',name:'Grocery / Supermarket'},{id:'food',name:'Food outlet / Fast food'},{id:'clothing',name:'Fashion / Clothing'}];
function Input({label,value,onChange,type='text',required=false,placeholder='',min}:{label:string;value:string;onChange:(s:string)=>void;type?:string;required?:boolean;placeholder?:string;min?:string}){return <label className="field">{label}<input value={value} onChange={e=>onChange(e.target.value)} type={type} required={required} placeholder={placeholder} min={min}/></label>}
function Dropdown({label,value,onChange,items}:{label:string;value:string;onChange:(s:string)=>void;items:{id:string;name:string}[]}){return <label className="field">{label}<select value={value} onChange={e=>onChange(e.target.value)}>{items.map(i=><option value={i.id} key={i.id}>{i.name}</option>)}</select></label>}
function Card({title,info,children}:{title:string;info?:string;children:ReactNode}){return <section className="panel"><div className="panel-head"><div><h2>{title}</h2>{info&&<p>{info}</p>}</div></div>{children}</section>}
function Table({columns,children}:{columns:string[];children:ReactNode}){return <div className="table-scroll"><table><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}

export default function Admin(){
 const me=useSession(),go=useNavigate(),owner=me.role==='super_admin';
 const [section,setSection]=useState<Section>('overview'),[selectedStore,setSelectedStore]=useState(me.businessId||''),[selectedBranch,setSelectedBranch]=useState('');
 const [mobileNav,setMobileNav]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[working,setWorking]=useState(false);
 const storesRef=useMemo(()=>owner?listResource('businesses'):null,[owner]);
 const {items:allStores,error:storeError}=useLive<Business>(storesRef,[owner]);
 const ownRef=useMemo(()=>!owner&&me.businessId?detailResource('businesses',me.businessId):null,[owner,me.businessId]);
 const {value:ownStore,error:ownError}=useDoc<Business>(ownRef,[owner,me.businessId]);
 const stores=owner?allStores:ownStore?[ownStore]:[];
 const storeId=owner?selectedStore:(me.businessId||'');
 const store=stores.find(s=>s.id===storeId);
 const branchRef=useMemo(()=>storeId?listResource('businesses',storeId,'branches'):null,[storeId]);
 const {items:branches,error:branchError}=useLive<Branch>(branchRef,[storeId]);
 const activeBranch=branches.find(b=>b.id===selectedBranch)?selectedBranch:(branches[0]?.id||'');
 useEffect(()=>{if(!owner&&me.businessId)setSelectedStore(me.businessId)},[owner,me.businessId]);
 useEffect(()=>{setSelectedBranch('')},[storeId]);
 const prodRef=useMemo(()=>storeId?listResource('businesses',storeId,'products'):null,[storeId]);
 const {items:products,error:productError}=useLive<Product>(prodRef,[storeId]);
 const invRef=useMemo(()=>storeId&&activeBranch?listResource('businesses',storeId,'branches',activeBranch,'inventory'):null,[storeId,activeBranch]);
 const {items:stock,error:invError}=useLive<Inventory>(invRef,[storeId,activeBranch]);
 const suppliersRef=useMemo(()=>storeId&&section==='suppliers'?listResource('businesses',storeId,'suppliers'):null,[storeId,section]);
 const {items:suppliers,error:supplierError}=useLive<Supplier>(suppliersRef,[storeId,section]);
 const purchaseOrdersRef=useMemo(()=>storeId&&activeBranch&&section==='suppliers'?listResource('businesses',storeId,'purchase-orders'):null,[storeId,activeBranch,section]);
 const {items:purchaseOrders,error:purchaseOrderError}=useLive<PurchaseOrder>(purchaseOrdersRef,[storeId,activeBranch,section]);
 const orderRef=useMemo(()=>storeId&&activeBranch?filterResource(listResource('businesses',storeId,'orders'),equals('branchId',activeBranch)):null,[storeId,activeBranch]);
 const {items:orders,error:orderError}=useLive<Order>(orderRef,[storeId,activeBranch]);
 const wantStaff=section==='staff'||section==='overview';
 const staffRef=useMemo(()=>!wantStaff?null:owner?listResource('staff'):storeId?listResource('businesses',storeId,'staff'):null,[owner,storeId,wantStaff]);
 const {items:staff,error:staffError}=useLive<Membership>(staffRef,[owner,storeId,wantStaff]);
 const auditRef=useMemo(()=>section!=='activity'?null:owner?listResource('audit'):storeId?listResource('businesses',storeId,'audit'):null,[owner,storeId,section]);
 const {items:audit,error:auditError}=useLive<AuditEntry>(auditRef,[owner,storeId,section]);
 const sessionsRef=useMemo(()=>storeId?listResource('businesses',storeId,'sessions'):null,[storeId]);
 const {items:sessions,error:sessionError}=useLive<{id:string;count:number;status:string;updatedAt:any}>(sessionsRef,[storeId]);
 const flagsRef=useMemo(()=>storeId?listResource('businesses',storeId,'flags'):null,[storeId]);
 const {items:flags,error:flagError}=useLive<{id:string;type:string;orderId:string;createdAt:any}>(flagsRef,[storeId]);
 const run:Run=async(name,data,success='Changes saved successfully')=>{setWorking(true);setError('');setMessage('');try{const result=await call<Record<string,any>>(name,data);setMessage(success);return result}catch(ex){setError((ex as Error).message);return null}finally{setWorking(false)}};
 const select=(s:Section)=>{setSection(s);setMobileNav(false);setError('');setMessage('')};
 const failed=[storeError,ownError,branchError,productError,invError,supplierError,purchaseOrderError,orderError,staffError,auditError,sessionError,flagError,error].find(Boolean);
 const revenue=orders.filter(o=>o.status==='paid').reduce((a,o)=>a+o.totalCents,0);
 return <div className="workspace-shell admin-workspace">
  <aside className={'workspace-nav '+(mobileNav?'open':'')}><div className="side-brand"><Brand/><button className="nav-close" onClick={()=>setMobileNav(false)} aria-label="Close menu"><X/></button></div>
   <div className={'role-label '+(owner?'super':'general')}>{owner?<Crown size={17}/>:<ShieldCheck size={17}/>}{owner?'Super Admin':'General Admin'}</div><span className="sidebar-label">{owner?'PLATFORM ADMINISTRATION':'STORE ADMINISTRATION'}</span>
   <nav>{navItems.filter(i=>(!i.owner||owner)&&!(owner&&i.general)).map(i=><button key={i.key} className={section===i.key?'active':''} onClick={()=>select(i.key)}>{i.icon}<span>{i.name}</span></button>)}</nav>
   <div className="nav-footer"><button onClick={()=>void me.logout().then(()=>go('/admin'))}><LogOut size={16}/> Sign out</button></div>
  </aside>
  <div className="workspace-main"><header className="workspace-toolbar"><button className="menu-toggle" onClick={()=>setMobileNav(true)} aria-label="Open admin menu"><Menu/></button><div className="breadcrumbs">TILLORA <span>/</span> ADMIN <span>/</span> <b>{navItems.find(i=>i.key===section)?.name}</b></div><span className="toolbar-user">{me.role&&<RoleBadge role={me.role}/>}{me.user?.displayName||me.user?.email||'Administrator'}</span></header>
   <main className="workspace-content"><PageTitle eyebrow={owner?'PLATFORM CONTROL':'STORE OPERATIONS'} title={navItems.find(i=>i.key===section)?.name||'Admin'} description={owner?'You can see and manage every store, every account and all system activity. Payments follow the payment settings of each store.':`You manage ${store?.name||'your store'}: catalogue, stock, reports and your Cashier and Kitchen staff. Payments follow the store's payment settings.`}/>
   {failed&&<p className="error" role="alert">{failed}</p>}{message&&<p className="success-toast" role="status">{message}<button onClick={()=>setMessage('')} aria-label="Dismiss">×</button></p>}
   {!['stores','account'].includes(section)&&!(owner&&section==='activity')&&<div className="workspace-selector simple-selectors">{owner&&<Dropdown label="Choose store" value={storeId} onChange={setSelectedStore} items={[{id:'',name:'Select registered store'},...stores.map(x=>({id:x.id,name:x.name}))]}/>}{branches.length>1&&<Dropdown label="Store location" value={activeBranch} onChange={setSelectedBranch} items={branches.map(b=>({id:b.id,name:b.name}))}/>}</div>}
   {section==='overview'&&<><div className="metrics-grid">{owner?<><Stat label="Stores" value={stores.length} detail="Registered businesses"/><Stat label="Active stores" value={stores.filter(x=>x.status==='active').length} detail={`${stores.filter(x=>x.status!=='active').length} suspended`}/><Stat label="Staff accounts" value={staff.length} detail={`${staff.filter(m=>m.role==='super_admin').length} Super · ${staff.filter(m=>m.role==='business_admin').length} General Admin`}/><Stat label="Disabled accounts" value={staff.filter(m=>m.disabled).length}/></>:<><Stat label="Stores" value={1} detail="Your store"/><Stat label="Products" value={products.length} detail="Selected store"/><Stat label="Completed checkouts" value={orders.filter(o=>o.status==='paid').length}/><Stat label="Recorded checkout totals" value={money(revenue)} detail="Completed checkouts"/></>}</div>{!owner&&storeId&&<div className="no-print"><Report orders={orders} products={products} stock={stock}/></div>}<Card title="Run your self-service till" info="Connected workspaces sharing one secure PostgreSQL database."><div className="quick-workflow"><article><Settings/><h3>Admin</h3>{owner?<><p>Stores, staff accounts and system activity.</p><button className="btn btn-outline" onClick={()=>select('staff')}>Manage staff</button></>:<><p>Products, inventory, staff and transaction reports.</p><button className="btn btn-outline" onClick={()=>select('products')}>Manage products</button></>}</article></div></Card>{!storeId&&<Empty title="Choose or register a store" detail="Every shop has its own products and checkouts."/>}</>}
   {section==='stores'&&owner&&<Stores stores={stores} busy={working} run={run} onSelect={id=>{setSelectedStore(id);select('overview')}}/>}
   {section==='staff'&&<StaffManager meId={me.user?.uid||''} owner={owner} storeId={storeId} stores={stores} members={staff} busy={working} run={run}/>}
   {section==='activity'&&<ActivityLog rows={audit} stores={stores} owner={owner}/>}
   {section==='account'&&<AccountSection/>}
   {section==='products'&&storeId&&<ProductManager key={storeId} storeId={storeId} profile={store?.profile||'grocery'} branchId={activeBranch} branchName={branches.find(b=>b.id===activeBranch)?.name||''} products={products} busy={working} run={run}/>}
   {section==='stock'&&storeId&&activeBranch&&<StockManager storeId={storeId} branchId={activeBranch} products={products} rows={stock} busy={working} run={run}/>}
   {section==='suppliers'&&storeId&&activeBranch&&<SupplierManager storeId={storeId} branchId={activeBranch} branches={branches} products={products} suppliers={suppliers} orders={purchaseOrders} busy={working} run={run}/>}
   {section==='orders'&&storeId&&<Orders rows={orders} storeId={storeId}/>}
   {section==='sessions'&&storeId&&<Card title="Shopper sessions" info="Active or completed carts reported by customer and kiosk clients."><Table columns={['Session','Items','Status','Last seen']}>{sessions.map(s=><tr key={s.id}><td><code>{s.id.slice(0,14)}</code></td><td>{s.count}</td><td><Pill text={s.status}/></td><td>{timestamp(s.updatedAt)}</td></tr>)}</Table>{!sessions.length&&<Empty title="No sessions yet"/>}</Card>}
   {section==='flags'&&storeId&&<Card title="Flagged receipt activity" info="Repeat exit verifications are recorded here."><Table columns={['Event','Receipt','When']}>{flags.map(f=><tr key={f.id}><td><Pill text={f.type}/></td><td>{f.orderId}</td><td>{timestamp(f.createdAt)}</td></tr>)}</Table>{!flags.length&&<Empty title="No flags recorded"/>}</Card>}
   {section==='qr'&&storeId&&activeBranch&&<QrCodes storeId={storeId} branchId={activeBranch} name={store?.name||'Store'} products={products}/>}
   {section==='kiosks'&&storeId&&<KioskManager storeId={storeId} branches={branches} busy={working} run={run}/>}
   {section==='reports'&&storeId&&activeBranch&&<DayReport businessId={storeId} branchId={activeBranch} branchName={branches.find(b=>b.id===activeBranch)?.name} canExport/>}{section==='reports'&&storeId&&<div className="no-print"><Report orders={orders} products={products} stock={stock}/></div>}
   {section==='settings'&&store&&<StoreSettings store={store} busy={working} run={run}/>}
   {!['overview','stores','account'].includes(section)&&!(owner&&section==='activity')&&(!storeId||(!activeBranch&&['stock','qr'].includes(section)))&&<Empty title="Select a store to continue" detail="Use the store selector above, or register your first store."/>}
   </main>
  </div>
 </div>;
}
function Stores({stores,busy,run,onSelect}:{stores:Business[];busy:boolean;run:Run;onSelect:(id:string)=>void}){
 const [name,setName]=useState(''),[profile,setProfile]=useState<Profile>('grocery'),[branchName,setBranchName]=useState('Main branch'),[currency,setCurrency]=useState('USD');
 const [address,setAddress]=useState(''),[phone,setPhone]=useState(''),[taxNumber,setTaxNumber]=useState(''),[vatRate,setVatRate]=useState('0'),[receiptFooter,setReceiptFooter]=useState('Thank you for shopping with us.');
 const{config:appConfig}=useConfig();const locked=appConfig.storeMode==='single'&&stores.length>=1;
 return <>{locked?<Card title="Single-store installation" info="This installation is locked to one store (STORE_MODE=single). To host more stores, run another installation or switch the server to shared mode."><p>Store: <strong>{stores[0].name}</strong> · {profileLabel(stores[0].profile)}</p></Card>:<Card title="Register a new store" info="Create the store, its first branch and receipt defaults in one step.">
  <form className="form-grid store-create-form" onSubmit={async e=>{e.preventDefault();const r=await run('createBusiness',{name,profile,branchName,address,phone,taxNumber,currency,vatRate:Number(vatRate),receiptFooter},'Store created with its first branch');if(r){setName('');setBranchName('Main branch');setAddress('');setPhone('');setTaxNumber('');setVatRate('0');onSelect(r.businessId)}}}>
   <Input label="Store name" value={name} onChange={setName} required placeholder="e.g. Chinhoyi Supermarket"/>
   <Dropdown label="Store profile" value={profile} onChange={v=>setProfile(v as Profile)} items={profileOptions}/>
   <Input label="First branch name" value={branchName} onChange={setBranchName} required placeholder="Main branch"/>
   <Dropdown label="Default currency" value={currency} onChange={setCurrency} items={[{id:'USD',name:'USD - US Dollar'},{id:'ZIG',name:'ZiG - Zimbabwe Gold'}]}/>
   <Input label="Business address" value={address} onChange={setAddress} placeholder="Street, city"/>
   <Input label="Business phone" value={phone} onChange={setPhone} placeholder="+263..."/>
   <Input label="Tax number" value={taxNumber} onChange={setTaxNumber} placeholder="Tax registration number"/>
   <Input label="VAT rate (%)" value={vatRate} onChange={setVatRate} type="number" min="0"/>
   <Input label="Receipt footer" value={receiptFooter} onChange={setReceiptFooter}/>
   <div className="form-actions"><button className="btn btn-primary" disabled={busy}><Plus size={17}/> Register store</button></div>
  </form>
 </Card>}<Card title="Registered stores" info="Grocery, food and fashion retailers on one platform."><Table columns={['Store','Profile','Status','Actions']}>{stores.map(b=><tr key={b.id}><td><strong>{b.name}</strong></td><td>{profileLabel(b.profile)}</td><td><Pill text={b.status}/></td><td><div className="table-actions"><button onClick={()=>onSelect(b.id)}>Manage</button><button disabled={busy} onClick={()=>void run('updateBusiness',{businessId:b.id,status:b.status==='active'?'suspended':'active'},'Store status updated')}>{b.status==='active'?'Suspend':'Activate'}</button></div></td></tr>)}</Table>{!stores.length&&<Empty title="No stores yet"/>}</Card></>;
}
const roleBlurb:Record<Role,string>={super_admin:'Super Admin — whole platform, all stores',business_admin:'General Admin — manages one store',cashier:'Cashier — checkout, cash and handover',kitchen:'Kitchen — food preparation display'};
const stationUrl=(path:string)=>`${window.location.origin}${path}`;
function StaffManager({meId,owner,storeId,stores,members,busy,run}:{meId:string;owner:boolean;storeId:string;stores:Business[];members:Membership[];busy:boolean;run:Run}){
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[role,setRole]=useState<Role>(owner?'business_admin':'cashier'),[formStore,setFormStore]=useState(storeId),[branch,setBranch]=useState('');
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[requireChange,setRequireChange]=useState(true),[formError,setFormError]=useState(''),[created,setCreated]=useState<{email:string;role:Role;password:string;path:string}|null>(null),[resetting,setResetting]=useState<Membership|null>(null);
 useEffect(()=>{setFormStore(storeId)},[storeId]);
 const targetId=owner?formStore:storeId,target=stores.find(s=>s.id===targetId);
 const branchRef=useMemo(()=>target?listResource('businesses',target.id,'branches'):null,[target?.id]);
 const {items:branches}=useLive<Branch>(branchRef,[target?.id]);
 const isFood=target?.profile==='food';
 const roles:Role[]=owner?['super_admin','business_admin','cashier',...(isFood?['kitchen' as Role]:[])]:['cashier',...(isFood?['kitchen' as Role]:[])];
 useEffect(()=>{if(!roles.includes(role))setRole(owner?'business_admin':'cashier')},[role,isFood,owner]);
 useEffect(()=>{if(!branches.some(b=>b.id===branch))setBranch(branches[0]?.id||'')},[branches,branch]);
 const needsStore=role!=='super_admin',needsBranch=role==='cashier'||role==='kitchen';
 const submit=async(e:FormEvent)=>{e.preventDefault();setFormError('');setCreated(null);
  if(!passwordOk(password)){setFormError('The password does not meet all requirements below');return}
  if(password!==confirm){setFormError('The passwords do not match');return}
  const r=await run('createStaff',{role,displayName:name,email,password,requireChange,...(needsStore?{businessId:targetId}:{}),...(needsBranch?{branchId:branch}:{})},`${roleLabel[role]} account created`);
  if(r){setCreated({email:email.trim().toLowerCase(),role,password,path:role==='cashier'?'/cashier':role==='kitchen'?'/kitchen':'/admin'});setName('');setEmail('');setPassword('');setConfirm('')}};
 const canAct=(m:Membership)=>m.uid!==meId&&(owner||['cashier','kitchen'].includes(m.role));
 return <>
  <Card title="Create an account" info={owner?'Super Admins can create other Super Admins, General Admins (one store each), Cashiers and Kitchen staff.':'General Admins create Cashier and Kitchen accounts for their own store.'}>
   <form onSubmit={e=>void submit(e)} className="form-grid staff-form">
    <Input label="Full name" value={name} onChange={setName} required/>
    <Input label="Sign-in email" value={email} onChange={setEmail} type="email" required/>
    <Dropdown label="Account role" value={role} onChange={v=>setRole(v as Role)} items={roles.map(r=>({id:r,name:roleBlurb[r]}))}/>
    {needsStore&&(owner?<Dropdown label="Assigned store" value={formStore} onChange={setFormStore} items={[{id:'',name:'Select a store'},...stores.map(x=>({id:x.id,name:`${x.name} (${profileLabel(x.profile)})`}))]}/>:<div className="field"><b>Assigned store</b><span className="muted">{target?.name||'—'}</span></div>)}
    {needsBranch&&<Dropdown label="Station location" value={branch} onChange={setBranch} items={branches.map(b=>({id:b.id,name:b.name}))}/>}
    <div className="staff-password">
     <PasswordField label="Password" value={password} onChange={setPassword} allowGenerate/>
     <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} showRules={false}/>
     <label className="check-row"><input type="checkbox" checked={requireChange} onChange={e=>setRequireChange(e.target.checked)}/> Require the user to choose a new password at first sign-in <small>(recommended)</small></label>
    </div>
    {formError&&<p className="error" role="alert">{formError}</p>}
    <div className="form-actions"><button className="btn btn-primary" disabled={busy||(needsStore&&!target)||(needsBranch&&!branch)}><Plus size={17}/> Create {roleLabel[role]} account</button></div>
   </form>
   {created&&<div className="credential-box" role="status"><strong>{roleLabel[created.role]} account ready</strong><p>Share these sign-in details privately:</p><dl className="cred-list"><dt>Email</dt><dd>{created.email}</dd><dt>Password</dt><dd><code>{created.password}</code></dd><dt>Sign in at</dt><dd><code>{stationUrl(created.path)}</code></dd></dl>{requireChange&&<p className="muted">They will be asked to replace this password when they first sign in.</p>}<button className="btn btn-outline" onClick={()=>setCreated(null)}>Dismiss</button></div>}
  </Card>
  <Card title={owner?'All staff accounts':'Store staff'} info={owner?'Every account on the platform. Disabling an account signs that person out immediately.':'Cashier and Kitchen accounts for your store. Disabling an account signs that person out immediately.'}>
   <Table columns={['Name','Role','Store','Status','Last sign-in','Actions']}>{members.map(m=><tr key={m.uid}><td><strong>{m.displayName||m.email}</strong><small className="table-sub">{m.email}{m.uid===meId?' · you':''}</small></td><td><RoleBadge role={m.role}/></td><td>{m.role==='super_admin'?'All stores':stores.find(s=>s.id===m.businessId)?.name||'—'}</td><td><Pill text={m.disabled?'suspended':m.mustChangePassword?'pending_password':'active'}/></td><td>{m.lastLoginAt?timestamp(m.lastLoginAt):'Never'}</td><td>{canAct(m)?<div className="table-actions"><button disabled={busy} onClick={()=>void run('setStaffStatus',{uid:m.uid,disabled:!m.disabled},m.disabled?'Account enabled':'Account disabled — sessions ended')}>{m.disabled?'Enable':'Disable'}</button><button disabled={busy} onClick={()=>setResetting(m)}><KeyRound size={12}/> Reset password</button></div>:<span className="muted">—</span>}</td></tr>)}</Table>
   {!members.length&&<Empty title="No staff accounts yet"/>}
  </Card>
  <Card title="Stand-alone stations" info="Each dashboard has its own address and sign-in. Open it on a tablet or second screen — it stays in sync through the shared database."><div className="qr-grid station-links">
   {[{path:'/cashier',title:'Cashier station',icon:<Wallet/>,text:'Cash confirmation, POS, handover'},{path:'/kitchen',title:'Kitchen display',icon:<ChefHat/>,text:'Food stores only'},{path:'/admin',title:'Admin console',icon:<ShieldCheck/>,text:'Super Admin & General Admin'}].map(x=><div className="qr-box" key={x.path}><QRCodeSVG value={stationUrl(x.path)} size={120}/><h3>{x.icon} {x.title}</h3><small>{stationUrl(x.path)}</small><p>{x.text}</p><a className="btn btn-outline" href={x.path} target="_blank" rel="noreferrer">Open <ExternalLink size={14}/></a></div>)}
  </div></Card>
  {resetting&&<ResetPassword member={resetting} busy={busy} run={run} onClose={()=>setResetting(null)}/>}
 </>;
}
function ResetPassword({member,busy,run,onClose}:{member:Membership;busy:boolean;run:Run;onClose:()=>void}){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[requireChange,setRequireChange]=useState(true),[error,setError]=useState('');
 const submit=async(e:FormEvent)=>{e.preventDefault();setError('');if(!passwordOk(password)){setError('The password does not meet all requirements');return}if(password!==confirm){setError('The passwords do not match');return}const r=await run('resetStaffPassword',{uid:member.uid,password,requireChange},'Password reset — that user was signed out');if(r)onClose()};
 return <div className="dialog-overlay" role="presentation" onClick={onClose}><form className="dialog-sheet" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()} onSubmit={e=>void submit(e)}>
  <button type="button" className="dialog-close" onClick={onClose} aria-label="Close"><X size={18}/></button><span className="eyebrow">RESET PASSWORD</span><h2>{member.displayName||member.email}</h2><p className="muted">{member.email} · {roleLabel[member.role]}</p>
  <PasswordField label="New password" value={password} onChange={setPassword} allowGenerate/><PasswordField label="Confirm password" value={confirm} onChange={setConfirm} showRules={false}/>
  <label className="check-row"><input type="checkbox" checked={requireChange} onChange={e=>setRequireChange(e.target.checked)}/> Require a new password at next sign-in</label>
  {error&&<p className="error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy}>Reset password</button></form></div>;
}
const actionText:Record<string,string>={'auth.login':'Signed in','business.created':'Store registered','business.updated':'Store settings changed','product.saved':'Product saved','stock.set':'Stock updated','staff.created':'Account created','staff.disabled':'Account disabled','staff.enabled':'Account enabled','staff.password_reset':'Password reset by admin','staff.password_changed':'Password changed','order.cash_confirmed':'Cash payment confirmed','order.cash_cancelled':'Cash order cancelled','order.fulfillment':'Order status changed','kiosk.created':'Kiosk registered','kiosk.paired':'Kiosk paired with a device','kiosk.reset':'Kiosk unpaired / code reissued','kiosk.maintenance':'Kiosk set to maintenance','kiosk.enabled':'Kiosk back in service','kiosk.deleted':'Kiosk removed'};
function detailText(a:AuditEntry){const d=a.details||{};const bits:string[]=[];if(d.email)bits.push(String(d.email));if(d.role)bits.push(roleLabel[d.role as Role]||String(d.role));if(d.name)bits.push(String(d.name));if(d.kioskId&&!d.name)bits.push('kiosk');if(d.from&&d.to)bits.push(`${d.from} → ${d.to}${d.station?` (${d.station})`:''}`);if(d.orderId&&!d.from)bits.push('order …'+String(d.orderId).slice(-7));if(d.portal)bits.push(`${d.portal} portal`);return bits.join(' · ')||'—'}
function ActivityLog({rows,stores,owner}:{rows:AuditEntry[];stores:Business[];owner:boolean}){
 return <Card title="Activity log" info={owner?'Latest 250 events across the whole platform: sign-ins, account changes, cash confirmations and kitchen/handover steps.':'Latest events for your store: sign-ins, account changes, cash confirmations and kitchen/handover steps.'}><Table columns={['When','Who','Action','Details',...(owner?['Store']:[])]}>{rows.map(a=><tr key={a.id}><td>{timestamp(a.createdAt)}</td><td>{a.actorEmail||'System'}{a.actorRole&&<> <RoleBadge role={a.actorRole}/></>}</td><td><strong>{actionText[a.action]||a.action}</strong></td><td>{detailText(a)}</td>{owner&&<td>{stores.find(s=>s.id===a.businessId)?.name||'—'}</td>}</tr>)}</Table>{!rows.length&&<Empty title="No activity recorded yet"/>}</Card>;
}
function AccountSection(){
 const me=useSession();
 return <><Card title="Signed-in account" info="Your role decides what you can see and change."><dl className="cred-list"><dt>Name</dt><dd>{me.user?.displayName||'—'}</dd><dt>Email</dt><dd>{me.user?.email}</dd><dt>Role</dt><dd>{me.role&&<RoleBadge role={me.role}/>} <span className="muted">{me.role==='super_admin'?'Full platform access: every store, every account, activity log.':'Manages one store and its Cashier and Kitchen staff.'}</span></dd></dl></Card><Card title="Change password" info="Changing your password signs you out of every other device."><ChangeOwnPassword/></Card></>;
}
const categoryHints:Record<Profile,string[]>={
 grocery:['Bakery','Dairy','Beverages','Pantry','Fruit & Vegetables','Meat & Fish','Frozen','Snacks','Household','Personal care'],
 food:['Meals','Burgers','Chicken','Wraps','Sides','Drinks','Desserts','Breakfast'],
 clothing:['Tops','Bottoms','Dresses','Outerwear','Footwear','Accessories','Kids']};
const presetSizes=['XS','S','M','L','XL','XXL'];
const productCopy:Record<Profile,{add:string;edit:string;info:string;name:string;namePh:string;catLabel:string;descLabel:string;descPh:string}>={
 grocery:{add:'Add grocery product',edit:'Update grocery product',info:'Scannable shelf products. Customers add them by scanning the barcode or choosing them on the kiosk.',name:'Product name',namePh:'e.g. Fresh Milk 2L',catLabel:'Aisle / category',descLabel:'Pack size / short description',descPh:'e.g. 2 litres, full cream'},
 food:{add:'Add menu item',edit:'Update menu item',info:'Meals, drinks and sides shown on the digital menu. The kitchen sees the name, options and customer notes.',name:'Menu item name',namePh:'e.g. Chicken & Chips',catLabel:'Menu section',descLabel:'Description / ingredients',descPh:'e.g. Quarter chicken, chips, coleslaw'},
 clothing:{add:'Add clothing item',edit:'Update clothing item',info:'Fashion items with sizes and colours. Stock is tracked for every size and colour combination.',name:'Item name',namePh:'e.g. Classic Denim Jacket',catLabel:'Department',descLabel:'Material, fit and care',descPh:'e.g. 100% cotton, regular fit'}};
const listOf=(t:string)=>t.split(',').map(x=>x.trim()).filter(Boolean);
const slugOf=(t:string)=>t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,36)||'v';
/** 13-digit in-store barcode (prefix 200 = store use) with a valid EAN-13 check digit. */
function storeBarcode(){const d=[2,0,0,...Array.from(crypto.getRandomValues(new Uint8Array(9)),n=>n%10)];const sum=d.reduce((s,n,i)=>s+n*(i%2?3:1),0);return d.join('')+((10-sum%10)%10)}
/** Keeps the id of any variant whose name already exists, so stock history is never orphaned when a product is edited. */
function buildVariants(names:string[],prior?:{id:string;name:string;barcode?:string;surchargeCents?:number}[]){const unique=[...new Set(names)];const used=new Set<string>();return unique.map(n=>{const old=prior?.find(v=>v.name===n);let id=old?.id;if(!id){const base=slugOf(n);id=base;let k=2;while(used.has(id)||prior?.some(v=>v.id===id))id=`${base}-${k++}`}used.add(id);return{id,name:n,barcode:old?.barcode,surchargeCents:old?.surchargeCents||0}})}
function foodVariants(value:string,prior?:{id:string;name:string;surchargeCents?:number}[]){
 return listOf(value).map(entry=>{const match=entry.match(/^(.*?)(?:\s*\+\s*\$?\s*(\d+(?:\.\d{1,2})?))$/);const name=(match?match[1]:entry).trim();const surcharge=Math.round(Number(match?.[2]||0)*100);const old=prior?.find(v=>v.name===name);return{id:old?.id||slugOf(name)+'-modifier',name,surchargeCents:surcharge||old?.surchargeCents||0}});
}
function ProductManager({storeId,profile,branchId,branchName,products,busy,run}:{storeId:string;profile:Profile;branchId:string;branchName:string;products:Product[];busy:boolean;run:Run}){
 const copy=productCopy[profile];
 const [editing,setEditing]=useState(''),[name,setName]=useState(''),[category,setCategory]=useState(''),[price,setPrice]=useState(''),[barcode,setBarcode]=useState(''),[description,setDescription]=useState(''),[image,setImage]=useState(''),[options,setOptions]=useState(''),[sizes,setSizes]=useState<string[]>([]),[otherSizes,setOtherSizes]=useState(''),[colours,setColours]=useState(''),[openingStock,setOpeningStock]=useState(''),[uploading,setUploading]=useState(false),[formError,setFormError]=useState(''),[labels,setLabels]=useState<Product[]|null>(null),[findCode,setFindCode]=useState(''),[findMsg,setFindMsg]=useState('');
 const reset=()=>{setEditing('');setName('');setCategory('');setPrice('');setBarcode('');setDescription('');setImage('');setOptions('');setSizes([]);setOtherSizes('');setColours('');setOpeningStock('');setFormError('')};
 const edit=(p:Product)=>{reset();setEditing(p.id);setName(p.name);setCategory(p.category);setPrice((p.priceCents/100).toFixed(2));setBarcode(p.barcode||'');setDescription(p.description||'');setImage(p.image||'');
  const names=p.variants.map(v=>v.name).filter(n=>n!=='Standard');
  if(profile==='food')setOptions(names.join(', '));
  if(profile==='clothing'){const combo=names.length>0&&names.every(n=>n.includes(' / '));const sz=combo?[...new Set(names.map(n=>n.split(' / ')[0]))]:names;setSizes(sz.filter(x=>presetSizes.includes(x)));setOtherSizes(sz.filter(x=>!presetSizes.includes(x)).join(', '));setColours(combo?[...new Set(names.map(n=>n.split(' / ')[1]))].join(', '):'')}
  window.scrollTo({top:0,behavior:'smooth'})};
 const imageUpload=async(f:File)=>{if(!f.type.startsWith('image/')||f.size>5*1024*1024){alert('Use an image smaller than 5 MB');return}setUploading(true);try{setImage(await uploadProductImage(storeId,f))}catch(e){alert((e as Error).message)}finally{setUploading(false)}};
 const toggleSize=(s:string)=>setSizes(a=>a.includes(s)?a.filter(x=>x!==s):[...a,s]);
 const save=async(e:FormEvent)=>{e.preventDefault();setFormError('');
  if(profile==='grocery'&&dupe){setFormError(`Barcode ${bc} already belongs to "${dupe.name}"`);return}
  const prior=products.find(x=>x.id===editing);const cents=Math.round(Number(price)*100);
  if(!(cents>0)){setFormError('Enter a price greater than zero');return}
  let names:string[]=[];
  if(profile==='food'){const variants=foodVariants(options,prior?.variants);names=variants.map(v=>v.name)}
  if(profile==='clothing'){const sz=[...presetSizes.filter(s=>sizes.includes(s)),...listOf(otherSizes)],cl=listOf(colours);if(!sz.length&&!cl.length){setFormError('Choose at least one size (or enter colours)');return}names=sz.length&&cl.length?sz.flatMap(s=>cl.map(c=>`${s} / ${c}`)):sz.length?sz:cl}
  const variants=profile==='grocery'?(prior?.variants||[{id:'default',name:'Standard'}]):profile==='food'?foodVariants(options,prior?.variants):names.length?buildVariants(names,prior?.variants):(prior?.variants.filter(v=>v.name==='Standard').length?prior.variants:[{id:'default',name:'Standard'}]);
  const r=await run('upsertProduct',{businessId:storeId,...(editing?{productId:editing}:{}),name,category,priceCents:cents,barcode:profile==='grocery'?barcode.trim():'',description,image,variants},editing?'Product updated':'Product saved');
  if(!r)return;
  const qty=Math.floor(Number(openingStock));
  if(!editing&&branchId&&qty>0)for(const v of variants)await run('setStock',{businessId:storeId,branchId,productId:r.productId,variantId:v.id,quantity:qty,lowStock:5},`Product saved with opening stock of ${qty} per ${profile==='clothing'?'size/colour':'item'}`);
  reset()};
 const bc=cleanCode(barcode),dupe=bc?products.find(x=>x.barcode===bc&&x.id!==editing):undefined,bcInfo=bc?inspectBarcode(bc):null;
 const barcodeHint=!bc?null:dupe?{tone:'error',text:`Already used by "${dupe.name}". Each product needs its own barcode.`}:bcInfo&&!bcInfo.valid?{tone:'warn',text:bcInfo.message}:{tone:'ok',text:bcInfo?.message||'Barcode accepted'};
 const findByScan=(raw:string)=>{const c=cleanCode(raw);const p=products.find(x=>x.barcode===c||x.id===c);scanTone(!!p);if(p){setFindMsg(`Found: ${p.name}`);edit(p)}else setFindMsg(`No product has barcode ${c}. Fill in the form above to add it.`);if(!p&&profile==='grocery'){reset();setBarcode(c)}setFindCode('')};
 const summary=(p:Product)=>profile==='clothing'?p.variants.map(v=>v.name!=='Standard'?`${v.name}${v.barcode?` (${v.barcode})`:''}`:'').filter(Boolean).join(', '):p.variants.map(v=>v.name).filter(n=>n!=='Standard').join(', ');
 return <><Card title={editing?copy.edit:copy.add} info={copy.info}><form onSubmit={e=>void save(e)} className="form-grid product-form">
   <Input label={copy.name} value={name} onChange={setName} required placeholder={copy.namePh}/>
   <label className="field">{copy.catLabel}<input list={'cats-'+profile} value={category} onChange={e=>setCategory(e.target.value)} required placeholder="Choose or type your own"/><datalist id={'cats-'+profile}>{categoryHints[profile].map(c=><option key={c} value={c}/>)}</datalist></label>
   <Input label="Price (USD)" type="number" min="0" value={price} onChange={setPrice} required placeholder="0.00"/>
   {profile==='grocery'&&<div className="field barcode-field"><ScanField label="Barcode" value={barcode} onChange={setBarcode} autoFocus={false} hint={barcodeHint?<span className={barcodeHint.tone}>{barcodeHint.text}</span>:'Scan the product with your barcode scanner, or type the number.'} onCode={c=>{const d=products.find(x=>x.barcode===c&&x.id!==editing);scanTone(!d)}}/><button type="button" className="smallbtn gen-btn" onClick={()=>setBarcode(storeBarcode())}>Generate in-store barcode</button></div>}
   {profile==='food'&&<label className="field">Options — same price (optional)<input value={options} onChange={e=>setOptions(e.target.value)} placeholder="e.g. Regular, Large, Spicy"/><small className="muted">Comma-separated. Items with a different price should be added as separate menu items.</small></label>}
   {profile==='clothing'&&<><div className="field size-field"><b>Sizes</b><div className="chip-row">{presetSizes.map(s=><button type="button" key={s} className={'size-chip'+(sizes.includes(s)?' on':'')} onClick={()=>toggleSize(s)} aria-pressed={sizes.includes(s)}>{s}</button>)}</div></div><Input label="Other sizes (optional)" value={otherSizes} onChange={setOtherSizes} placeholder="e.g. 28, 30, 32 or One size"/><Input label="Colours (optional, comma-separated)" value={colours} onChange={setColours} placeholder="e.g. Black, Navy, White"/></>}
   <label className="field wide">{copy.descLabel}<input value={description} onChange={e=>setDescription(e.target.value)} placeholder={copy.descPh}/></label>
   <Input label="Photo URL" value={image} onChange={setImage} placeholder="https://…"/><label className="field">Or upload a photo<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)void imageUpload(f)}} disabled={uploading}/></label>
   {!editing&&branchId&&<Input label={`Opening stock at ${branchName||'this location'}${profile==='clothing'?' (per size/colour)':''}`} type="number" min="0" value={openingStock} onChange={setOpeningStock} placeholder="0"/>}
   {formError&&<p className="error wide" role="alert">{formError}</p>}
   <div className="form-actions"><button className="btn btn-primary" disabled={busy||uploading}>{editing?'Update':'Save'} {profile==='food'?'menu item':profile==='clothing'?'item':'product'}</button>{editing&&<button type="button" className="btn btn-outline" onClick={reset}>Cancel edit</button>}</div></form></Card>
  <Card title={profile==='food'?'Menu':profile==='clothing'?'Clothing catalogue':'Product catalogue'} info="Items appear on phones and kiosks immediately.">{profile==='grocery'&&<div className="catalogue-find"><ScanField label="Scan to find or add a product" value={findCode} onChange={setFindCode} onCode={findByScan} placeholder="Click here, then scan a barcode" hint={findMsg||'Scanning an existing barcode opens that product for editing. A new barcode starts a new product.'}/></div>}{profile==='grocery'&&branchId&&<div className="catalogue-tools"><button className="btn btn-outline" disabled={!products.some(p=>p.active)} onClick={()=>setLabels(products.filter(p=>p.active))}><QrCode size={16}/> Print all QR labels</button><small className="muted">Each QR opens {branchName||'this branch'} on the shopper's phone with the item in their cart.</small></div>}<Table columns={profile==='grocery'?['Product','Category','Barcode','Price','Status','Actions']:['Item','Category','Price','Status','Actions']}>{products.map(p=><tr key={p.id}><td><strong>{p.name}</strong>{summary(p)&&<small className="table-sub">{summary(p)}</small>}</td><td>{p.category}</td>{profile==='grocery'&&<td><code>{p.barcode||'—'}</code></td>}<td>{money(p.priceCents)}</td><td><Pill text={p.active?'active':'suspended'}/></td><td><div className="table-actions"><button onClick={()=>edit(p)}>Edit</button>{profile==='grocery'&&branchId&&<button onClick={()=>setLabels([p])}>QR</button>}<button disabled={busy} onClick={()=>void run('upsertProduct',{businessId:storeId,productId:p.id,name:p.name,category:p.category,priceCents:p.priceCents,barcode:p.barcode||'',description:p.description||'',image:p.image||'',variants:p.variants,active:!p.active})}>{p.active?'Disable':'Enable'}</button></div></td></tr>)}</Table>{!products.length&&<Empty title={profile==='food'?'No menu items yet':'No products added'}/>}</Card>{labels&&<ProductLabels products={labels} businessId={storeId} branchId={branchId} storeName={branchName||'Store'} onClose={()=>setLabels(null)}/>}</>;
}
function SupplierManager({storeId,branchId,branches,products,suppliers,orders,busy,run}:{storeId:string;branchId:string;branches:Branch[];products:Product[];suppliers:Supplier[];orders:PurchaseOrder[];busy:boolean;run:Run}){
 const [supplierName,setSupplierName]=useState(''),[contactName,setContactName]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[address,setAddress]=useState('');
 const [supplierId,setSupplierId]=useState(''),[reference,setReference]=useState(''),[notes,setNotes]=useState('');
 const [productId,setProductId]=useState(''),[variantId,setVariantId]=useState(''),[quantity,setQuantity]=useState('1'),[cost,setCost]=useState('0'),[lines,setLines]=useState<any[]>([]);
 const product=products.find(p=>p.id===productId);
 useEffect(()=>{setSupplierId(suppliers[0]?.id||'')},[suppliers]);
 useEffect(()=>{if(!product?.variants.some(v=>v.id===variantId))setVariantId(product?.variants[0]?.id||'')},[product,variantId]);
 const addSupplier=async(e:FormEvent)=>{e.preventDefault();const result=await run('upsertSupplier',{businessId:storeId,name:supplierName,contactName,email,phone,address},'Supplier saved');if(result){setSupplierName('');setContactName('');setEmail('');setPhone('');setAddress('')}};
 const addLine=()=>{if(!product||!variantId)return;const variant=product.variants.find(v=>v.id===variantId);setLines(v=>[...v,{productId,variantId,name:product.name,variantName:variant?.name||variantId,quantity:Number(quantity)||1,costCents:Math.round(Number(cost)*100)}]);setProductId('')};
 const createOrder=async(status:'draft'|'ordered')=>{if(!supplierId||!lines.length)return;const result=await run('savePurchaseOrder',{businessId:storeId,branchId,supplierId,reference,status,notes,lines},status==='draft'?'Purchase draft saved':'Purchase order submitted');if(result)setLines([])};
 const branchName=branches.find(b=>b.id===branchId)?.name||'Current branch';
 return <>
  <Card title="Add supplier" info="Contact details are stored against the store and reused for purchase orders."><form className="form-grid" onSubmit={e=>void addSupplier(e)}><Input label="Supplier name" value={supplierName} onChange={setSupplierName} required/><Input label="Contact person" value={contactName} onChange={setContactName}/><Input label="Email" value={email} onChange={setEmail} type="email"/><Input label="Phone" value={phone} onChange={setPhone}/><label className="field wide">Address<input value={address} onChange={e=>setAddress(e.target.value)}/></label><div className="form-actions"><button className="btn btn-primary" disabled={busy}><Plus size={17}/> Save supplier</button></div></form></Card>
  <Card title="Registered suppliers" info="Active suppliers available for purchasing."><Table columns={['Supplier','Contact','Phone','Status']}>{suppliers.map(s=><tr key={s.id}><td><strong>{s.name}</strong><small className="table-sub">{s.email||'No email'}</small></td><td>{s.contactName||'—'}</td><td>{s.phone||'—'}</td><td><Pill text={s.active?'active':'inactive'}/></td></tr>)}</Table>{!suppliers.length&&<Empty title="No suppliers yet"/>}</Card>
  <Card title="Create purchase order" info={`New stock will be received into ${branchName}.`}><div className="form-grid"><Dropdown label="Supplier" value={supplierId} onChange={setSupplierId} items={[{id:'',name:'Select supplier'},...suppliers.map(s=>({id:s.id,name:s.name}))]}/><Input label="Order reference" value={reference} onChange={setReference} placeholder="Optional supplier reference"/><Dropdown label="Product" value={productId} onChange={v=>{setProductId(v);setVariantId('')}} items={[{id:'',name:'Choose product'},...products.map(p=>({id:p.id,name:p.name}))]}/><Dropdown label="Variant" value={variantId} onChange={setVariantId} items={(product?.variants||[]).map(v=>({id:v.id,name:v.name}))}/><Input label="Quantity" type="number" min="1" value={quantity} onChange={setQuantity}/><Input label="Unit cost (USD)" type="number" min="0" value={cost} onChange={setCost}/><label className="field wide">Notes<input value={notes} onChange={e=>setNotes(e.target.value)}/></label><div className="form-actions"><button className="btn btn-outline" disabled={!productId||!variantId} onClick={addLine} type="button">Add line</button></div></div>{lines.length>0&&<Table columns={['Product','Variant','Quantity','Unit cost','Remove']}>{lines.map((l,i)=><tr key={`${l.productId}_${l.variantId}`}><td>{l.name}</td><td>{l.variantName}</td><td>{l.quantity}</td><td>{money(l.costCents)}</td><td><button className="smallbtn" onClick={()=>setLines(v=>v.filter((_,n)=>n!==i))}>Remove</button></td></tr>)}</Table>}<div className="form-actions"><button className="btn btn-outline" disabled={busy||!supplierId||!lines.length} onClick={()=>void createOrder('draft')}>Save draft</button><button className="btn btn-primary" disabled={busy||!supplierId||!lines.length} onClick={()=>void createOrder('ordered')}>Submit order</button></div></Card>
  <Card title="Purchase orders" info="Receive an ordered or drafted purchase to add stock and record the goods in inventory."><Table columns={['Reference','Supplier','Status','Created','Action']}>{orders.map(o=><tr key={o.id}><td><strong>{o.reference||o.id.slice(0,8)}</strong></td><td>{suppliers.find(s=>s.id===o.supplierId)?.name||o.supplierId.slice(0,8)}</td><td><Pill text={o.status}/></td><td>{timestamp(o.createdAt)}</td><td>{o.status==='draft'||o.status==='ordered'?<button className="smallbtn" disabled={busy} onClick={()=>void run('receivePurchaseOrder',{businessId:storeId,purchaseOrderId:o.id},'Purchase received and stock updated')}>Receive</button>:o.status==='received'?'Stock received':'—'}</td></tr>)}</Table>{!orders.length&&<Empty title="No purchase orders yet"/>}</Card>
 </>;
}
function StockManager({storeId,branchId,products,rows,busy,run}:{storeId:string;branchId:string;products:Product[];rows:Inventory[];busy:boolean;run:Run}){
 const [productId,setProductId]=useState(''),[variantId,setVariantId]=useState(''),[quantity,setQuantity]=useState('0'),[threshold,setThreshold]=useState('5'),[scanCode,setScanCode]=useState(''),[scanMsg,setScanMsg]=useState('');
 const current=products.find(p=>p.id===productId),selected=variantId||current?.variants?.[0]?.id||'default';
 useEffect(()=>{const row=rows.find(r=>r.id===sku(productId,selected));setQuantity(String(row?.quantity??0));setThreshold(String(row?.lowStock??5))},[productId,selected,rows]);
 return <><div className="metrics-grid"><Stat label="Stock entries" value={rows.length}/><Stat label="Units in stock" value={rows.reduce((s,r)=>s+r.quantity,0)}/><Stat label="Low stock" value={rows.filter(r=>r.quantity<=(r.lowStock??5)).length}/></div><Card title="Update product stock" info="A real database transaction saves stock safely alongside simultaneous checkouts."><div className="catalogue-find"><ScanField label="Scan product to select it" value={scanCode} onChange={setScanCode} placeholder="Click here, then scan the product" hint={scanMsg||'Receiving stock? Scan each product, type the quantity, press Save.'} onCode={c=>{const p=products.find(x=>x.barcode===c||x.variants.some(v=>v.barcode===c));const variant=p?.variants.find(v=>v.barcode===c);scanTone(!!p);if(p){setProductId(p.id);setVariantId(variant?.id||'');setScanMsg(`Selected: ${p.name}${variant?` · ${variant.name}`:''}`)}else setScanMsg(`No product or variant has barcode ${c}`);setScanCode('')}}/></div><form className="inline-form" onSubmit={e=>{e.preventDefault();void run('setStock',{businessId:storeId,branchId,productId,variantId:selected,quantity:Number(quantity),lowStock:Number(threshold)},'Stock updated')}}><Dropdown label="Product" value={productId} onChange={v=>{setProductId(v);setVariantId('')}} items={[{id:'',name:'Choose product'},...products.map(p=>({id:p.id,name:p.name}))]}/><Dropdown label="Variant" value={selected} onChange={setVariantId} items={(current?.variants||[{id:'default',name:'Standard'}]).map(v=>({id:v.id,name:v.name}))}/><Input label="Available quantity" type="number" min="0" value={quantity} onChange={setQuantity}/><Input label="Low-stock alert at" type="number" min="0" value={threshold} onChange={setThreshold}/><button disabled={busy||!productId} className="btn btn-primary">Save stock</button></form></Card><Card title="Inventory listing"><Table columns={['Product','Variant','Available','Status']}>{rows.map(r=><tr key={r.id}><td>{products.find(p=>p.id===r.productId)?.name||r.productId}</td><td>{products.find(p=>p.id===r.productId)?.variants.find(v=>v.id===r.variantId)?.name||r.variantId}</td><td>{r.quantity}</td><td><Pill text={r.quantity===0?'out_of_stock':r.quantity<=(r.lowStock??5)?'low_stock':'active'}/></td></tr>)}</Table>{!rows.length&&<Empty title="No stock entries yet" detail="Add products first, then enter their stock quantities."/>}</Card></>;
}
function Orders({rows,storeId}:{rows:Order[];storeId:string}){return <Card title="Saved checkout transactions" info="Real orders created from mobile, kiosk or cashier POS."><Table columns={['Order','Date','Where','Method','Total','Status','Receipt']}>{[...rows].sort((a,b)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime()).map(o=><tr key={o.id}><td><code>{o.id.slice(0,14)}</code></td><td>{timestamp(o.createdAt)}</td><td>{o.source==='kiosk'?`Kiosk${o.kioskName?` · ${o.kioskName}`:''}`:o.source==='pos'?'Cashier':'Customer phone'}</td><td>{o.method}</td><td>{money(o.totalMinor,o.currency)}</td><td><Pill text={o.status}/></td><td><Link className="smallbtn" to={`/receipt/${storeId}/${o.id}`}>Open</Link></td></tr>)}</Table>{!rows.length&&<Empty title="No sales yet"/>}</Card>}
function QrCodes({storeId,branchId,name,products}:{storeId:string;branchId:string;name:string;products:Product[]}){const url=`${window.location.origin}/shop/${storeId}/${branchId}`;const kiosk=`${window.location.origin}/kiosk/${storeId}/${branchId}`;return <><Card title="Store QR codes" info="Print these codes and place them at your shop or self-service kiosk."><div className="qr-grid"><div className="qr-box"><QRCodeSVG value={url} size={165}/><h3>Mobile Scan & Go</h3><p>{name}</p><button className="btn btn-outline" onClick={()=>window.print()}><Printer size={16}/> Print</button></div><div className="qr-box"><QRCodeSVG value={kiosk} size={165}/><h3>Touchscreen kiosk</h3><p>{name}</p><button className="btn btn-outline" onClick={()=>window.print()}><Printer size={16}/> Print</button></div></div></Card><Card title="Product scan codes" info="Each QR opens this store on the shopper's phone with the product already in their cart."><div className="qr-grid">{products.filter(p=>p.active).map(p=><div className="qr-box" key={p.id}><QRCodeSVG value={productLink(window.location.origin,storeId,branchId,p.id)} size={120}/><h3>{p.name}</h3><small>{p.barcode||p.id}</small></div>)}</div>{!products.length&&<Empty title="Add your first product to generate codes"/>}<button className="btn btn-outline" type="button" onClick={()=>window.print()}><Printer size={16}/> Print scan codes</button></Card></>}
function Report({orders,products,stock}:{orders:Order[];products:Product[];stock:Inventory[]}) {
 const paid=orders.filter(o=>o.status==='paid'||o.status==='refunded');
 const completed=paid.filter(o=>o.status==='paid');
 const sales=completed.reduce((a,o)=>a+o.totalCents,0);
 const counts=new Map<string,{name:string;units:number;value:number}>();
 completed.forEach(o=>o.items.forEach(i=>{const prev=counts.get(i.productId)||{name:i.name,units:0,value:0};counts.set(i.productId,{name:i.name,units:prev.units+i.quantity,value:prev.value+i.lineCents})}));
 const topProducts=[...counts.values()].sort((a,b)=>b.units-a.units).slice(0,7);
 const productMax=Math.max(...topProducts.map(p=>p.units),1);
 const now=new Date(), daily=Array.from({length:14},(_,offset)=>{const date=new Date(now);date.setHours(0,0,0,0);date.setDate(date.getDate()-13+offset);const key=date.toISOString().slice(0,10);return {key,label:date.toLocaleDateString(undefined,{month:'short',day:'numeric'}),sales:0,orders:0}});
 completed.forEach(o=>{const key=new Date(o.createdAt||now).toISOString().slice(0,10);const day=daily.find(d=>d.key===key);if(day){day.sales+=o.totalCents;day.orders++}});
 const salesMax=Math.max(...daily.map(d=>d.sales),1),orderMax=Math.max(...daily.map(d=>d.orders),1);
 const hours=Array.from({length:24},(_,hour)=>({hour,orders:0,total:0}));
 completed.forEach(o=>{const hour=new Date(o.createdAt||now).getHours();hours[hour].orders++;hours[hour].total+=o.totalCents});
 const busyHours=hours.filter(h=>h.hour>=6&&h.hour<=22).sort((a,b)=>b.orders-a.orders).slice(0,6).sort((a,b)=>a.hour-b.hour),hourMax=Math.max(...busyHours.map(h=>h.orders),1);
 return <>
  <div className="metrics-grid"><Stat label="Recorded checkout totals" value={money(sales)}/><Stat label="Completed orders" value={completed.length}/><Stat label="Pending cash" value={orders.filter(o=>o.status==='pending_cash').length}/><Stat label="Low-stock items" value={stock.filter(i=>i.quantity<=(i.lowStock??5)).length}/></div>
  <div className="analytics-grid">
   <Card title="Sales trend" info="Completed sales over the last 14 days."><div className="daily-chart" role="img" aria-label="Daily completed sales chart">{daily.map(d=><div className="daily-column" key={d.key} title={`${d.label}: ${money(d.sales)} across ${d.orders} orders`}><div className="daily-bars"><span style={{height:`${d.sales/salesMax*100}%`}}/><small style={{height:`${d.orders/orderMax*100}%`}}/></div><span>{d.label}</span></div>)}</div><div className="chart-legend"><span><i className="sales-key"/> Sales</span><span><i className="orders-key"/> Order count</span></div></Card>
   <Card title="Busiest hours" info="Completed checkouts by time of day."><div className="bar-chart">{busyHours.map(h=><div className="chart-row" key={h.hour}><span>{String(h.hour).padStart(2,'0')}:00</span><div><i style={{width:`${h.orders/hourMax*100}%`}}/></div><b>{h.orders}</b></div>)}</div>{!busyHours.length&&<Empty title="No checkout activity yet"/>}</Card>
  </div>
  <Card title="Top products" info="Ranked by units sold in completed checkouts."><div className="product-chart">{topProducts.map(p=><div className="chart-row product-chart-row" key={p.name}><span>{p.name}</span><div><i style={{width:`${p.units/productMax*100}%`}}/></div><b>{p.units} sold</b></div>)}</div>{!topProducts.length&&<Empty title="No product sales yet"/>}</Card>
  <Card title="Best selling products" info="Sales value and units from stored completed checkout records."><Table columns={['Product','Sold units','Value']}>{[...counts.values()].sort((a,b)=>b.units-a.units).map(p=><tr key={p.name}><td>{p.name}</td><td>{p.units}</td><td>{money(p.value)}</td></tr>)}</Table>{!counts.size&&<Empty title="No sales records yet"/>}</Card>
  <Card title="Products in this store">{products.length} products registered</Card>
 </>}
function StoreSettings({store,busy,run}:{store:Business;busy:boolean;run:Run}){const[name,setName]=useState(store.name),[currency,setCurrency]=useState(['USD','ZIG'].includes(store.currency||'')?store.currency||'USD':'USD'),[zig,setZig]=useState(String(store.rates?.ZIG||1)),[address,setAddress]=useState(store.address||''),[phone,setPhone]=useState(store.phone||''),[taxNumber,setTaxNumber]=useState(store.taxNumber||''),[vatRate,setVatRate]=useState(String(store.vatRate||0)),[footer,setFooter]=useState(store.receiptFooter||'');useEffect(()=>{setName(store.name);setCurrency(['USD','ZIG'].includes(store.currency||'')?store.currency||'USD':'USD');setZig(String(store.rates?.ZIG||1));setAddress(store.address||'');setPhone(store.phone||'');setTaxNumber(store.taxNumber||'');setVatRate(String(store.vatRate||0));setFooter(store.receiptFooter||'')},[store.id]);return <Card title="Store settings" info={`Profile: ${profileLabel(store.profile)}. These settings affect receipts and checkout totals.`}><form className="form-grid" onSubmit={e=>{e.preventDefault();void run('updateBusiness',{businessId:store.id,name,currency,rates:{USD:1,ZIG:Number(zig)},address,phone,taxNumber,vatRate:Number(vatRate),receiptFooter:footer},'Settings saved')}}><Input label="Store name" value={name} onChange={setName}/><Dropdown label="Default currency" value={currency} onChange={setCurrency} items={['USD','ZIG'].map(v=>({id:v,name:v}))}/><Input label="ZiG per USD (store-defined)" value={zig} onChange={setZig} type="number" min="0"/><Input label="Business address" value={address} onChange={setAddress}/><Input label="Business phone" value={phone} onChange={setPhone}/><Input label="Tax number" value={taxNumber} onChange={setTaxNumber}/><Input label="VAT / sales tax rate (%)" value={vatRate} onChange={setVatRate} type="number" min="0"/><Input label="Receipt footer message" value={footer} onChange={setFooter}/><div className="form-actions"><button className="btn btn-primary" disabled={busy}>Save settings</button></div></form></Card>}
