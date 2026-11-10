import 'dotenv/config';
/** All deployment settings in one place. Read once at start-up; invalid values stop the server with a clear message. */
const env=process.env;
export const production=env.NODE_ENV==='production';
export const publicOrigin=env.APP_ORIGIN||env.RENDER_EXTERNAL_URL||null;
export const config={
 production,
 /** 'single' locks this install to ONE store (no second store can be created); 'shared' hosts several isolated stores. */
 storeMode:env.STORE_MODE==='single'?'single':'shared',
 storeId:env.STORE_ID||null,
 timezone:env.STORE_TIMEZONE||'Africa/Harare',
 /** Admin consoles sign out after this many minutes without an action. Cashier and Kitchen stations stay signed in for the shift. */
 adminIdleMinutes:Number(env.ADMIN_IDLE_MINUTES||30),
 paymentProvider:env.PAYMENT_PROVIDER||'cash-only',
 /** Paynow Zimbabwe (PAYMENT_PROVIDER=paynow). 'test' lets the merchant account fake payments; 'live' moves real money. */
 paynow:{id:env.PAYNOW_INTEGRATION_ID?.trim()||'',key:env.PAYNOW_INTEGRATION_KEY?.trim()||'',authEmail:env.PAYNOW_AUTH_EMAIL?.trim()||'',mode:env.PAYNOW_MODE==='live'?'live':'test',currency:(env.PAYNOW_CURRENCY||'USD').trim().toUpperCase(),expiryMinutes:Number(env.PAYNOW_EXPIRY_MINUTES||10)},
 /** In production, simulated card / mobile-money approvals are OFF unless explicitly allowed (they approve any payment). */
 allowSimulatedPayments:!production||env.ALLOW_SIMULATED_PAYMENTS==='true',
 staticDir:env.STATIC_DIR||'../dist',
 version:env.APP_VERSION||'3.1.0'
};
export function validateConfig(){
 const problems=[];
 if(production){
  if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)problems.push('SESSION_SECRET must be at least 32 random characters');
  if(!publicOrigin)problems.push('APP_ORIGIN or RENDER_EXTERNAL_URL must be the public https address, e.g. https://till.myshop.co.zw');
  else if(!/^https:\/\//.test(publicOrigin.split(',')[0].trim()))problems.push('APP_ORIGIN or RENDER_EXTERNAL_URL must start with https:// in production');
 }
 if(config.storeId&&!/^[0-9a-f-]{36}$/i.test(config.storeId))problems.push('STORE_ID must be a store UUID');
 try{new Intl.DateTimeFormat('en',{timeZone:config.timezone})}catch{problems.push(`STORE_TIMEZONE "${config.timezone}" is not a valid time zone (example: Africa/Harare)`)}
 if(!(config.adminIdleMinutes>=5&&config.adminIdleMinutes<=1440))problems.push('ADMIN_IDLE_MINUTES must be between 5 and 1440');
 if(config.paymentProvider==='paynow'){
  const p=config.paynow;
  if(!/^\d+$/.test(p.id))problems.push('PAYNOW_INTEGRATION_ID must be the numeric Integration ID from your Paynow account');
  if(p.key.length<10)problems.push('PAYNOW_INTEGRATION_KEY is missing (copy it from your Paynow integration settings)');
  if(!/^[^@\s]+@[^@\s]+$/.test(p.authEmail))problems.push('PAYNOW_AUTH_EMAIL must be the email you sign in to Paynow with');
  if(!['USD','ZIG'].includes(p.currency))problems.push('PAYNOW_CURRENCY must be USD or ZIG (the currency of your Paynow integration)');
  if(!(p.expiryMinutes>=3&&p.expiryMinutes<=60))problems.push('PAYNOW_EXPIRY_MINUTES must be between 3 and 60');
  if(production&&p.mode==='test')console.warn('WARNING: PAYNOW_MODE is test. Set PAYNOW_MODE=live to accept real money.');
 }
 if(problems.length)throw Error('Configuration problems:\n - '+problems.join('\n - '));
}
