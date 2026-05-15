# @sabnode/sabwa-node

Node.js + Express + Baileys HTTP service that powers SabWa (personal WhatsApp via Linked Devices). Listens on `http://localhost:4001` and is consumed by the Next.js app through `src/lib/sabwa/engine-client.ts`.

This service **replaces the deleted Rust crate `services/sabwa-engine/`** (and its Node sidecar). HTTP contract, Mongo collection names, port, and service-token handshake are all unchanged — see `CHANGELOG-sabwa-rust-to-node.md` at the repo root.

---

## Architecture

```
┌──────────────────────┐     HTTP (X-Sabwa-Service-Token)    ┌────────────────────────────┐
│  Next.js 16 (sabnode-│ ────────────────────────────────────▶ │  sabwa-node (this svc)     │
│  web, :3002)         │                                       │  Express on :4001          │
│  src/lib/sabwa/      │ ◀──── SSE realtime (JWT in header)──── │  + Baileys session pool    │
│  engine-client.ts    │                                       │  + BullMQ scheduler/bulk   │
└──────────┬───────────┘                                       │  + anti-ban rate limiter   │
           │                                                   └─────────────┬──────────────┘
           ▼                                                                 ▼
       ┌────────┐                                                       ┌──────────┐
       │ Mongo  │  (sabwa_sessions, sabwa_chats, sabwa_messages, …)    │  Redis   │
       └────────┘                                                       └──────────┘
```

- **HTTP API** — all `/v1/*` routes: `sessions`, `chats`, `messages`, `groups`, `contacts`, `scheduled`, `broadcasts`, `bulk`, `audit`, `api-keys`, `webhooks`, `realtime` (SSE), `public`.
- **Service-to-service auth** — every request must carry `X-Sabwa-Service-Token: <SABWA_ENGINE_TOKEN>` matching the Next.js `.env`.
- **Realtime** — SSE on `/v1/realtime/stream`. Tokens are minted by the Next.js app with `SABWA_JWT_SECRET` and validated here.
- **Baileys in-process** — long-lived multi-device sockets live in a session pool. Auth state is encrypted at rest with `AUTH_STATE_KEY` (AES-256-GCM) before being written to Mongo `sabwa_sessions.authState`.
- **No sidecar** — unlike the old Rust setup, Baileys runs in the same Node process. No JSON-RPC, no IPC.

---

## Required env vars

Copy `.env.example` to `.env` and fill in:

| Var | Purpose |
| --- | --- |
| `PORT` | HTTP port (default `4001`). |
| `SABWA_ENGINE_URL` | URL the Next.js app uses to reach this worker (default `http://localhost:4001`). Set on the Next.js side, must match this service's bind. |
| `SABWA_ENGINE_TOKEN` | Shared service-to-service token. **Must** match the Next.js `.env`. |
| `SABWA_JWT_SECRET` | Secret used to sign/verify SabWa realtime JWTs (>= 32 bytes). Shared with Next.js. |
| `AUTH_STATE_KEY` | Base64-encoded 32 raw bytes. AES-256-GCM key for encrypting Baileys auth state at rest. |
| `MONGO_URL` | Mongo connection URL. Same DB as the Next.js app. |
| `REDIS_URL` | Redis connection URL. Used for pub/sub + BullMQ. |

Generate `SABWA_JWT_SECRET` + `AUTH_STATE_KEY` with:

```bash
node scripts/gen-keys.js >> .env
```

---

## Develop locally

```bash
# from repo root
cd services/sabwa-node
pnpm install
node scripts/gen-keys.js >> .env   # one-time, only if .env is missing keys
pnpm dev                           # tsx watch src/index.ts on :4001
```

The Next.js dev server (`npm run dev` at the repo root) will hit `http://127.0.0.1:4001` as long as its `.env` has the matching `SABWA_ENGINE_URL` + `SABWA_ENGINE_TOKEN` + `SABWA_JWT_SECRET`.

Type-check without emitting:

```bash
pnpm typecheck
```

---

## Deploy

`sabwa-node` is a PM2 app declared in the repo-root `ecosystem.config.js`:

```js
{
  name: 'sabwa-node',
  cwd: './services/sabwa-node',
  script: 'pnpm',
  args: 'start',
  env: {
    PORT: '4001',
    MONGO_URL, REDIS_URL,
    SABWA_ENGINE_TOKEN, SABWA_JWT_SECRET, AUTH_STATE_KEY,
  },
}
```

The repo-root `deploy.sh` builds this service as part of every deploy:

```bash
# inside deploy.sh
cd services/sabwa-node
pnpm install --frozen-lockfile
pnpm build           # tsc → dist/
cd ../..
pm2 reload ecosystem.config.js --update-env
```

After deploy:

```bash
pm2 logs sabwa-node
pm2 status sabwa-node
```

---

## Layout

```
services/sabwa-node/
├── src/
│   ├── index.ts            # Express bootstrap, :4001 listener
│   ├── state.ts            # shared app state (mongo, redis, baileys pool)
│   ├── crypto.ts           # AES-256-GCM auth-state encryption
│   ├── log.ts              # pino logger
│   ├── auth/jwt.ts         # SABWA_JWT_SECRET verification for SSE
│   ├── middleware/         # service-token + JWT guards
│   ├── routes/             # /v1/* HTTP handlers
│   ├── realtime/           # SSE + Redis pub/sub
│   ├── db/                 # mongo + redis connection helpers
│   └── antiban/            # rate-limit profiles + warmup
├── scripts/gen-keys.js     # one-shot key generator
├── package.json
└── tsconfig.json
```
