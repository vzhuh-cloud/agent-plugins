---
name: vzhuh-manage
description: Manage existing vzhuh.cloud Worker sites, preview and production versions, D1/R2 diagnostics, private email access, storage quota and code rollback through MCP.
---

# Manage vzhuh.cloud sites

This is Cloudflare-compatible workerd/Miniflare hosting with persistent D1/R2 in Russia, accessed through `https://vzhuh.cloud/mcp` with OAuth. Discover tools and inspect `whoami` / `list_sites` first. Scope is the signed-in owner's sites. In Pi, discover via `vzhuh_tools` and invoke with `vzhuh_call({name,arguments})`. Native clients may prefix tool names.

| User goal | Tools and important semantics |
|---|---|
| Find current deployment | `get_site({site_id})`: environment URLs, active version and revision; `get_deployment_status({deployment_id})` for outcome. |
| Inspect releases | `list_site_versions`, `get_site_version`: immutable artifact inventory, bindings and migration hashes. Saving a version does not publish. |
| Roll back code | `rollback_site({site_id,version_id,environment,expected_revision,idempotency_key})`. Read current revision first. D1/R2 are preserved, not restored from a snapshot. Incompatible migration history must be reported, not bypassed. |
| Inspect records | `read_database_overview` then `read_database_table_rows` with exact returned table name, environment, limit ≤100, offset ≤10000. MCP offers bounded reads, not arbitrary SQL writes. |
| Inspect files | `list_storage_objects` with environment, limit ≤100 and optional cursor. This lists metadata; no generic MCP file-edit/download/delete API is promised. Apps access R2 through their binding. |
| Diagnose errors | `get_site_worker_logs` (up to 200 recent lines, memory buffer reset on restart), deployment status, data readers. Logs or private rows are not public content. |
| Give someone viewing access | `get_site_access`; `grant_site_viewer({site_id,email})` using the reader's main Yandex profile email. It grants only viewing, sends no invitation email and requires no platform invite. |
| Remove a viewer | `revoke_site_viewer({site_id,email})`; affects subsequent requests, not previously downloaded files. |
| Make public/private | `set_site_visibility({site_id,visibility:"public"|"private"})`. Applies to both production and preview, including APIs/assets. Follow the user's intended audience; don't make public merely to bypass a failed anonymous check. |
| Check quota | `get_storage_usage`: 64 MiB total including saved artifacts, staging reservations, D1 allocated size, R2 and trash. SQL DELETE may not immediately shrink allocated D1 storage. |
| Free staging | Inspect `get_artifact_upload`, then `discard_artifact_upload` if no longer needed. Completed saved versions remain. |
| Free old builds | `delete_site_version({site_id,version_id})` permanently removes an inactive version and its history; active releases are protected. Obtain deletion authorization; rollback to deleted versions becomes impossible. |
| Trash/restore/delete whole site | Use the account dashboard. These actions are not exposed as MCP tools in this release. Do not invent tool names. |
| Disconnect agent | User revokes the client in `/app/connections`; sites and data remain. Do not ask for `platform:admin`. |

Site access is not account ownership. The platform itself has open Yandex signup; legacy platform invitation tools are administrator-only compatibility endpoints, not a requirement for normal publishing. Account grants and viewer lists are independent.

For building and deploying new code, use `vzhuh-publish`. Report what changed, the returned environment URL and what was actually verified. A preview publish does not change production; a code rollback is not a database backup restore.
