/** Product QR links and scan parsing, shared by the Admin label printer and the customer phone scanner. */
export type ScanTarget={productId?:string;code?:string};
export const productLink=(origin:string,businessId:string,branchId:string,productId:string)=>`${origin}/shop/${encodeURIComponent(businessId)}/${encodeURIComponent(branchId)}?add=${encodeURIComponent(productId)}`;
/** Accepts a product link, a raw barcode, or an old-style QR that only held the barcode/product id. */
export function parseScan(raw:string):ScanTarget{
 const text=raw.trim();
 try{const u=new URL(text);const add=u.searchParams.get('add');if(add)return{productId:add}}catch{/* not a URL: treat as a plain code */}
 return{code:text}
}
