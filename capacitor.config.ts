import type {CapacitorConfig} from '@capacitor/cli';

const serverUrl=process.env.CAPACITOR_SERVER_URL;
const server=serverUrl?new URL(serverUrl):undefined;
if(server&&server.protocol!=='https:'&&!(server.protocol==='http:'&&['localhost','127.0.0.1'].includes(server.hostname))){
  throw new Error('CAPACITOR_SERVER_URL must use HTTPS, except for localhost development.');
}

const config:CapacitorConfig={
  appId:'com.tillcore.sstwas',
  appName:'Tillcore',
  webDir:'dist',
  ...(server?{server:{url:server.toString(),cleartext:server.protocol==='http:',allowNavigation:[server.host]}}:{})
};

export default config;
