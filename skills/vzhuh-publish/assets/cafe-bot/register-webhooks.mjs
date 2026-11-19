// Explicitly run by the operator after bridge deployment; never during build or installation.
import {settings} from './bridge.mjs';
const env=settings();
const origin=new URL(process.env.WEBHOOK_ORIGIN ?? '');
if(origin.protocol!=='https:'||origin.port||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw new Error('WEBHOOK_ORIGIN must be an HTTPS origin on port 443');
async function register(url,headers,body,label){
 try {
  const r=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const data=await r.json();if(!r.ok||data.ok===false||data.success===false)throw Error();
  console.log(label+': webhook registered');
 }catch{throw new Error(label+': registration failed; check token, TLS and provider settings (sensitive response omitted)')}
}
await register(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/setWebhook`,{},{url:new URL('/webhooks/telegram',origin).href,secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message'],max_connections:2},'Telegram');
await register('https://platform-api2.max.ru/subscriptions',{Authorization:env.MAX_TOKEN},{url:new URL('/webhooks/max',origin).href,secret:env.MAX_WEBHOOK_SECRET,update_types:['message_created','bot_started']},'MAX');
