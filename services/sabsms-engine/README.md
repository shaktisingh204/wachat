# sabsms-engine

Rust + Axum service that owns the SMS / MMS / RCS send pipeline for
SabNode. The Next.js side never holds a provider connection — every
send proxies through this engine via `src/lib/sabsms/engine-client.ts`.

## Run locally

```bash
cd services/sabsms-engine
cargo build --release
SABSMS_ENGINE_TOKEN=devtoken-change-me \
MONGODB_URI=mongodb://localhost:27017 \
MONGODB_DB=sabnode \
REDIS_URL=redis://127.0.0.1:6379 \
SABSMS_APP_CALLBACK_URL=http://localhost:3000 \
SABSMS_TWILIO_ACCOUNT_SID=AC... \
SABSMS_TWILIO_AUTH_TOKEN=... \
SABSMS_TWILIO_DEFAULT_FROM=+15551234567 \
./target/release/sabsms-engine
```

Or via PM2 (see `ecosystem.config.js` at repo root): `pm2 start
sabsms-engine`.

## HTTP surface

All routes except `/health` and `/webhook/:provider/:direction` require
the `X-Sabsms-Service-Token` header.

- `GET  /health` — liveness + version.
- `POST /v1/messages` — enqueue a send (body = `EnqueueSendInput`).
- `GET  /v1/messages/:id` — fetch one message doc.
- `POST /webhook/twilio/inbound` — provider inbound; signature-verified.
- `POST /webhook/twilio/dlr` — provider DLR; signature-verified.

## Layout

```
src/
  main.rs          axum boot + worker spawn + graceful shutdown
  config.rs        env-driven Config
  state.rs         AppState (mongo, redis, http client)
  db.rs            Mongo connect + index ensure
  queue.rs         Redis send queue (LPUSH/BRPOP)
  errors.rs        EngineError → HTTP mapping
  auth.rs          service-token middleware
  credits.rs       call back into Next /api/sabsms/credits
  worker.rs        background send loop (concurrency = N tasks)
  types.rs         JSON wire types (mirror src/lib/sabsms/types.ts)
  providers/
    mod.rs         SmsProvider trait + segment estimator
    twilio.rs      Twilio adapter + signature verify
  handlers/
    mod.rs         axum router wiring
    health.rs
    send.rs        POST /v1/messages, GET /v1/messages/:id
    webhook.rs     POST /webhook/:provider/:direction
```

## Phase 1 limits

This is the first slice from `plans/sabsms-world-class-plan.md`:

- Single provider: Twilio. Vonage, MessageBird, Plivo, MSG91, … land in
  Phase 7.
- Single Twilio credential read from env. The encrypted-per-workspace
  credential store (`sabsms_provider_accounts`) is read but not yet
  honoured by the send/webhook hot path.
- Credits callback always approves (Phase 0 stub on the Next side).
- No campaign / drip / template rendering yet.
- No outbound webhooks, RCS, or MMS yet.

## Tests

```bash
cargo test
```

Adapter tests use recorded fixtures; no live API calls.
