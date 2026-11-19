# Telegram + MAX: cafe loyalty example

Use for a webhook bot or cafe loyalty request. Copy `../assets/cafe-bot/` into the user's project; do not edit the installed skill. Complete Russian guide: https://vzhuh.cloud/docs/bots.

## Architecture and current hosting boundary

```
Telegram / MAX → HTTPS webhook bridge (Docker, external to vzhuh)
                    → authenticated Worker → D1 ledger
                    ← reply text
                → messenger sendMessage / POST messages
```

The current vzhuh Worker cannot make outbound HTTP requests and has no managed secret bindings. **A standalone Worker cannot run this dual-messenger example.** The supplied Node 24 bridge is a separate operator-hosted component, not a built-in hosting feature. It keeps bot tokens outside the artifact, checks provider webhook secrets and sends replies. Do not enable general Worker egress or embed bot tokens to make this recipe fit.

Telegram can alternatively execute an API method returned as the webhook response; that does not provide the result of the API call and is not the MAX reply mechanism used here. The shared bridge provides a consistent flow for both.

## Product rules

- `/start`: help; `/id`: `tg:<id>` or `max:<id>` card; `/balance`: stamps.
- Staff only: `/stamp tg:123 CHECK-001` adds 1; `/redeem max:456 REWARD-001` subtracts 5 if available.
- One stamp per purchase. Receipt/operation numbers are globally unique; retries do not modify balance twice.
- Staff identities come from trusted messenger user IDs, never usernames or text typed as an identity.
- Both bots share D1 and business rules. They do **not** silently merge the same person's Telegram/MAX cards. Account linking would need proof of control of both accounts and is outside this example.
- Only private conversations; no groups, channels, payments, POS integration or monetary balance. A staff member physically validates the purchase and reward.

## Setup sequence

1. Obtain a Telegram bot via BotFather and a MAX bot via the official MAX business platform. Requirements and availability depend on those platforms. Have the user put tokens into local `.env`; do not request secrets in chat.
2. Copy `env.example` to `.env` and restrict file permissions. Generate three independent 32-byte random hex values for `BRIDGE_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `MAX_WEBHOOK_SECRET`. Put real staff IDs in `STAFF_IDS`. Never send `.env` in an artifact or commit it.
3. Run `node --env-file=.env build.mjs`. This produces `artifact/`, containing the Worker, additive schema and only a SHA-256 digest of the bridge token. Deploy **artifact/** using the standard MCP upload flow, not the whole project.
4. A machine calling a private site is redirected to Yandex. For this example the site must explicitly be public, with `/api/bot-event` protected by the bridge bearer token and no public ledger/list endpoint. Discuss this topology when planning; do not silently widen visibility. If public access is not authorized, keep it private and stop before live webhook setup.
5. Put the returned production URL plus `/api/bot-event` in `WORKER_URL`. Run `docker compose up -d` in the copied project. The compose file binds only `127.0.0.1:8080`. Terminate HTTPS on your reverse proxy and forward to that port. Configure a real DNS name and a valid full-chain certificate. Public URL uses 443; don't expose the raw bridge port. Protect/rotate the shared bridge credential with a coordinated rebuild and `.env` change.
6. Set `WEBHOOK_ORIGIN=https://bots.example.org`. Once bridge and Worker are live, operator explicitly runs `node --env-file=.env register-webhooks.mjs`. This modifies both bots' webhook configuration and may replace previous integrations. It is not part of install or build. It keeps pending Telegram updates by default. A partial failure can leave only Telegram configured; inspect both providers before retrying.
7. Start a direct conversation with each bot. Check `/id`, staff rejection for a normal user, `/stamp`, duplicate receipt and `/redeem`. Re-deploy code and verify balance persists. Do not give an agent credentials or real customer data solely to test a sample.

## Delivery, security and operations

The bridge checks `X-Telegram-Bot-Api-Secret-Token` or `X-Max-Bot-Api-Secret` before parsing input. It limits body to 128 KiB and concurrent work to 8. Its Worker target is fixed in operator configuration; request payloads cannot select outbound URLs. It sends tokens only to the fixed official API host and disables redirects. TLS certificate verification stays enabled. MAX currently documents `platform-api2.max.ru`; if its trust chain needs an additional CA, configure a verified CA through Node's trust configuration, never `NODE_TLS_REJECT_UNAUTHORIZED=0`.

Worker writes use unique event and receipt IDs; the conditional SQL debit cannot spend below zero. Incoming identity is trusted only after bridge authentication. The public Worker does not expose balances without that credential. The bridge's API secret is a service credential; rotate and protect it as such.

On failure the bridge returns 503 so the provider can retry. There is **no durable message outbox**: acknowledgement lost after send can cause a repeated chat reply; balance still changes once. Provider retries are finite, not guaranteed delivery. MAX can unsubscribe an unhealthy endpoint; monitor subscriptions and reconcile missed events. Before growing beyond a small demo, add a durable inbox/outbox, retry scheduling/rate limiting and dead-letter handling on the bridge. Do not claim exactly-once replies or guaranteed delivery. MAX messages are sent at provider limits; 429 is retried by webhook redelivery, not an internal queue.

D1 event/receipt history grows against the 64 MiB quota. Do not casually purge ledger or event IDs: this can break balance or retry protection. Plan retention/archival before live business usage. The bridge does not log request bodies or tokens. Provider numeric IDs beyond JS safe integers are rejected rather than rounded; supporting the full int64 range needs a lossless JSON parser.

## Authoritative references (checked 2026-11-19)

- Telegram webhook and secret: https://core.telegram.org/bots/api#setwebhook
- Telegram webhook response calls: https://core.telegram.org/bots/api#making-requests-when-getting-updates
- MAX subscriptions, secret, HTTPS and retries: https://dev.max.ru/docs-api/methods/POST/subscriptions
- MAX events: https://dev.max.ru/docs-api/objects/Update
- MAX reply API: https://dev.max.ru/docs-api/methods/POST/messages
