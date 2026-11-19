// This file is bundled by build.mjs with configuration containing only a SHA-256 digest.
import {config} from './config.mjs';
function createWorker(settings) {
  return {async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/bot-event') return new Response('Not found', {status:404});
    if (request.method !== 'POST') return new Response('Method not allowed', {status:405});
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if (!settings.bridgeTokenHash || digest !== settings.bridgeTokenHash) return new Response('Unauthorized', {status:401});
    let event; try { event = await request.json(); } catch { return new Response('Invalid JSON', {status:400}); }
    const identity = /^(tg|max):[0-9]{1,20}$/;
    if (!event || !identity.test(event.actor) || !/^(tg|max):[a-zA-Z0-9:._-]{1,180}$/.test(event.id) || !event.id.startsWith(event.actor.split(':')[0]+':') || typeof event.text !== 'string' || event.text.length > 1000) return new Response('Invalid event', {status:400});
    const cached = await env.DB.prepare('SELECT reply FROM bot_events WHERE id=?').bind(event.id).first();
    if (cached) return Response.json({text:cached.reply});
    const [command, customer, receipt] = event.text.trim().split(/\s+/);
    let response;
    if (command === '/balance') {
      const row = await env.DB.prepare('SELECT COALESCE(SUM(delta),0) AS balance FROM ledger WHERE customer=?').bind(event.actor).first();
      response = `На вашей карте ${row.balance} штампов. 5 штампов — бесплатный кофе.`;
    } else if (command === '/id') response = `Ваша карта: ${event.actor}`;
    else if (command === '/stamp' || command === '/redeem') {
      if (!settings.staff.includes(event.actor)) response = 'Начислять и списывать штампы может только сотрудник кафе.';
      else if (!identity.test(customer ?? '') || !/^[a-zA-Z0-9_-]{3,64}$/.test(receipt ?? '')) response = 'Формат: /stamp tg:123 CHECK-001 или /redeem max:456 REWARD-001. Номер операции уникален.';
      else {
        const delta = command === '/stamp' ? 1 : -5;
        // A single conditional INSERT serializes the balance check with the write.
        // Both event_id and receipt are unique: retries and cross-channel reuse cannot credit twice.
        await env.DB.batch([
          env.DB.prepare('INSERT OR IGNORE INTO ledger(event_id,receipt,customer,delta) SELECT ?,?,?,? WHERE ?=1 OR (SELECT COALESCE(SUM(delta),0) FROM ledger WHERE customer=?)>=5').bind(event.id,receipt,customer,delta,delta,customer),
          env.DB.prepare("INSERT OR IGNORE INTO bot_events(id,reply) SELECT ?, CASE WHEN EXISTS(SELECT 1 FROM ledger WHERE event_id=?) THEN 'Готово. Штампов на карте: ' || (SELECT COALESCE(SUM(delta),0) FROM ledger WHERE customer=?) WHEN EXISTS(SELECT 1 FROM ledger WHERE receipt=?) THEN 'Этот номер операции уже использован. Повторного начисления нет.' ELSE 'Для бесплатного кофе нужно 5 штампов.' END").bind(event.id,event.id,customer,receipt)
        ]);
        response = (await env.DB.prepare('SELECT reply FROM bot_events WHERE id=?').bind(event.id).first()).reply;
      }
    } else response = 'Кофейная карта ☕\n/id — показать карту\n/balance — мои штампы\nПосле покупки покажите карту бариста. За 5 штампов — кофе. Telegram и MAX имеют отдельные карты.';
    await env.DB.prepare('INSERT OR IGNORE INTO bot_events(id,reply) VALUES (?,?)').bind(event.id,response).run();
    return Response.json({text:(await env.DB.prepare('SELECT reply FROM bot_events WHERE id=?').bind(event.id).first()).reply});
  }};
}
export default createWorker(config);
