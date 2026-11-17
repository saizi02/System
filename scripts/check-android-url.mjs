const value=process.env.CAPACITOR_SERVER_URL;
if(!value){
  console.error('Set CAPACITOR_SERVER_URL to the deployed Tillcore HTTPS URL before syncing Android.');
  process.exit(1);
}

let url;
try{url=new URL(value)}catch{
  console.error('CAPACITOR_SERVER_URL must be a valid absolute URL.');
  process.exit(1);
}

const localHttp=url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
if((url.protocol!=='https:'&&!localHttp)||url.username||url.password){
  console.error('CAPACITOR_SERVER_URL must use HTTPS (HTTP is allowed only for localhost development) and must not contain credentials.');
  process.exit(1);
}
