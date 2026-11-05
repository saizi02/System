import {Navigate,Route,Routes,useLocation,useParams} from 'react-router-dom';
import {homeFor} from './lib/types';
import {StationGate} from './components/StationAuth';
import Kitchen from './pages/Kitchen';
import KioskApp from './pages/KioskApp';
import {useSession} from './lib/auth';
import Directory from './pages/Directory';import {useConfig} from './lib/config';
import Login from './pages/Login';
import Shop from './pages/Shop';
import Receipt from './pages/Receipt';
import Admin from './pages/Admin';
import Cashier from './pages/Cashier';
import ChangePassword from './pages/ChangePassword';
import ErrorBoundary from './components/ErrorBoundary';
/** In single-store installs customers go straight to their store; shared servers show the store list. */
function Home(){const{config,ready}=useConfig(),s=useSession();if(!ready)return <div className="loading">Loading…</div>;const st=config.store;if(config.storeMode==='single'&&st&&st.branches.length===1&&!s.role)return <Navigate to={`/shop/${st.id}/${st.branches[0].id}`} replace/>;return <Directory/>}
function CustomerShop({mode}:{mode:'mobile'|'kiosk'}){const {businessId,branchId}=useParams();return <Shop key={`${mode}-${businessId}-${branchId}`} mode={mode}/>}
export default function App(){const s=useSession(),where=useLocation();if(s.loading)return <div className="loading">Connecting to the Tillora PostgreSQL API…</div>;if(s.connectionError)return <main className="setup-screen"><h1>Backend connection required</h1><p>{s.connectionError}</p><p>Run <code>npm run api:dev</code> in another VS Code terminal, then reload this page.</p><button className="btn btn-primary" onClick={()=>window.location.reload()}>Reconnect</button></main>;if(s.mustChangePassword&&where.pathname!=='/change-password')return <Navigate to="/change-password" replace/>;
 return <ErrorBoundary><Routes>
 <Route path="/" element={<Home/>}/>
 <Route path="/login" element={<Login/>}/>
 <Route path="/staff-login" element={<Navigate to="/login" replace/>}/>
 <Route path="/change-password" element={<ChangePassword/>}/>
 <Route path="/shop/:businessId/:branchId" element={<CustomerShop mode="mobile"/>}/>
 <Route path="/kiosk" element={<KioskApp/>}/>
 <Route path="/kiosk/:businessId/:branchId" element={<CustomerShop mode="kiosk"/>}/>
 <Route path="/receipt/:businessId/:orderId" element={<Receipt/>}/>
 {/* Three stand-alone dashboards: each has its own address and its own sign-in, and all talk to the same API + PostgreSQL database. */}
 <Route path="/admin" element={<StationGate portal="admin"><Admin/></StationGate>}/>
 <Route path="/super-admin" element={<Navigate to="/admin" replace/>}/>
 <Route path="/business-admin" element={<Navigate to="/admin" replace/>}/>
 <Route path="/cashier" element={<StationGate portal="cashier"><Cashier/></StationGate>}/>
 <Route path="/kitchen" element={<StationGate portal="kitchen"><Kitchen/></StationGate>}/>
 <Route path="/dashboard" element={<Navigate to={homeFor(s.role)} replace/>}/>
 <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></ErrorBoundary>;
}
