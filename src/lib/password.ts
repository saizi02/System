export const passwordRules=[
 {id:'len',label:'At least 12 characters',test:(p:string)=>p.length>=12},
 {id:'up',label:'An uppercase letter',test:(p:string)=>/[A-Z]/.test(p)},
 {id:'low',label:'A lowercase letter',test:(p:string)=>/[a-z]/.test(p)},
 {id:'num',label:'A number',test:(p:string)=>/[0-9]/.test(p)},
];
export const passwordOk=(p:string)=>passwordRules.every(r=>r.test(p))&&p.length<=128;
/** Cryptographically random 16-character password that always satisfies the policy. */
export function generatePassword(){
 const sets=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnpqrstuvwxyz','23456789','!@#$%&*?'];const all=sets.join('');
 const pick=(chars:string)=>chars[crypto.getRandomValues(new Uint32Array(1))[0]%chars.length];
 const out=[...sets.map(pick),...Array.from({length:12},()=>pick(all))];
 for(let i=out.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[out[i],out[j]]=[out[j],out[i]]}
 return out.join('');
}
