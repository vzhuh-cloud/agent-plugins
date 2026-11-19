const event={title:'Кофе и разговоры',capacity:12,consentVersion:'event-v1'};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/api/event'&&request.method==='GET'){
  const row=await env.DB.prepare('SELECT COUNT(*) AS total FROM registrations').first();
  return json({title:event.title,capacity:event.capacity,remaining:Math.max(0,event.capacity-row.total)});
 }
 if(url.pathname==='/api/register'){
  if(request.method!=='POST')return json({error:'Используй POST'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'Запрос должен быть с сайта мероприятия'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Ожидается JSON'},415);
  const body=await request.text();if(new TextEncoder().encode(body).length>4096)return json({error:'Слишком большой запрос'},413);
  let input;try{input=JSON.parse(body)}catch{return json({error:'Неверный JSON'},400)}
  const name=typeof input?.name==='string'?input.name.trim():'';
  const email=typeof input?.email==='string'?input.email.trim().toLowerCase():'';
  if(name.length<2||name.length>80||email.length>254||!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)||input?.consent!==true||input?.website)return json({error:'Проверь имя, email и согласие'},400);
  const id=crypto.randomUUID();
  // The capacity check and INSERT are one statement. Concurrent requests cannot overbook.
  const result=await env.DB.prepare('INSERT OR IGNORE INTO registrations(id,email,name,consent_version) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM registrations) < ?').bind(id,email,name,event.consentVersion,event.capacity).run();
  if(result.meta.changes)return json({message:'Заявка сохранена. Запиши номер — письмо автоматически не отправляется.',reference:id},201);
  // Do not disclose whether this email is already registered.
  return json({message:'Новая заявка не создана: возможно, ты уже записан или места закончились. Свяжись с организатором.'},200);
 }
 if(url.pathname.startsWith('/api/'))return json({error:'Не найдено'},404);
 return env.ASSETS.fetch(request);
}};
