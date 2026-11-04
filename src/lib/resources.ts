/** API read-resource descriptors. All reads are served by Express + PostgreSQL. */
export type Resource={path:string;filter?:{field:string;value:string}};
export const listResource=(...parts:string[]):Resource=>({path:parts.join('/')});
export const detailResource=(...parts:string[]):Resource=>({path:parts.join('/')});
export const equals=(field:string,value:unknown)=>({field,value:String(value)});
export const filterResource=(resource:Resource,filter:{field:string;value:string}):Resource=>({...resource,filter});
export async function readResource(ref:Resource,signal?:AbortSignal){
 const qs=new URLSearchParams({path:ref.path});
 if(ref.filter){qs.set('field',ref.filter.field);qs.set('value',ref.filter.value)}
 const response=await fetch('/api/data?'+qs.toString(),{credentials:'include',signal});
 const value=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(value.error||'Unable to load data');
 return value.items as unknown[];
}
