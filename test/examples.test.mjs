import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Miniflare} from 'miniflare';
import {normalize,createBridge} from '../skills/vzhuh-publish/assets/cafe-bot/bridge.mjs';
const assets=new URL('../skills/vzhuh-publish/assets/',import.meta.url);
const source=(name,file)=>readFile(new URL(name+'/'+file,assets),'utf8');
const token='a'.repeat(64);
async function runtime(name,options={}){
 let script=await source(name,'worker.mjs');
 script=script.replace("import {config} from './config.mjs';",'const config = '+JSON.stringify({bridgeTokenHash:createHash('sha256').update(token).digest('hex'),staff:['tg:1','max:2']})+';');
 const mf=new Miniflare({modules:true,script,compatibilityDate:'2026-07-01',d1Databases:['DB'],...options});
 const db=await mf.getD1Database('DB');
 const schema=await source(name,'drizzle/'+(name==='cafe-bot'?'0000_loyalty.sql':'0000_registrations.sql'));
 for(const statement of schema.split('--> statement-breakpoint'))await db.prepare(statement.trim()).run();
 return {mf,db};
}
test('cafe: both messengers, authorized staff, retries, receipt deduplication, concurrent redeem',{timeout:15000},async()=>{
 const {mf,db}=await runtime('cafe-bot');
 const send=(id,actor,text,credential=token)=>mf.dispatchFetch('https://site.example/api/bot-event',{method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:JSON.stringify({id,actor,text})});
 try{
 assert.equal((await send('tg:0','tg:10','/balance','bad')).status,401);
 assert.match((await (await send('tg:1','tg:10','/stamp tg:10 CHECK-01')).json()).text,/только сотрудник/);
 for(let i=0;i<5;i++)await send('tg:purchase'+i,'tg:1','/stamp tg:10 CHECK-0'+i);
 await Promise.all(Array.from({length:8},()=>send('tg:purchase0','tg:1','/stamp tg:10 CHECK-00')));
 await send('max:other','max:2','/stamp tg:10 CHECK-00');
 assert.equal((await db.prepare('SELECT SUM(delta) AS n FROM ledger WHERE customer=?').bind('tg:10').first()).n,5);
 await Promise.all([send('tg:redeem1','tg:1','/redeem tg:10 REWARD-01'),send('max:redeem2','max:2','/redeem tg:10 REWARD-02')]);
 assert.equal((await db.prepare('SELECT SUM(delta) AS n FROM ledger WHERE customer=?').bind('tg:10').first()).n,0);
 await send('max:purchase','max:2','/stamp max:10 MAX-01');
 assert.match((await(await send('max:balance','max:10','/balance')).json()).text,/1 штампов/);
 assert.match((await(await send('tg:balance','tg:10','/balance')).json()).text,/0 штампов/);
 assert.equal((await mf.dispatchFetch('https://site.example/api/ledger')).status,404);
 }finally{await mf.dispose()}
});
test('event: concurrent capacity, duplicate emails, validation, no public participant list',{timeout:15000},async()=>{
 const {mf,db}=await runtime('event-registration');
 const send=(email,extra={})=>mf.dispatchFetch('https://site.example/api/register',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify({name:'Гость',email,consent:true,...extra})});
 try{
 assert.equal((await send('a@example.test',{consent:false})).status,400);
 assert.equal((await send('a@example.test',{website:'spam'})).status,400);
 assert.equal((await send('invalid')).status,400);
 await Promise.all(Array.from({length:6},()=>send('same@example.test')));
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM registrations').first()).n,1);
 const results=await Promise.all(Array.from({length:30},(_,i)=>send('user'+i+'@example.test')));
 assert.equal(results.filter(r=>r.status===201).length,11);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM registrations').first()).n,12);
 assert.equal((await(await mf.dispatchFetch('https://site.example/api/event')).json()).remaining,0);
 assert.equal((await mf.dispatchFetch('https://site.example/api/registrations')).status,404);
 }finally{await mf.dispose()}
});
test('provider adapters normalize official shapes and ignore group/bot/unsafe-number updates',()=>{
 assert.deepEqual(normalize('tg',{update_id:9,message:{chat:{id:4,type:'private'},from:{id:4},text:'/id'}}),{id:'tg:9',actor:'tg:4',text:'/id',destination:'4'});
 assert.equal(normalize('tg',{update_id:9,message:{chat:{id:4,type:'group'},from:{id:4},text:'/id'}}),null);
 assert.deepEqual(normalize('max',{update_type:'message_created',message:{recipient:{chat_type:'dialog'},sender:{user_id:5},body:{mid:'mid-1',text:'/balance'}}}),{id:'max:mid-1',actor:'max:5',text:'/balance',destination:'5'});
 assert.equal(normalize('max',{update_type:'bot_started',user:{user_id:9007199254740992},timestamp:1}),null);
 assert.equal(normalize('max',{update_type:'bot_started',user:{user_id:5,is_bot:true},timestamp:1}),null);
 assert.equal(normalize('max',{update_type:'bot_started',user:{user_id:5},timestamp:1}).text,'/start');
});
test('webhook HTTP bridge validates secrets, targets only fixed APIs, and surfaces retryable send errors',async()=>{
 const calls=[];let failed=false;
 const env={BRIDGE_TOKEN:token,TELEGRAM_TOKEN:'test-token',TELEGRAM_WEBHOOK_SECRET:'t'.repeat(32),MAX_TOKEN:'max-token',MAX_WEBHOOK_SECRET:'m'.repeat(32),WORKER_URL:'https://site.example/api/bot-event'};
 const server=createBridge(env,async(url,options)=>{calls.push({url,options});if(url===env.WORKER_URL)return Response.json({text:'hello'});if(failed)return new Response('',{status:429});return Response.json({ok:true})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
 const body=JSON.stringify({update_id:9,message:{chat:{id:4,type:'private'},from:{id:4},text:'/id'}});
 const send=secret=>fetch(base+'/webhooks/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body});
 assert.equal((await send('bad')).status,403);assert.equal(calls.length,0);
 assert.equal((await send(env.TELEGRAM_WEBHOOK_SECRET)).status,200);assert.equal(calls[1].url,'https://api.telegram.org/bottest-token/sendMessage');
 assert.equal(calls[0].options.redirect,'error');assert.equal(JSON.parse(calls[0].options.body).actor,'tg:4');
 const max=await fetch(base+'/webhooks/max',{method:'POST',headers:{'X-Max-Bot-Api-Secret':env.MAX_WEBHOOK_SECRET},body:JSON.stringify({update_type:'bot_started',user:{user_id:5},timestamp:1})});
 assert.equal(max.status,200);assert.equal(calls.at(-1).url,'https://platform-api2.max.ru/messages?user_id=5');assert.equal(calls.at(-1).options.headers.Authorization,'max-token');
 failed=true;assert.equal((await send(env.TELEGRAM_WEBHOOK_SECRET)).status,503);
 }finally{await new Promise(r=>server.close(r))}
});
test('D1 loyalty survives Worker restart',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'vzhuh-recipe-'));
 let first,second;
 try{
 first=await runtime('cafe-bot',{d1Persist:directory});
 await first.mf.dispatchFetch('https://site.example/api/bot-event',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({id:'tg:save',actor:'tg:1',text:'/stamp tg:10 PERSIST-01'})});
 await first.mf.dispose();first=null;
 let script=await source('cafe-bot','worker.mjs');script=script.replace("import {config} from './config.mjs';",'const config = '+JSON.stringify({bridgeTokenHash:createHash('sha256').update(token).digest('hex'),staff:['tg:1']})+';');
 second=new Miniflare({modules:true,script,compatibilityDate:'2026-07-01',d1Databases:['DB'],d1Persist:directory});
 const response=await second.dispatchFetch('https://site.example/api/bot-event',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({id:'tg:read',actor:'tg:10',text:'/balance'})});assert.match((await response.json()).text,/1 штампов/);
 }finally{await first?.mf.dispose();await second?.dispose();await rm(directory,{recursive:true,force:true})}
});
