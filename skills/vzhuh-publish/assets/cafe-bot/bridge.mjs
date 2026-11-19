import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const numeric=value=>(typeof value==='string'&&/^-?[0-9]{1,20}$/.test(value))||(typeof value==='number'&&Number.isSafeInteger(value));
export function normalize(provider,update) {
  if(provider==='tg') {
    const m=update?.message;
    if(!m||m.chat?.type!=='private'||m.from?.is_bot||!numeric(m.from?.id)||!numeric(m.chat?.id)||!Number.isSafeInteger(update.update_id)||typeof m.text!=='string')return null;
    return {id:`tg:${update.update_id}`,actor:`tg:${m.from.id}`,text:m.text.slice(0,1000),destination:String(m.chat.id)};
  }
  if(update?.update_type==='bot_started'&&!update.user?.is_bot&&numeric(update.user?.user_id)&&Number.isSafeInteger(update.timestamp))return {id:`max:start:${update.user.user_id}:${update.timestamp}`,actor:`max:${update.user.user_id}`,text:'/start',destination:String(update.user.user_id)};
  const m=update?.message;
  if(update?.update_type!=='message_created'||m?.recipient?.chat_type!=='dialog'||m?.sender?.is_bot||!numeric(m?.sender?.user_id)||typeof m.body?.mid!=='string'||!/^[a-zA-Z0-9:._-]{1,160}$/.test(m.body.mid)||typeof m.body?.text!=='string')return null;
  return {id:`max:${m.body.mid}`,actor:`max:${m.sender.user_id}`,text:m.body.text.slice(0,1000),destination:String(m.sender.user_id)};
}
export function settings(env=process.env) {
  for(const name of ['BRIDGE_TOKEN','TELEGRAM_TOKEN','TELEGRAM_WEBHOOK_SECRET','MAX_TOKEN','MAX_WEBHOOK_SECRET','WORKER_URL'])if(!env[name])throw new Error('Missing '+name);
  if(!/^[a-f0-9]{64}$/.test(env.BRIDGE_TOKEN))throw new Error('BRIDGE_TOKEN must be random 32-byte hex');
  for(const name of ['TELEGRAM_WEBHOOK_SECRET','MAX_WEBHOOK_SECRET'])if(!/^[a-zA-Z0-9_-]{32,256}$/.test(env[name]))throw new Error('Invalid '+name);
  const worker=new URL(env.WORKER_URL);if(worker.protocol!=='https:'||worker.username||worker.password||worker.search||worker.hash||worker.pathname!=='/api/bot-event')throw new Error('WORKER_URL must be https://your-site/api/bot-event');
  return env;
}
export function createBridge(env,fetcher=fetch) {
  let inFlight=0;
  return http.createServer(async(req,res)=>{
    const provider=req.url==='/webhooks/telegram'?'tg':req.url==='/webhooks/max'?'max':null;
    const end=(status,text)=>{res.writeHead(status,{'Content-Type':'text/plain'});res.end(text)};
    if(!provider)return end(404,'Not found');
    if(req.method!=='POST')return end(405,'Method not allowed');
    const header=provider==='tg'?'x-telegram-bot-api-secret-token':'x-max-bot-api-secret';
    if(!same(req.headers[header],env[provider==='tg'?'TELEGRAM_WEBHOOK_SECRET':'MAX_WEBHOOK_SECRET']))return end(403,'Forbidden');
    if(inFlight>=8)return end(503,'Busy');
    inFlight++;
    try {
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>128*1024)return end(413,'Too large');chunks.push(chunk)}
      let update;try{update=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return end(400,'Invalid JSON')}
      const event=normalize(provider,update);if(!event)return end(200,'Ignored');
      const result=await fetcher(env.WORKER_URL,{method:'POST',redirect:'error',signal:AbortSignal.timeout(6000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.BRIDGE_TOKEN}`},body:JSON.stringify({id:event.id,actor:event.actor,text:event.text})});
      if(!result.ok)throw new Error('worker');
      const reply=await result.json();if(typeof reply.text!=='string')throw new Error('reply');
      const endpoint=provider==='tg'?`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`:`https://platform-api2.max.ru/messages?user_id=${encodeURIComponent(event.destination)}`;
      const response=await fetcher(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(6000),headers:{'Content-Type':'application/json',...(provider==='max'?{Authorization:env.MAX_TOKEN}:{})},body:JSON.stringify(provider==='tg'?{chat_id:event.destination,text:reply.text}:{text:reply.text})});
      if(!response.ok)throw new Error('send');
      if(provider==='tg'&&!(await response.json()).ok)throw new Error('telegram');
      end(200,'OK');
    }catch{console.error('Webhook failed; provider may retry. Tokens and payload omitted.');if(!res.headersSent)end(503,'Retry later')}
    finally{inFlight--}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const server=createBridge(settings());server.requestTimeout=15000;server.headersTimeout=16000;server.listen(8080,'0.0.0.0',()=>console.log('Webhook bridge listening on 8080'));
}
