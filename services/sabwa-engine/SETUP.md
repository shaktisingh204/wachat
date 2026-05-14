# sabwa-engine — Setup & Ops Runbook

## Purpose

`sabwa-engine` is the **Rust HTTP/WS service that owns the WhatsApp Multi-Device protocol layer for SabWa**. The Next.js app (server actions + `/api/sabwa/*`) calls it for pairing, sending, presence, group ops, and subscribes to its event stream for real-time delivery.

> Phase 1 status — **stub implementation only.** The WA Multi-Device protocol layer is still pending; see `SABWA_PLAN.md` §16 for the implementation candidates being evaluated.

---

## Local development

Requirements:

- Rust **1.82+** (`rustup toolchain install stable`)
- MongoDB running locally (or any reachable `MONGODB_URI`)
- Redis running locally (or any reachable `REDIS_URL`)

```bash
cd services/sabwa-engine
cp .env.example .env        # then fill in values
cargo run                   # dev build, fast iter
```

The service binds to `SABWA_ENGINE_PORT` (default `4001`).

### Required environment variables

| Variable                       | Required | Description                                                             |
| ------------------------------ | -------- | ----------------------------------------------------------------------- |
| `SABWA_ENGINE_PORT`            | yes      | TCP port the HTTP/WS server binds to. Default `4001`.                   |
| `MONGODB_URI`                  | yes      | Mongo connection string. Same cluster as Next.js (collections `sabwa_*`). |
| `REDIS_URL`                    | yes      | Redis URL for pub/sub of session + message events to Next.js.           |
| `SABWA_ENGINE_TOKEN`           | yes      | Shared bearer used by Next.js → engine. Must match the Next.js side.    |
| `SABWA_WEBHOOK_SIGNING_SECRET` | yes      | HMAC-SHA256 key for signing outbound webhook payloads.                  |

**On the Next.js side**, set (in the SabNode root `.env`):

- `SABWA_ENGINE_URL=http://localhost:4001`
- `SABWA_ENGINE_TOKEN=same shared token as above><`

---

## Build & release

```bash
cargo build --release        # produces target/release/sabwa-engine
```

The binary is a single static-ish executable; the only runtime requirement is `ca-certificates` (for TLS to Mongo Atlas and outbound webhooks).

---

## PM2 integration

The SabNode root has an existing `ecosystem.config.js` for the broadcast / cron workers. **Add** (do not replace) the following block to its `apps` array — this team rule keeps the engine under the same PM2 supervisor used by the rest of SabNode:

```js
{
  name: 'sabwa-engine',
  script: './services/sabwa-engine/target/release/sabwa-engine',
  interpreter: 'none',
  env: { SABWA_ENGINE_PORT: 4001 },
  max_restarts: 10,
  autorestart: true,
}
```

After updating, reload PM2:

```bash
pm2 reload ecosystem.config.js
pm2 logs sabwa-engine
```

---

## Docker

```bash
docker build -t sabwa-engine ./services/sabwa-engine
docker run -p 4001:4001 --env-file .env sabwa-engine
```

The image is a multi-stage build: `rust:1.82-bookworm` → `debian:bookworm-slim`, runs as a non-root `sabwa` user, exposes `4001`.

---

## Health check

```bash
curl http://localhost:4001/healthz
# ok
```

PM2 / Docker / your orchestrator should poll this endpoint.

---

## Roadmap

See `SABWA_PLAN.md` §15 (phased delivery roadmap). This service belongs to phases 1–6 (pairing, inbox sync, composer, groups, scheduler, broadcasts).
