import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
export default defineConfig({server:{proxy:{'/api':{target:'http://127.0.0.1:3002',changeOrigin:true}}},plugins:[react(),VitePWA({registerType:'autoUpdate',includeAssets:['favicon.svg'],manifest:{name:'SSTWAS 2.0 Self-Service Checkout',short_name:'SSTWAS',description:'Installable self-service till with Customer app, Cashier station, Kitchen display and Admin console',display:'standalone',start_url:'/',scope:'/',theme_color:'#0b1630',background_color:'#0b1630',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png'}]},devOptions:{enabled:false}})]});
