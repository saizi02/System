import {sql} from './db.js';
import {authorize,assert,HttpError} from './helpers.js';
import {config} from './config.js';import {csv} from './csv.js';import {buildInsights} from './inventory.js';
const isDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
const uuid=v=>/^[0-9a-f-]{36}$/i.test(String(v||''));
function scopeOf(q){assert(uuid(q.businessId)&&uuid(q.branchId),400,'businessId and branchId are required');return{businessId:q.businessId,branchId:q.branchId}}
const DAY=`created_at >= ($3::date)::timestamp AT TIME ZONE $4 AND created_at < (($3::date)+1)::timestamp AT TIME ZONE $4`;
/** End-of-day close-out for one branch: what was sold, how it was paid, what cash is still unconfirmed. */
export async function closeout(actor,q){
 const{businessId,branchId}=scopeOf(q);authorize(actor,['cashier'],businessId,branchId);
 const date=isDate(q.date)?q.date:new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone}).format(new Date());
 const args=[businessId,branchId,date,config.timezone];
 const base=`FROM orders WHERE business_id=$1 AND branch_id=$2 AND ${DAY}`;
 const [status,byMethod,bySource,byCurrency,kiosks,items,low,hourly]=await Promise.all([
  sql(`SELECT status,count(*)::int n,coalesce(sum(total_cents),0)::bigint cents ${base} GROUP BY status`,args),
  sql(`SELECT method,count(*)::int n,coalesce(sum(total_cents),0)::bigint cents ${base} AND status='paid' GROUP BY method ORDER BY method`,args),
  sql(`SELECT source,count(*)::int n,coalesce(sum(total_cents),0)::bigint cents ${base} AND status='paid' GROUP BY source ORDER BY source`,args),
  sql(`SELECT currency,method,count(*)::int n,coalesce(sum(total_minor),0)::bigint minor ${base} AND status='paid' GROUP BY currency,method ORDER BY currency,method`,args),
  sql(`SELECT coalesce(kiosk_name,'—') name,count(*)::int n,coalesce(sum(total_cents),0)::bigint cents ${base} AND status='paid' AND source='kiosk' GROUP BY 1 ORDER BY 1`,args),
  sql(`SELECT COALESCE(i->>'name','Unknown item') name,COALESCE(sum(GREATEST(COALESCE(NULLIF(i->>'quantity','')::int,0),0)),0)::int units,COALESCE(sum(GREATEST(COALESCE(NULLIF(i->>'lineCents','')::bigint,NULLIF(i->>'line_cents','')::bigint,0),0)),0)::bigint cents FROM orders o CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.items)='array' THEN o.items ELSE '[]'::jsonb END) i WHERE o.business_id=$1 AND o.branch_id=$2 AND o.${DAY} AND o.status='paid' GROUP BY 1 ORDER BY cents DESC LIMIT 15`,args),
  sql(`SELECT p.name,i.variant_id,i.quantity,i.low_stock FROM inventory i JOIN products p ON p.id=i.product_id WHERE i.business_id=$1 AND i.branch_id=$2 AND i.quantity<=i.low_stock AND p.active ORDER BY i.quantity,p.name LIMIT 30`,[businessId,branchId]),
  sql(`SELECT to_char(created_at AT TIME ZONE $4,'HH24') hour,count(*)::int n,coalesce(sum(total_cents),0)::bigint cents ${base} AND status='paid' GROUP BY 1 ORDER BY 1`,args)
 ]);
 const num=r=>r.map(x=>({...x,cents:x.cents===undefined?undefined:Number(x.cents),minor:x.minor===undefined?undefined:Number(x.minor)}));
 const st=Object.fromEntries(num(status.rows).map(r=>[r.status,r]));
 return{date,timezone:config.timezone,
  paid:{count:st.paid?.n||0,totalCents:st.paid?.cents||0},
  pendingCash:{count:st.pending_cash?.n||0,totalCents:st.pending_cash?.cents||0},
  failed:st.failed?.n||0,cancelled:st.cancelled?.n||0,
  byMethod:num(byMethod.rows),bySource:num(bySource.rows),byCurrency:num(byCurrency.rows),kiosks:num(kiosks.rows),
  topItems:num(items.rows),lowStock:low.rows,hourly:num(hourly.rows)}
}
export async function salesCsv(actor,q){
 const{businessId,branchId}=scopeOf(q);authorize(actor,['business_admin','super_admin'],businessId,branchId);
 assert(isDate(q.from)&&isDate(q.to),400,'from and to dates (YYYY-MM-DD) are required');
 const days=(new Date(q.to)-new Date(q.from))/86400000;assert(days>=0&&days<=366,400,'Choose a range of at most one year');
 const r=await sql(`SELECT id,created_at,source,kiosk_name,method,status,currency,total_minor,total_cents,rate,payment_reference,items FROM orders WHERE business_id=$1 AND branch_id=$2 AND created_at >= ($3::date)::timestamp AT TIME ZONE $5 AND created_at < (($4::date)+1)::timestamp AT TIME ZONE $5 ORDER BY created_at LIMIT 100000`,[businessId,branchId,q.from,q.to,config.timezone]);
 return csv(['Order','Date and time','Where','Kiosk','Method','Status','Currency','Total (currency)','Total (USD)','Rate','Payment reference','Items'],r.rows.map(o=>[o.id,new Date(o.created_at).toISOString(),o.source,o.kiosk_name,o.method,o.status,o.currency,(o.total_minor/100).toFixed(2),(o.total_cents/100).toFixed(2),o.rate,o.payment_reference,o.items.map(i=>`${i.quantity} x ${i.name}${i.variantName&&i.variantName!=='Standard'?` (${i.variantName})`:''}`).join('; ')]))
}
export async function stockCsv(actor,q){
 const{businessId,branchId}=scopeOf(q);authorize(actor,['business_admin','super_admin'],businessId,branchId);
 const r=await sql(`SELECT p.name,p.category,p.barcode,p.price_cents,p.variants,p.active,i.variant_id,i.quantity,i.low_stock FROM inventory i JOIN products p ON p.id=i.product_id WHERE i.business_id=$1 AND i.branch_id=$2 ORDER BY p.name`,[businessId,branchId]);
 return csv(['Product','Category','Barcode','Variant','Price (USD)','In stock','Low-stock alert at','Status','Active'],r.rows.map(x=>[x.name,x.category,x.barcode,x.variants.find(v=>v.id===x.variant_id)?.name||x.variant_id,(x.price_cents/100).toFixed(2),x.quantity,x.low_stock,x.quantity<=x.low_stock?'LOW':'ok',x.active?'yes':'no']))
}
/** Smart inventory: days of stock left, reorder suggestions, slow movers and expiry warnings for one branch. */
export async function inventoryInsights(actor,q){
 const{businessId,branchId}=scopeOf(q);authorize(actor,['business_admin','super_admin'],businessId,branchId);
 const r=await sql(`WITH sold AS (
   SELECT i->>'productId' pid,i->>'variantId' vid,
    COALESCE(sum(GREATEST(COALESCE(NULLIF(i->>'quantity','')::int,0),0)) FILTER (WHERE o.created_at>=now()-interval '14 days'),0)::int u14,
    COALESCE(sum(GREATEST(COALESCE(NULLIF(i->>'quantity','')::int,0),0)),0)::int u30
   FROM orders o CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.items)='array' THEN o.items ELSE '[]'::jsonb END) i
   WHERE o.business_id=$1 AND o.branch_id=$2 AND o.status='paid' AND o.created_at>=now()-interval '30 days' GROUP BY 1,2)
  SELECT i.product_id,i.variant_id,p.name,p.variants,i.quantity,i.low_stock,to_char(i.expiry_date,'YYYY-MM-DD') AS expiry,(i.expiry_date-CURRENT_DATE)::int AS expiry_days,COALESCE(s.u14,0) u14,COALESCE(s.u30,0) u30
  FROM inventory i JOIN products p ON p.id=i.product_id LEFT JOIN sold s ON s.pid=i.product_id::text AND s.vid=i.variant_id
  WHERE i.business_id=$1 AND i.branch_id=$2 AND p.active`,[businessId,branchId]);
 return buildInsights(r.rows,q.coverDays);
}
