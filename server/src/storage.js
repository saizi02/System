import {v2 as cloudinary} from 'cloudinary';
import {rm} from 'node:fs/promises';
import {resolve} from 'node:path';

export function cloudinaryConfigured(){
 return Boolean(process.env.CLOUDINARY_URL||(
  process.env.CLOUDINARY_CLOUD_NAME&&process.env.CLOUDINARY_API_KEY&&process.env.CLOUDINARY_API_SECRET
 ));
}

export async function uploadProductPhoto(businessId,file){
 if(!cloudinaryConfigured())return null;
 if(!process.env.CLOUDINARY_URL&&process.env.CLOUDINARY_CLOUD_NAME){
  cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
 }
 return await new Promise((resolve,reject)=>{
  cloudinary.uploader.upload_stream({
   folder:`tillora/products/${businessId}`,
   resource_type:'image',
   allowed_formats:['jpg','jpeg','png','webp','gif'],
   transformation:[{width:1600,height:1600,crop:'limit',quality:'auto',fetch_format:'auto'}]
  },(error,result)=>{
   if(error)return reject(new Error(`Photo storage failed: ${error.message}`));
   resolve(result?.secure_url||result?.url);
  }).end(file.buffer);
 });
}

export async function deleteBusinessPhotos(businessId){
 if(!/^[a-f0-9-]{36}$/i.test(businessId))throw new Error('Invalid business ID for photo cleanup');
 const warnings=[];
 try{await rm(resolve('uploads',businessId),{recursive:true,force:true})}catch(error){console.error(`Local photo cleanup failed for store ${businessId}:`,error);warnings.push('Local product photos could not be removed.')}
 if(cloudinaryConfigured()){
  try{await cloudinary.api.delete_resources_by_prefix(`tillora/products/${businessId}/`)}catch(error){console.error(`Cloud photo cleanup failed for store ${businessId}:`,error);warnings.push('Cloud product photos could not be removed.')}
 }
 return warnings;
}
