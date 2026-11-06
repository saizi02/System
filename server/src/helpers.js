import {randomBytes,createHash} from 'node:crypto';
export const makeId=()=>randomBytes(16).toString('hex');
export const tokenHash=value=>createHash('sha256').update(value).digest('hex');
export class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
export function required(value,name,max=120){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new HttpError(400,`Invalid ${name}`);return value.trim()}
export function integer(value,name,min=0,max=1000000){if(!Number.isSafeInteger(value)||value<min||value>max)throw new HttpError(400,`Invalid ${name}`);return value}
export function assert(condition,status,message){if(!condition)throw new HttpError(status,message)}

/* ───────── Roles ─────────
 * super_admin    Platform owner. Registers stores, creates every kind of account, sees all stores and the system activity log.
 * business_admin "General Admin". Runs ONE store: catalogue, stock, reports, settings, and its own Cashier / Kitchen staff.
 * cashier        Cashier station: cash confirmation, assisted POS, handover/collection.
 * kitchen        Kitchen display (Food stores only): New → Preparing → Ready.
 * exit_verifier  Grocery exit: scan and verify paid receipts.
 */
export const ROLES=['super_admin','business_admin','cashier','kitchen','exit_verifier'];
export const ROLE_LABELS={super_admin:'Super Admin',business_admin:'General Admin',cashier:'Cashier',kitchen:'Kitchen',exit_verifier:'Exit Verifier'};
export const BRANCH_BOUND=['cashier','kitchen','exit_verifier'];
export const isBranchBound=role=>BRANCH_BOUND.includes(role);
/** Each role may sign in only through its own standalone portal. */
export const PORTALS={
 admin:{label:'Admin console',roles:['super_admin','business_admin']},
 cashier:{label:'Cashier station',roles:['cashier']},
 kitchen:{label:'Kitchen display',roles:['kitchen']},
 exit:{label:'Exit verification station',roles:['exit_verifier']}
};
/** Can `actor` administer the `target` staff account? */
export function canManage(actor,target){
 if(!actor||!target)return false;
 if(actor.role==='super_admin')return true;
 return actor.role==='business_admin'&&['cashier','kitchen','exit_verifier'].includes(target.role)&&!!actor.business_id&&target.business_id===actor.business_id;
}
export function strongPassword(value){
 const p=typeof value==='string'?value:'';
 assert(p.length>=12&&p.length<=128&&/[A-Z]/.test(p)&&/[a-z]/.test(p)&&/[0-9]/.test(p),400,'Password must be 12–128 characters and include uppercase, lowercase and a number');
 return p;
}
export const NEXT_FULFILLMENT={new:'preparing',preparing:'ready',ready:'collected'};
/** Who may move an order from one fulfilment step to the next. Food: Kitchen prepares, Cashier hands over. Fashion: Cashier does all steps. */
export function canAdvance(profile,role,from,to){
 if(NEXT_FULFILLMENT[from]!==to)return false;
 if(profile==='food'){if(role==='kitchen')return to==='preparing'||to==='ready';if(role==='cashier')return to==='collected';return false}
 if(profile==='clothing')return role==='cashier';
 return false;
}
export const publicStaff=a=>a?{uid:a.id,email:a.email,role:a.role,displayName:a.display_name||'',businessId:a.business_id||undefined,branchId:a.branch_id||undefined,mustChangePassword:a.must_change_password,disabled:a.disabled}:null;
export function authorize(actor,roles,store=null,branch=null){assert(actor&&roles.includes(actor.role),403,'Staff permissions required');assert(!actor.disabled,403,'Account disabled');assert(!actor.must_change_password,403,'Change your temporary password first');if(actor.role!=='super_admin'){if(store)assert(actor.business_id===store,403,'Different business');if(isBranchBound(actor.role)&&branch)assert(actor.branch_id===branch,403,'Different branch')}}
export function cartItems(items){assert(Array.isArray(items)&&items.length>0&&items.length<=40,400,'Cart must contain 1–40 items');const seen=new Set();return items.map(x=>{const productId=required(x.productId,'product ID',80),variantId=required(x.variantId,'variant ID',80);const quantity=integer(x.quantity,'quantity',1,30);const key=productId+':'+variantId;assert(!seen.has(key),400,'Duplicate cart item');seen.add(key);return{productId,variantId,quantity}})}
export function options(profile,method,input,outcome){const paymentOutcome=outcome||(method==='cash'?'pending':input.demoOutcome==='declined'?'declined':'approved');const serviceType=profile==='food'?(input.serviceType==='dine_in'?'dine_in':'takeaway'):null;const note=String(input.orderNote||'').trim();assert(note.length<=200,400,'Notes too long');return{paymentOutcome,serviceType,orderNote:note}}
