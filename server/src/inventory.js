/** Smart-inventory maths. Pure functions, so they can be tested without a database. */
export const SOLD_WINDOW_DAYS=14;
export const EXPIRY_WARN_DAYS=14;
export const LOW_COVER_DAYS=7;
const PRIORITY={out:0,low:1,expired:2,reorder_soon:3,expiring:4,slow:5,ok:6};

/** One inventory row plus its recent sales -> a status, days of stock left and a suggested order. */
export function assess(row,coverDays=14){
 const quantity=Number(row.quantity)||0,low=Number(row.low_stock)||0,u14=Number(row.u14)||0,u30=Number(row.u30)||0;
 const avgDaily=u14/SOLD_WINDOW_DAYS;
 const daysLeft=quantity===0?0:avgDaily>0?Math.round((quantity/avgDaily)*10)/10:null;
 let suggested=Math.max(0,Math.ceil(avgDaily*coverDays)-quantity);
 if(suggested===0&&quantity<=low)suggested=Math.max(1,low*2-quantity);
 const expiryDays=row.expiry_days===null||row.expiry_days===undefined?null:Number(row.expiry_days);
 let status='ok';
 if(quantity===0)status='out';
 else if(quantity<=low)status='low';
 else if(expiryDays!==null&&expiryDays<0)status='expired';
 else if(daysLeft!==null&&daysLeft<=LOW_COVER_DAYS)status='reorder_soon';
 else if(expiryDays!==null&&expiryDays<=EXPIRY_WARN_DAYS)status='expiring';
 else if(u30===0)status='slow';
 return{status,avgDaily:Math.round(avgDaily*100)/100,daysLeft,suggested:status==='ok'||status==='slow'?0:suggested,expiryDays};
}

export function buildInsights(rows,coverDays=14){
 const cover=Math.min(90,Math.max(1,Math.trunc(Number(coverDays))||14));
 const items=rows.map(r=>{
  const a=assess(r,cover);
  const variants=Array.isArray(r.variants)?r.variants:[];
  return{productId:r.product_id,variantId:r.variant_id,name:r.name,variantName:variants.find(v=>v.id===r.variant_id)?.name||'Standard',
   quantity:Number(r.quantity)||0,lowStock:Number(r.low_stock)||0,sold14:Number(r.u14)||0,sold30:Number(r.u30)||0,expiry:r.expiry||null,...a};
 }).sort((x,y)=>PRIORITY[x.status]-PRIORITY[y.status]||(x.daysLeft??1e9)-(y.daysLeft??1e9)||x.name.localeCompare(y.name));
 const count=s=>items.filter(i=>i.status===s).length;
 return{coverDays:cover,windowDays:SOLD_WINDOW_DAYS,generatedAt:new Date().toISOString(),
  summary:{out:count('out'),low:count('low'),reorderSoon:count('reorder_soon'),expiring:count('expiring'),expired:count('expired'),slow:count('slow'),total:items.length},items};
}
