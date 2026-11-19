# Runtime and artifact contract

## Static profile

`.openai/hosting.json`:
```json
{"static":{"directory":"dist/client"}}
```
Put `index.html` and assets in `dist/client/`. Other accepted roots: `dist`, `out`, `build`, `.output/public`. This profile cannot declare D1/R2. SPA fallback is not automatic; use a Worker to implement explicit routing if needed.

## Worker profile

```text
artifact/
  .openai/hosting.json
  dist/server/index.js
  dist/client/index.html       # optional assets
  drizzle/0000_events.sql      # optional migrations
```
Manifest:
```json
{"d1":"DB","r2":"BUCKET","compatibility_date":"2026-07-01"}
```
DB and BUCKET are logical binding names. No Cloudflare account, database ID, bucket creation or provider API key is needed. Omit bindings you do not use. `ASSETS` is reserved. Supported compatibility dates end at `2026-07-30` in the pinned runtime; do not set today's date blindly. Optional `compatibility_flags:["nodejs_compat"]` permits supported `node:` imports, not a long-running Node server or arbitrary filesystem access. Bundle npm imports; relative modules must stay inside the artifact. `cloudflare:workers` is supported.

A small API with persistent D1 and asset fallback:
```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/events' && request.method === 'GET') {
      const rows = await env.DB.prepare('SELECT id,title FROM events ORDER BY id DESC LIMIT 100').all();
      return Response.json(rows.results);
    }
    if (url.pathname === '/api/events' && request.method === 'POST') {
      // For cookie-authenticated mutations, enforce same-origin requests.
      if (request.headers.get('Origin') !== url.origin)
        return new Response('Forbidden', {status:403});
      let body;
      try { body = await request.json(); } catch { return new Response('Invalid JSON', {status:400}); }
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200)
        return new Response('Invalid title', {status:400});
      await env.DB.prepare('INSERT INTO events(title) VALUES (?)').bind(body.title.trim()).run();
      return Response.json({ok:true}, {status:201});
    }
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', {status:404});
  }
};
```
`drizzle/0000_events.sql`:
```sql
CREATE TABLE events(id INTEGER PRIMARY KEY, title TEXT NOT NULL);
```
Only additive schema migration statements are supported: CREATE TABLE/INDEX and ALTER TABLE ADD COLUMN. Separate statements with `--> statement-breakpoint`. No seed INSERT, DROP, UPDATE, DELETE, triggers or arbitrary migration transactions. Never edit a previously applied migration; add a new file. A code rollback does not roll back the database schema or contents.

R2 example inside an authorized route:
```js
await env.BUCKET.put('notes/readme.txt', 'Saved on vzhuh', {
  httpMetadata: {contentType:'text/plain; charset=utf-8'}
});
const object = await env.BUCKET.get('notes/readme.txt');
return object ? new Response(object.body, {headers:{'Content-Type':'text/plain; charset=utf-8'}})
  : new Response('Not found', {status:404});
```
The site's viewer gate is a coarse boundary: anyone granted viewing can call its app APIs. Implement additional application authorization for owner-only mutations, or keep the app restricted to trusted collaborators. Public mode is not a built-in per-record ACL. Avoid HTML interpolation of untrusted content.

## Storage and limits

Production and preview have separate persistent D1/R2. Redeploy and rollback reuse that environment's data. Versions are immutable. Trash retains data and counts toward the quota; deleting an inactive version frees its artifact, not database records.

Current ceilings: 64 MiB account total (all saved artifacts, staging reservations, allocated D1, R2 and trash), 32 MiB/upload, 8 MiB/file, 2,000 files/upload, 192 KiB decoded/chunk, 4 staged uploads/account, 10 sites/account, 40 versions/site. HTTP request 2 MiB, response 32 MiB, execution timeout 20 s; 8 active environments across the pilot. Read `whoami` for live upload limits and `get_storage_usage` for space before deciding.

No `.env`, `.git`, node_modules, symlinks, absolute paths or `..` segments. No outbound network, Cloudflare KV/DO/Queues/Cron/WebSocket, arbitrary services, custom domains, paid subscriptions or full Cloudflare REST/Wrangler deployment compatibility. Use local bundling tools; publish through vzhuh MCP.
