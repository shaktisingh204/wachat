# SabWa engine: Rust → Node.js migration

**Date:** 2026-05-15
**Scope:** the SabWa personal-WhatsApp backend service (consumed by the Next.js app at `/sabwa/*` and `/api/sabwa/*`).

The Rust HTTP service `services/sabwa-engine/` (Axum + Tokio) plus its Node sidecar (which ran Baileys over JSON-RPC) has been replaced by a single pure-Node service, `services/sabwa-node/` (Express + Baileys in-process). This is a drop-in swap — no data migration, no API contract change on the Next.js side.

---

## Key changes

### Removed
- `services/sabwa-engine/` (Rust crate — Cargo workspace, Tokio runtime, Axum router).
- `services/sabwa-engine/sidecar-node/` (the long-lived Baileys subprocess the Rust parent spawned).
- `.github/workflows/sabwa-engine-ci.yml` (Rust CI workflow — superseded by the Node service's typecheck).

### Added
- `services/sabwa-node/` — pure Node.js + Express + Baileys (`@whiskeysockets/baileys`) service. TypeScript, ESM, `pnpm`.
  - Same `/v1/*` routes the Rust service exposed: `sessions`, `chats`, `messages`, `groups`, `contacts`, `scheduled`, `broadcasts`, `bulk`, `audit`, `api-keys`, `webhooks`, `realtime` (SSE), `public`.
  - Same `X-Sabwa-Service-Token` handshake (env: `SABWA_ENGINE_TOKEN`).
  - Baileys runs **in-process** — no sidecar, no IPC.
  - AES-256-GCM auth-state encryption ported from `services/sabwa-engine/src/crypto.rs` to `services/sabwa-node/src/crypto.ts` (identical wire format).

### Renamed / re-wired
- **PM2 app** `sabwa-engine` → `sabwa-node`. Declared in `ecosystem.config.js` with `cwd: './services/sabwa-node'`.
- **Deploy script** `deploy.sh` now builds `services/sabwa-node/` with `pnpm install --frozen-lockfile && pnpm build`.
- **SERVER-SETUP.md** lists `sabwa-node` on port 4001.
- **CLAUDE.md** (root) now documents the SabWa engine policy: only edit `services/sabwa-node/`, never `services/sabwa-engine/`.

### Env vars

New requirements on the **Node service**:

| Var | Purpose |
| --- | --- |
| `SABWA_JWT_SECRET` | Signs/verifies realtime SSE tokens minted by the Next.js app. Shared between Next.js and `sabwa-node`. >= 32 bytes. |
| `AUTH_STATE_KEY` | Base64-encoded 32 raw bytes. AES-256-GCM key for encrypting Baileys creds at rest in `sabwa_sessions.authState`. |

Pre-existing vars carry over unchanged: `SABWA_ENGINE_URL`, `SABWA_ENGINE_TOKEN`, `MONGO_URL`, `REDIS_URL`, `PORT` (4001).

### Unchanged
- HTTP contract — the Next.js layer (`src/lib/sabwa/engine-client.ts`) requires **no code changes** beyond the engine URL/port (still `http://127.0.0.1:4001`).
- Mongo collections — all `sabwa_*` collections (`sabwa_sessions`, `sabwa_chats`, `sabwa_messages`, `sabwa_groups`, `sabwa_contacts`, `sabwa_scheduled`, `sabwa_templates`, `sabwa_quick_replies`, `sabwa_auto_replies`, `sabwa_broadcasts`, `sabwa_labels`, `sabwa_webhooks`, `sabwa_audit_log`, `sabwa_api_keys`) keep the same shape and indexes.
- Redis channels — `sabwa:{sessionId}:events`, `sabwa:{sessionId}:outbound`, BullMQ queues — same names.
- Anti-ban, scheduler, bulk-sender, warmup logic — ported 1:1 from Rust to Node. Same rate-limit profiles (`safe`, `normal`, `aggressive`).

---

## Cutover checklist

1. Pull latest `main` on the deploy host.
2. Ensure `.env` on the host has `SABWA_JWT_SECRET` + `AUTH_STATE_KEY` set (run `node services/sabwa-node/scripts/gen-keys.js` if missing and copy the output into the host's `.env`).
3. Run `./deploy.sh` — it builds `sabwa-node` and `pm2 reload`s the ecosystem.
4. `pm2 status` — confirm `sabwa-node` is up on :4001, `sabwa-engine` is gone.
5. `pm2 logs sabwa-node` — confirm "sabwa-node listening on :4001" and successful Mongo/Redis connection.
6. Smoke-test from the Next.js UI: `/sabwa/connect` should still pair, `/sabwa/inbox` should still stream messages.

---

## Why we migrated

- **One language, one process** — Rust + Node sidecar meant double the surface area for the same protocol layer. The whole team is fluent in Node/TS; the Rust crate added maintenance friction with no measurable runtime benefit (Baileys was the bottleneck, not the HTTP layer).
- **Simpler ops** — no JSON-RPC bridge, no two-process restart story, no Cargo build in the deploy pipeline.
- **Faster iteration** — Baileys protocol features (polls, communities, edits) land in JS first. We were waiting on a Rust shim for each.

The Rust crate is preserved in git history; nothing about the data is lost.
