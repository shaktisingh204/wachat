# sabwa-engine

The Rust service that powers SabNode's **SabWa** (WhatsApp) module. It owns
long-lived WhatsApp sessions, real-time delivery, the scheduler / bulk
runner, outbound webhooks and the anti-ban heuristics layer. The Next.js
app talks to it over HTTP behind a shared service token, and over Redis
pub/sub for fan-out.

> **Phase 1 status: scaffold only.** This crate currently exposes
> `GET /healthz` and an empty, auth-guarded `/v1` router. WhatsApp pairing,
> message I/O, scheduling, webhooks and anti-ban are owned by sibling
> agents (R2–R9) and land in subsequent phases.

See the master plan in [`/SABWA_PLAN.md`](../../SABWA_PLAN.md) — section 2
(high-level architecture) and section 14 (full file structure).

## Architecture (where this crate sits)

```
Next.js 16 ──HTTP (X-Sabwa-Service-Token)──► sabwa-engine (this crate)
     ▲                                              │
     │           Redis pub/sub (events)             ▼
     └──────────────────────────────────────► Mongo + R2 (SabFiles)
```

## Build

```bash
cd services/sabwa-engine
cargo build --release
```

The release binary lands at `target/release/sabwa-engine`.

## Run

```bash
# Local dev — reads .env automatically via dotenvy
cp .env.example .env
# ...fill in real values...
cargo run

# Production
./target/release/sabwa-engine
```

Quick liveness check once it's up:

```bash
curl http://localhost:4001/healthz   # → ok
```

## Environment variables

| Variable                       | Required | Default                                 | Purpose                                                                |
| ------------------------------ | -------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `SABWA_ENGINE_PORT`            | no       | `4001`                                  | TCP port the HTTP server binds to.                                     |
| `MONGODB_URI`                  | **yes**  | —                                       | Mongo connection string (same cluster as the Next.js app).             |
| `MONGODB_DB`                   | no       | `sabnode`                               | Mongo database name.                                                   |
| `REDIS_URL`                    | **yes**  | —                                       | Redis URL used for pub/sub + queues.                                   |
| `SABWA_ENGINE_TOKEN`           | **yes**  | —                                       | Shared secret the Next.js layer sends as `X-Sabwa-Service-Token`.      |
| `SABWA_WEBHOOK_SIGNING_SECRET` | no       | falls back to `SABWA_ENGINE_TOKEN`      | HMAC secret used to sign outbound webhook payloads.                    |
| `RUST_LOG`                     | no       | `info,sabwa_engine=info,tower_http=info`| `tracing-subscriber` env-filter directive.                             |

A working sample lives in [`.env.example`](./.env.example).

## Authentication model

Every request to `/v1/*` is rejected unless the header
`X-Sabwa-Service-Token: <SABWA_ENGINE_TOKEN>` is present. The comparison is
constant-time. `/healthz` is intentionally unauthenticated for orchestrator
liveness probes.

## Module layout

| Module       | Owner          | Responsibility                                                  |
| ------------ | -------------- | --------------------------------------------------------------- |
| `config`     | R1 (scaffold)  | Env-var loading + validation.                                   |
| `state`      | R1 (scaffold)  | Cloneable `AppState` carried into every handler.                |
| `error`      | R1 (scaffold)  | `AppError` + `IntoResponse` mapping to JSON `{error, code}`.    |
| `auth`       | R1 (scaffold)  | Service-token middleware.                                       |
| `db`         | R-db           | Mongo collection helpers + indexes.                             |
| `routes`     | R-routes       | REST surface mounted at `/v1`.                                  |
| `realtime`   | R-realtime     | SSE / WebSocket bridge over Redis pub/sub.                      |
| `wa`         | R-wa           | WhatsApp / Baileys session pool, pairing, outbound queue.       |
| `scheduler`  | R-scheduler    | Delayed-job / campaign tick.                                    |
| `webhooks`   | R-webhooks     | Outbound webhook dispatch with HMAC signing.                    |
| `antiban`    | R-antiban      | Rate limits, jitter, ban-risk gauge.                            |
| `types`      | R-types        | Shared DTOs and domain types.                                   |

## Development

```bash
cargo check          # fast type-check
cargo clippy --all-targets --all-features
cargo fmt
cargo test
```
