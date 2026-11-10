import {config} from './config.js';
/** The shop's business day (YYYY-MM-DD) in the configured time zone; the pay number counter restarts each day. */
export const businessDay=(date=new Date())=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const value=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return `${value.year}-${value.month}-${value.day}`;
};
export const formatPayNumber=n=>String(n).padStart(4,'0');
/** Next per-branch daily pay number, inside the caller's transaction `c`. */
export async function nextPayNumber(c,businessId,branchId){
 const payDay=businessDay();
 const counter=(await c.query(`INSERT INTO cash_pay_number_counters(business_id,branch_id,business_day,last_number)
   VALUES($1,$2,$3,1) ON CONFLICT(business_id,branch_id,business_day) DO UPDATE SET last_number=cash_pay_number_counters.last_number+1 RETURNING last_number`,[businessId,branchId,payDay])).rows[0];
 return{payNumber:formatPayNumber(counter.last_number),payDay};
}
