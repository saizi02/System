import {useCallback,useEffect,useState} from 'react';
import {Download,Printer,RefreshCw} from 'lucide-react';
import {apiRequest} from '../lib/api';
import {money} from '../lib/types';
type Row={cents?:number;minor?:number;n:number};
type Report={date:string;timezone:string;paid:{count:number;totalCents:number};pendingCash:{count:number;totalCents:number};failed:number;cancelled:number;byMethod:(Row&{method:string})[];bySource:(Row&{source:string})[];byCurrency:(Row&{currency:string;method:string})[];kiosks:(Row&{name:string})[];topItems:{name:string;units:number;cents:number}[];lowStock:{name:string;variant_id:string;quantity:number;low_stock:number}[];hourly:(Row&{hour:string})[]};
const today=()=>new Date().toLocaleDateString('en-CA');
const where=(s:string)=>s==='kiosk'?'Self-service kiosk':s==='pos'?'Cashier till':'Customer phone';
/** End-of-day close-out for one branch, printable. Admins also get CSV exports. */
export default function DayReport({businessId,branchId,branchName,canExport}:{businessId:string;branchId:string;branchName?:string;canExport:boolean}){
 const[date,setDate]=useState(today()),[data,setData]=useState<Report|null>(null),[error,setError]=useState(''),[from,setFrom]=useState(today()),[to,setTo]=useState(today());
 const load=useCallback(()=>{setError('');apiRequest<Report>(`/reports/closeout?businessId=${businessId}&branchId=${branchId}&date=${date}`).then(setData).catch(e=>setError((e as Error).message))},[businessId,branchId,date]);
 useEffect(()=>{load();if(date!==today())return;const t=setInterval(load,30000);return()=>clearInterval(t)},[load,date]);
 const q=`businessId=${businessId}&branchId=${branchId}`;
 return <section className="panel day-report">
  <div className="panel-head"><div><h2>End-of-day report</h2><p>{branchName||'This location'} · sales, payment types and cash still to confirm</p></div>
   <div className="report-tools no-print"><input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value||today())} aria-label="Report date"/><button className="btn btn-outline" onClick={load}><RefreshCw size={16}/> Refresh</button><button className="btn btn-primary" onClick={()=>window.print()}><Printer size={16}/> Print</button></div></div>
  {error&&<p className="error" role="alert">{error}</p>}
  {data&&<>
   <p className="report-date">{new Date(data.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · {data.timezone}</p>
   <div className="metrics-grid"><div className="metric"><span>Paid orders</span><strong>{data.paid.count}</strong></div><div className="metric"><span>Sales (USD)</span><strong>{money(data.paid.totalCents)}</strong></div><div className={'metric'+(data.pendingCash.count?' warn':'')}><span>Cash still to confirm</span><strong>{data.pendingCash.count}</strong><small>{money(data.pendingCash.totalCents)}</small></div><div className="metric"><span>Failed / cancelled</span><strong>{data.failed} / {data.cancelled}</strong></div></div>
   <div className="report-cols">
    <div><h3>By payment type</h3><table><tbody>{data.byMethod.map(r=><tr key={r.method}><td>{r.method}</td><td>{r.n}</td><td>{money(r.cents||0)}</td></tr>)}{!data.byMethod.length&&<tr><td colSpan={3} className="muted">No paid orders</td></tr>}</tbody></table>
     <h3>Takings in the customer's currency</h3><table><tbody>{data.byCurrency.map(r=><tr key={r.currency+r.method}><td>{r.currency} · {r.method}</td><td>{r.n}</td><td>{money(r.minor||0,r.currency)}</td></tr>)}{!data.byCurrency.length&&<tr><td colSpan={3} className="muted">—</td></tr>}</tbody></table></div>
    <div><h3>By where it was sold</h3><table><tbody>{data.bySource.map(r=><tr key={r.source}><td>{where(r.source)}</td><td>{r.n}</td><td>{money(r.cents||0)}</td></tr>)}{!data.bySource.length&&<tr><td colSpan={3} className="muted">—</td></tr>}</tbody></table>
     {data.kiosks.length>0&&<><h3>By kiosk</h3><table><tbody>{data.kiosks.map(r=><tr key={r.name}><td>{r.name}</td><td>{r.n}</td><td>{money(r.cents||0)}</td></tr>)}</tbody></table></>}</div>
   </div>
   <h3>Best sellers</h3><table><thead><tr><th>Item</th><th>Units</th><th>Sales</th></tr></thead><tbody>{data.topItems.map(r=><tr key={r.name}><td>{r.name}</td><td>{r.units}</td><td>{money(r.cents)}</td></tr>)}{!data.topItems.length&&<tr><td colSpan={3} className="muted">No sales on this day</td></tr>}</tbody></table>
   {data.lowStock.length>0&&<><h3>Running low</h3><table><thead><tr><th>Item</th><th>In stock</th><th>Alert at</th></tr></thead><tbody>{data.lowStock.map(r=><tr key={r.name+r.variant_id}><td>{r.name}{r.variant_id!=='default'?` (${r.variant_id})`:''}</td><td>{r.quantity}</td><td>{r.low_stock}</td></tr>)}</tbody></table></>}
   <p className="report-sign">Cashier signature: ______________________ &nbsp; Manager: ______________________</p>
  </>}
  {canExport&&<div className="report-export no-print"><h3>Exports for your accountant</h3>
   <div className="scanner-row"><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><a className="btn btn-outline" href={`/api/export/sales.csv?${q}&from=${from}&to=${to}`}><Download size={16}/> Sales (CSV)</a><a className="btn btn-outline" href={`/api/export/stock.csv?${q}`}><Download size={16}/> Stock levels (CSV)</a></div></div>}
 </section>
}
