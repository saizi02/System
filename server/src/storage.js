import {v2 as cloudinary} from 'cloudinary';

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
