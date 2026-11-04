/** Barcode helpers: normalising scanner input, check-digit validation and EAN-13 drawing. */
export type BarcodeKind='EAN-13'|'EAN-8'|'UPC-A'|'other';
export const cleanCode=(raw:string)=>raw.replace(/[\r\n\t\u0000-\u001f]/g,'').trim();
function checkDigit(body:string){let sum=0;for(let i=body.length-1,w=3;i>=0;i--,w=w===3?1:3)sum+=Number(body[i])*w;return(10-sum%10)%10}
/** Classify a code and say whether its check digit is right. Non-retail codes (Code 128 etc.) are 'other' and always accepted. */
export function inspectBarcode(code:string):{kind:BarcodeKind;valid:boolean;message:string}{
 const c=cleanCode(code);
 if(!/^\d+$/.test(c)||![8,12,13].includes(c.length))return{kind:'other',valid:true,message:c?'Custom code (not EAN/UPC)':''};
 const kind:BarcodeKind=c.length===13?'EAN-13':c.length===12?'UPC-A':'EAN-8';
 const ok=checkDigit(c.slice(0,-1))===Number(c[c.length-1]);
 return{kind,valid:ok,message:ok?`${kind} · valid`:`${kind} check digit is wrong. Re-scan, or check for a typing error.`}
}
const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PARITY=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
/** Returns the 95-module bar pattern ("1" = bar) for a valid EAN-13, or null. */
export function ean13Modules(code:string):string|null{
 const c=cleanCode(code);if(!/^\d{13}$/.test(c)||!inspectBarcode(c).valid)return null;
 const par=PARITY[Number(c[0])];let out='101';
 for(let i=0;i<6;i++){const d=Number(c[i+1]);out+=par[i]==='L'?L[d]:G[d]}
 out+='01010';for(let i=0;i<6;i++)out+=R[Number(c[i+7])];
 return out+'101'
}
