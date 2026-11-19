---
name: vzhuh-publish
description: Build and publish websites and full-stack Cloudflare-compatible Worker applications on vzhuh.cloud using MCP, persistent D1/R2, preview and production. Use for creating or deploying to vzhuh.cloud, or adapting an existing Worker or ChatGPT Sites build to vzhuh.
---

# vzhuh.cloud: build locally, publish a Worker

vzhuh is a **Cloudflare-compatible application hosting platform**, not just static file hosting. It runs Worker ESM on open-source **workerd through Miniflare**, with persistent **D1 (SQLite)** and **R2 (object storage)** bindings. Its current server and site storage are in Russia. It is self-hosted, not Cloudflare's global managed edge. The management API is MCP, not a complete Cloudflare REST replacement.

## What you can make

- Landing pages, portfolios and documentation: HTML/CSS/JS, React/Vue/Vite/Astro static builds.
- Full-stack apps: Worker `fetch(request, env, ctx)`, routes, JSON APIs, validation and business logic. No separate Node/Express server is required.
- Forms, directories, event registrations and small dashboards: write records through `env.DB.prepare(...).bind(...).run()`, read through `.all()` / `.first()`.
- File-backed apps: store and retrieve objects through `env.BUCKET.put/get/list/delete`. Assets use `env.ASSETS.fetch(request)`.
- Closed demos and tools: sign-in through Yandex, access for selected profile emails. New sites are private; sharing grants viewing, not editing.
- Updates without losing records: immutable versions, independent preview/production, stable HTTPS URLs, code rollback. D1/R2 belong to the site/environment, not a release.
- Diagnostics: deployment status, recent Worker logs, database tables/rows and object listings. 64 MiB total storage per account; inspect current usage before a large upload.

## Choose the compatible architecture

Read [references/runtime.md](references/runtime.md) before writing or adapting application code. It contains manifest shapes, working static/Worker/D1/R2 examples, supported imports/migrations and real limits. Build in the agent's workspace; the hosting server **does not run npm install or build**. Bundle frontend and Worker dependencies locally.

Do not promise arbitrary Cloudflare compatibility: outbound Worker `fetch` is blocked; KV, Durable Objects, Queues, Cron, WebSocket, custom domains, managed secrets and billing are not implemented. Next.js static export can use the static profile; arbitrary Next.js SSR cannot be uploaded unchanged. Closed ChatGPT identity/connectors do not transfer. No payment, email-delivery or external-API feature works merely because it runs in a Worker. Explain the missing capability before building a design that depends on it.

## Connect and publish

The MCP endpoint is `https://vzhuh.cloud/mcp`; use OAuth with `sites:read sites:write`. The user completes Yandex sign-in and client consent. Never request their password or embed access tokens in the build. Discover the client's tools: names may be prefixed with `vzhuh` or `mcp_vzhuh_`.

In Pi, use `vzhuh_tools` to discover the MCP schemas, then `vzhuh_call` with `{name,arguments}`. If authentication is needed, ask the user to run `/vzhuh-login` and follow the printed authorization link. Other clients expose MCP tools natively.

1. Call `whoami`, `get_storage_usage` and `list_sites`. For an update, use the intended existing site instead of creating duplicates.
2. Build and check the application locally, then stage **only** the manifest, output and additive migrations in a clean artifact directory.
3. Follow [references/publish.md](references/publish.md): create site → upload hashed chunks → complete → save immutable version → get current environment revision → deploy. `project_path` refers to the server filesystem and must not point to your remote agent workspace.
4. Inspect the returned deployment status. Report success only after `succeeded`, and use the returned URL; do not invent a hostname. A private URL requires Yandex in the browser; a login redirect does not mean the Worker failed. Check the actual app with an authorized browser when available and report any unverified part.
5. Keep new sites private unless the user's request authorizes public access. To share with named readers, grant their Yandex profile email. Public visibility opens both environments, including API and files. Do not request `platform:admin` for publishing.

Use the `vzhuh-manage` skill for access, diagnostics, quota cleanup and rollback. Do not treat a failed publish as permission to delete data or relax access controls. Inspect status after a timeout before retrying the same operation; reuse its idempotency key.
