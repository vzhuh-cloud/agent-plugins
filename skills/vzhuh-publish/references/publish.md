# MCP publication sequence

Discover actual tool schemas before calling them. All IDs come from responses. SHA-256 and sizes must be computed from exact bytes, never guessed by the model.

1. `create_site({name,idempotency_key})` for a new private site, or `get_site({site_id})` for an existing one.
2. `begin_artifact_upload({site_id,files:[{path,size,sha256}],idempotency_key})`. File paths are relative to the clean artifact root, e.g. `.openai/hosting.json`, `dist/server/index.js`, `drizzle/0000.sql`.
3. For each non-empty file: `upload_artifact_chunk({upload_id,path,offset,encoding:"base64",content})`. Offset counts decoded bytes. Limit 196608 bytes/chunk. Empty files need no chunk.
4. `complete_artifact_upload({upload_id})` verifies hashes/format. Then `save_site_version({site_id,upload_id,idempotency_key})`. Saving does not publish.
5. `discard_artifact_upload({upload_id})` after successful save frees staging; the saved version remains.
6. `get_site({site_id})` → find the target environment's current `revision`. `deploy_site_version({site_id,version_id,environment:"preview",expected_revision,idempotency_key})`. Use production if that is what the user requested. First revision is 0, not a number inferred from version count.
7. Check deployment result or `get_deployment_status({deployment_id})`. Only `succeeded` means published. Promote the same saved version with a separate production deploy and that environment's current revision.

On interruption, use `get_artifact_upload({upload_id})` and resume each file at its `received` byte count. Identical chunk retries are safe. A changed local artifact requires a new manifest/upload. On revision conflict, read current deployment and reconcile; never overwrite another publish blindly. Schema incompatibility blocks rollback; do not erase data to force it.

## Byte preparation helper

Run `node scripts/prepare-upload.mjs /absolute/artifact /absolute/output` from this skill folder. It writes `files.json` and numbered chunk JSON files; prints only a small index. Add `site_id` and idempotency key to files.json for begin, then add returned upload_id to each chunk. It does not call MCP, authorize, build, upload or publish. Do not place output inside artifact root. For large builds, prefer programmatic MCP calling in a client that supports it; do not paste thousands of chunks into chat.
