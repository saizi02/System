import {sql} from './db.js';
import {HttpError,authorize,assert,isBranchBound} from './helpers.js';
const camel=s=>s.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
export function format(row){if(!row)return null;const result={};for(const [k,v] of Object.entries(row))result[camel(k)]=v;if('productId'in result&&'variantId'in result)result.id=`${result.productId}_${result.variantId}`;if('id'in result&&'role'in result)result.uid=result.id;return result}
const cols={businesses:'id,name,profile,status,domain,currency,rates,address,phone,tax_number,receipt_footer,vat_rate,created_at,updated_at',branches:'id,business_id,name,active,created_at',products:'id,business_id,name,category,price_cents,barcode,image,description,active,variants,updated_at',inventory:'business_id,branch_id,product_id,variant_id,quantity,low_stock,updated_at',orders:'id,business_id,branch_id,customer_uid,items,total_cents,currency,rate,total_minor,method,payment_simulated,payment_outcome,service_type,order_note,status,fulfillment,source,exit_verified,reprints,handled_by,kiosk_name,adjustment_reason,adjusted_by,adjusted_at,created_at,updated_at',sessions:'id,business_id,branch_id,customer_uid,count,status,updated_at',flags:'id,business_id,branch_id,order_id,type,created_at',staff:'id,email,role,business_id,branch_id,disabled,must_change_password,display_name,created_at,last_login_at,created_by',suppliers:'id,business_id,name,contact_name,email,phone,address,active,created_at,updated_at',purchaseOrders:'id,business_id,branch_id,supplier_id,reference,status,lines,notes,received_at,created_by,created_at,updated_at'};
export async function getData(path,viewer,query={}){
 const p=path.split('/').filter(Boolean);assert(p.length<=5,400,'Invalid resource path');let rows;
 if(p.length===1&&p[0]==='businesses'){
  if(viewer?.role==='super_admin')rows=(await sql(`SELECT ${cols.businesses} FROM businesses ORDER BY created_at DESC`)).rows;
  else if(viewer?.business_id){rows=(await sql(`SELECT ${cols.businesses} FROM businesses WHERE id=$1`,[viewer.business_id])).rows;}
  else rows=(await sql(`SELECT ${cols.businesses} FROM businesses WHERE status='active' ORDER BY name`)).rows;
 }
 else if(p.length===2&&p[0]==='businesses'){
  const id=p[1];rows=(await sql(`SELECT ${cols.businesses} FROM businesses WHERE id=$1${viewer?'':" AND status='active'"}`,[id])).rows;
  if(viewer?.role!=='super_admin'&&viewer?.business_id!==id&&rows[0]?.status!=='active')rows=[];
 }
 else if(p.length===1&&p[0]==='staff'){
  authorize(viewer,['super_admin']);rows=(await sql(`SELECT ${cols.staff} FROM staff ORDER BY created_at DESC`)).rows;
 }
 else if(p.length===1&&p[0]==='audit'){
  authorize(viewer,['super_admin']);rows=(await sql('SELECT a.id,a.business_id,a.actor_id,a.action,a.details,a.created_at,s.email AS actor_email,s.role AS actor_role FROM audit_logs a LEFT JOIN staff s ON s.id=a.actor_id ORDER BY a.created_at DESC LIMIT 250')).rows;
 }
 else if(p[0]==='businesses'&&p.length>=3){
  const id=p[1],kind=p[2],child=p[3];
  const privileged=viewer?.role==='super_admin'||viewer?.business_id===id;
  if(!privileged){const active=await sql("SELECT id FROM businesses WHERE id=$1 AND status='active'",[id]);assert(active.rowCount>0,404,'Active store not found');}
  if(kind==='branches'){
   if(p.length===3)rows=(await sql(`SELECT ${cols.branches} FROM branches WHERE business_id=$1${privileged?'':' AND active=true'}${isBranchBound(viewer?.role)?' AND id=$2':''} ORDER BY name`,isBranchBound(viewer?.role)?[id,viewer.branch_id]:[id])).rows;
   else if(p.length===4){if(isBranchBound(viewer?.role))assert(viewer.branch_id===child,403,'Different branch');rows=(await sql(`SELECT ${cols.branches} FROM branches WHERE business_id=$1 AND id=$2${privileged?'':' AND active=true'}`,[id,child])).rows;}
  }
  else if(kind==='products'){
   if(p.length===3)rows=(await sql(`SELECT ${cols.products} FROM products WHERE business_id=$1${privileged?"":" AND active=true"} ORDER BY name`,[id])).rows;
   else if(p.length===4)rows=(await sql(`SELECT ${cols.products} FROM products WHERE business_id=$1 AND id=$2${privileged?'':' AND active=true'}`,[id,child])).rows;
  }
  else if(kind==='suppliers'){
   authorize(viewer,['super_admin','business_admin'],id);
   rows=(await sql(`SELECT ${cols.suppliers} FROM suppliers WHERE business_id=$1 ORDER BY name`,[id])).rows;
  }
  else if(kind==='purchase-orders'){
   authorize(viewer,['super_admin','business_admin'],id);
   rows=(await sql(`SELECT ${cols.purchaseOrders} FROM purchase_orders WHERE business_id=$1${isBranchBound(viewer.role)?' AND branch_id=$2':''} ORDER BY created_at DESC`,isBranchBound(viewer.role)?[id,viewer.branch_id]:[id])).rows;
  }
  else if(kind==='orders'){
   if(p.length===3){
    authorize(viewer,['super_admin','business_admin','cashier','kitchen'],id);const bound=isBranchBound(viewer.role),kitchen=viewer.role==='kitchen';
    // Kitchen staff only ever see paid food orders that still need work (plus the last 30 minutes of collected ones), without customer identifiers.
    rows=(await sql(`SELECT ${cols.orders} FROM orders WHERE business_id=$1${bound?' AND branch_id=$2':''}${kitchen?" AND status='paid' AND (fulfillment<>'collected' OR updated_at>now()-interval '30 minutes')":''} ORDER BY created_at DESC LIMIT 300`,bound?[id,viewer.branch_id]:[id])).rows;
    if(kitchen)rows=rows.map(r=>({...r,customer_uid:null,handled_by:null}));
   }
   else if(p.length===4){rows=(await sql(`SELECT ${cols.orders} FROM orders WHERE business_id=$1 AND id=$2`,[id,child])).rows;const o=rows[0];if(o)assert((viewer&&['super_admin','business_admin','cashier'].includes(viewer.role)&&(viewer.role==='super_admin'||viewer.business_id===id&&(viewer.role!=='cashier'||viewer.branch_id===o.branch_id)))||o.customer_uid===query.guestId,403,'Receipt does not belong to this session');}
  }
  else if(kind==='sessions'||kind==='flags'){
   assert(p.length===3,400,'Invalid resource path');authorize(viewer,['super_admin','business_admin','cashier'],id);const onlyBranch=isBranchBound(viewer.role);rows=(await sql(`SELECT ${cols[kind]} FROM ${kind==='sessions'?'shopping_sessions':'flags'} WHERE business_id=$1${onlyBranch?' AND branch_id=$2':''} ORDER BY ${kind==='sessions'?'updated_at':'created_at'} DESC LIMIT 300`,onlyBranch?[id,viewer.branch_id]:[id])).rows;
  }
  else if(kind==='kiosks'){
   assert(p.length===3,400,'Invalid resource path');authorize(viewer,['super_admin','business_admin','cashier'],id);const bound=isBranchBound(viewer.role);
   // Never exposes pairing codes or device tokens: only status information.
   rows=(await sql(`SELECT k.id,k.business_id,k.branch_id,k.name,k.enabled,k.state,k.last_seen,k.paired_at,k.created_at,(k.token_hash IS NULL) AS unpaired,(k.pairing_hash IS NOT NULL AND k.pairing_expires>now()) AS awaiting_pairing,CASE WHEN k.last_seen IS NULL THEN NULL ELSE extract(epoch from (now()-k.last_seen))::int END AS seconds_since_seen,b.name AS branch_name FROM kiosk_devices k JOIN branches b ON b.id=k.branch_id WHERE k.business_id=$1${bound?' AND k.branch_id=$2':''} ORDER BY k.name`,bound?[id,viewer.branch_id]:[id])).rows;
  }
  else if(kind==='staff'){
   assert(p.length===3,400,'Invalid resource path');authorize(viewer,['super_admin','business_admin'],id);
   rows=(await sql(`SELECT ${cols.staff} FROM staff WHERE business_id=$1 ORDER BY created_at DESC`,[id])).rows;
  }
  else if(kind==='audit'){
   assert(p.length===3,400,'Invalid resource path');authorize(viewer,['super_admin','business_admin'],id);
   rows=(await sql('SELECT a.id,a.business_id,a.actor_id,a.action,a.details,a.created_at,s.email AS actor_email,s.role AS actor_role FROM audit_logs a LEFT JOIN staff s ON s.id=a.actor_id WHERE a.business_id=$1 ORDER BY a.created_at DESC LIMIT 150',[id])).rows;
  }
  if(p.length===5&&kind==='branches'&&p[4]==='inventory'){
   if(isBranchBound(viewer?.role))assert(viewer.branch_id===child,403,'Different branch');
   if(!privileged){const br=await sql('SELECT id FROM branches WHERE business_id=$1 AND id=$2 AND active=true',[id,child]);assert(br.rowCount>0,404,'Active checkout location not found')}
   rows=(await sql(`SELECT ${cols.inventory} FROM inventory WHERE business_id=$1 AND branch_id=$2 ORDER BY updated_at DESC`,[id,child])).rows;
  }
 }
 if(!rows)throw new HttpError(404,'Resource path not found');
 // The public filter is enforced in SQL where possible; prevent privileged store listings being exposed via a query filter.
 const key=typeof query.field==='string'?query.field:'';const value=String(query.value||'');
 if(key){assert(['active','status','branchId'].includes(key),400,'Unsupported filter');rows=rows.filter(r=>String(r[key==='branchId'?'branch_id':key])===value);}
 return rows.map(format);
}
