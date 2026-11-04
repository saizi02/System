/** Server validates all requests, recalculates amounts and commits PostgreSQL transactions. */
export async function apiRequest<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'include',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const payload=await response.json().catch(()=>({error:'Unexpected response from API'}));
 if(!response.ok)throw new Error(payload.error||`API returned ${response.status}`);return payload as T;
}
export async function call<T=unknown>(name:string,input:Record<string,unknown>={}):Promise<T>{return apiRequest<T>(`/actions/${encodeURIComponent(name)}`,input)}
export async function uploadProductImage(businessId:string,file:File):Promise<string>{const form=new FormData();form.set('image',file);const res=await fetch(`/api/uploads/${encodeURIComponent(businessId)}`,{method:'POST',credentials:'include',body:form});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||'Upload failed');return data.url}
