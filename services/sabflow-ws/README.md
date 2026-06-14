# @sabnode/sabflow-ws

Standalone Node + Express + `ws` WebSocket gateway that powers SabFlow's real-time CRDT collab editor. Listens on `ws://localhost:4002/ws` and is reached from the Next.js app via a Vercel Routing Middleware rewrite from `/_sabflow/ws`.

This service follows the standard SabNode sidecar shape (Express on a private port, PM2-managed, env-driven config) but exposes a WebSocket surface instead of a REST one. Per [`docs/adr/sabflow-ws-gateway-node.md`](../../docs/adr/sabflow-ws-gateway-node.md), the gateway lives in its own process — **not** folded into the Next.js app (blast radius) and **not** on Vercel Fluid Compute (WS lifetimes don't match Fluid's request-shaped billing, instance recycling kills sockets mid-edit, and shared in-memory rooms need single-process affinity Fluid doesn't guarantee).

---

## Architecture

```
┌───────────────────────┐    wss://app.sabnode.com/_sabflow/ws    ┌────────────────────────────┐
│  Next.js 16 (Vercel)  │ ─── Routing Middleware rewrite ────────▶│  sabflow-ws (this svc)     │
│  /src/lib/sabflow/*   │                                          │  Express :4002 + ws.Server │
│  + browser SDK        │ ◀── Yjs sync / awareness binary ─────── │  + in-memory Room map      │
└──────────┬────────────┘                                          │  + Redis seat counter      │
           │                                                       └─────────────┬──────────────┘
           ▼                                                                     ▼
       (cookie / JWT auth)                                                 ┌──────────┐
                                                                           │  Redis   │
                                                                           └──────────┘
```

- **HTTP surface** — `/healthz`, `/health`, `/metrics` (Prometheus / OTLP). The WebSocket upgrade is gated at `/ws` and runs auth + seat + RBAC checks **before** sending `101`.
- **Auth** — accepts either the SabNode session cookie or a short-lived JWT in `Sec-WebSocket-Protocol: sabflow.v1, jwt.<token>`. Verified with `SABFLOW_WS_JWT_SECRET` (HS256, 5-minute lifetime). See ADR §3.2.
- **Rooms** — one in-memory `Room` per `docId`; awareness fans out per-socket. Phase 7 adds a Redis pub/sub backplane for multi-instance fan-out.
- **Seats** — plan-tier enforcement via atomic Redis `INCR` on `sabflow:seats:{workspaceId}:{docId}` keyed by `(workspaceId, docId, userId)`. See ADR §6.
- **Wire format** — binary frames carrying Yjs sync + awareness protocols with a 1-byte tag prefix; JSON control plane on text frames (capped 4 KiB). WS-native ping/pong every 30 s, 2-miss tolerance.

The skeleton in `src/index.ts` is intentionally thin: it boots the HTTP server, attaches `ws.Server` in `noServer` mode, then delegates everything else to sibling modules listed below. Sibling modules are loaded via dynamic `import()` with try/catch fallbacks so the skeleton compiles and boots standalone while Track A Phase 3 sub-tasks #2 .. #10 land.

| Sibling module      | Phase 3 sub-task | Purpose                                                  |
| ------------------- | ---------------- | -------------------------------------------------------- |
| `./auth`            | #2               | Cookie / JWT verification at upgrade time                |
| `./room`            | #3               | In-memory room map + awareness fan-out                   |
| `./connection`      | #4               | Per-socket framing, heartbeat, message dispatch          |
| `./reconnect`       | #5               | `lastSyncedClock` reconciliation on reconnect            |
| `./backpressure`    | #6               | Shed-not-buffer send-queue policy + inbound rate-limits  |
| `./seats`           | #7               | Plan-tier seat enforcement (Redis `INCR`/`DECR`)         |
| `./logger`          | #8               | pino-based structured logger                             |
| `./metrics`         | #9               | Prometheus / OTLP exporter                               |

---

## Required env vars

Copy `.env.example` (lands with sibling #2) to `.env` and fill in:

| Var                       | Required | Default          | Purpose                                                                 |
| ------------------------- | -------- | ---------------- | ----------------------------------------------------------------------- |
| `SABFLOW_WS_PORT`         | no       | `4002`           | HTTP port. Pick a free port if 4002 is busy. |
| `SABFLOW_WS_JWT_SECRET`   | **yes**  | —                | HS256 secret used to sign / verify short-lived editor JWTs. Must match the Next.js side. ≥ 16 chars. |
| `REDIS_URL`               | **yes**  | —                | Redis connection URL. Used for seat counter + Phase 7 pub/sub fan-out. |
| `OTLP_ENDPOINT`           | no       | —                | OpenTelemetry collector endpoint. If unset, metrics export is disabled and `/metrics` returns a stub. |

Generate a secret:

```bash
openssl rand -base64 48
```

---

## Develop locally

```bash
cd services/sabflow-ws
npm i
npm run dev   # tsx watch src/index.ts on :4002
```

The Next.js dev server (`npm run dev` at the repo root) reaches the gateway via the Routing Middleware rewrite. Direct browser dial works too: `ws://localhost:4002/ws?docId=<uuid>&pushRef=<uuid>`.

Type-check without emitting:

```bash
npm run typecheck
```

Build to `dist/`:

```bash
npm run build
```

---

## Deploy (production)

`sabflow-ws` is a PM2 app declared in the repo-root `ecosystem.config.js`:

```js
{
  name: 'sabflow-ws',
  cwd: './services/sabflow-ws',
  script: 'npm',
  args: 'start',
  env: {
    SABFLOW_WS_PORT: '4002',
    SABFLOW_WS_JWT_SECRET,
    REDIS_URL,
    OTLP_ENDPOINT,
  },
}
```

Start / reload:

```bash
pm2 start ecosystem.config.js --only sabflow-ws
pm2 reload sabflow-ws --update-env
pm2 logs sabflow-ws
pm2 status sabflow-ws
```

The repo-root `deploy.sh` builds this service as part of every deploy:

```bash
cd services/sabflow-ws
npm install
npm run build
cd ../..
pm2 reload ecosystem.config.js --update-env --only sabflow-ws
```

PM2 app name: **`sabflow-ws`** (use this exact string for `pm2 logs`, `pm2 reload`, etc.).

---

## Layout

```
services/sabflow-ws/
├── src/
│   ├── index.ts         # Express + ws bootstrap, :4002 listener (this file)
│   ├── auth.ts          # ← Phase 3 #2 (sibling)
│   ├── room.ts          # ← Phase 3 #3 (sibling)
│   ├── connection.ts    # ← Phase 3 #4 (sibling)
│   ├── reconnect.ts     # ← Phase 3 #5 (sibling)
│   ├── backpressure.ts  # ← Phase 3 #6 (sibling)
│   ├── seats.ts         # ← Phase 3 #7 (sibling)
│   ├── logger.ts        # ← Phase 3 #8 (sibling)
│   └── metrics.ts       # ← Phase 3 #9 (sibling)
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

The skeleton boots without any sibling — missing modules log a warning and the gateway accepts upgrades in dev-permissive mode. Production deploys MUST land all siblings before going live; see ADR §3.2 and §6.

---

rest of the SabNode stack.

### 1. Provision env

```bash
cd services/sabflow-ws
cp .env.example .env
# edit .env if you want non-default ports / secrets
```

Variables documented in `.env.example`:

| Var | Default | Purpose |
| --- | --- | --- |
| `SABFLOW_WS_PORT` | `4002` | Port the gateway binds to. |
| `SABFLOW_WS_JWT_SECRET` | `changeme` | HMAC secret for WS JWTs. Must match the Next.js minter. |
| `REDIS_URL` | `redis://127.0.0.1:6380` | Redis URL. The bundled compose stack publishes on **6380** to dodge a host-native Redis on 6379. |
| `OTLP_ENDPOINT` | _(blank)_ | Optional OTLP HTTP exporter. Blank disables OpenTelemetry export. |

### 2. Start dependencies + dev server

```bash
./scripts/dev.sh
```

This brings up the `redis:7` container declared in `docker-compose.yml`
(exposed on `127.0.0.1:6380`, healthchecked, data persisted in the
`sabflow-ws-redis-data` named volume) and then runs `npm run dev` (sibling
task #1 provides this script — it should be a `tsx watch src/index.ts`).
Re-running is safe; an already-up Redis is left alone.

> Sibling #1 owns `package.json`. The dev harness expects these npm scripts
> to be defined there:
> - `dev`   — `tsx watch src/index.ts`
> - `build` — `tsc -p tsconfig.json` emitting to `dist/`
> - `start` — `node dist/index.js`

### 3. Smoke-test a running gateway

```bash
./scripts/probe.sh
```

Hits `/health` and then opens a WebSocket with a deliberately invalid JWT
subprotocol — the script exits non-zero unless the server rejects auth (via
upgrade error, error event, or close with a non-1000 code).

### 4. Stop the stack

```bash
docker compose down       # keep Redis data
docker compose down -v    # wipe Redis data
```

### PM2 (production-style local run)

`ecosystem.config.js` declares a single `sabflow-ws` app (fork mode, 1
instance — WS state is in-process for v0, so do not scale horizontally
without first wiring a Redis adapter). Build first:

```bash
npm run build
pm2 start ecosystem.config.js
pm2 logs sabflow-ws
```

Logs are pinned to `./logs/sabflow-ws-{out,error}.log`, matching the
standard SabNode sidecar log-file naming convention.
