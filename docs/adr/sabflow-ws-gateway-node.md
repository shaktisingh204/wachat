# ADR — SabFlow WebSocket Gateway (Node baseline)

- **Track / Phase / Sub-task:** Track A · Phase 1 · #3 (Node baseline)
- **Status:** Proposed (Phase 1 design ADR; bench harness for Rust alternative is a sibling sub-task)
- **Date:** 2026-05-18
- **Scope:** Real-time collab WebSocket gateway for SabFlow editor. Node implementation
  only. The Rust (tokio + tungstenite) alternative is being scaffolded by a parallel
  agent (Phase 1 sub-task #4) and is referenced here only at decision points.
- **Related:** `PLAN-sabflow-crdt-collab.md` Track A Phase 1 / Phase 3; existing
  `docs/architecture/real-time-gateway.md` (CRM SSE doc, complementary not duplicative);
  `services/sabwa-node/` (canonical always-on PM2 service pattern); `CLAUDE.md` Vercel
  deployment policy.

> This ADR is **design only**. No gateway code is written in this sub-task. The
> Track A Phase 1 bench (sub-task #4) decides whether the implemented gateway is
> Node or Rust; the n8n-modeled message contract, lifecycle, and seat semantics
> below are the **same either way** so Phase 3 can build on top of whichever
> runtime wins.

---

## 1. n8n push module — what we're modeling against

n8n's editor uses a server-push module (`packages/cli/src/push/`) to deliver
execution progress, node status, and config changes from the backend to all
editor sessions watching a workflow. It is the closest in-tree analogue to what
SabFlow needs for CRDT collab.

### 1.1 Channel / room model

- **Connection unit:** one WebSocket per editor browser tab.
- **Push key (n8n term):** an opaque per-connection ID generated client-side and
  sent in the upgrade request (`?pushRef=<uuid>`). n8n indexes live connections
  by this ID.
- **Room:** n8n has an implicit "all editors for workflow X" room. Messages are
  scoped by either:
  - **Direct push** — server picks the `pushRef` (e.g. "the user who started
    this execution") and writes to exactly that socket.
  - **Broadcast** — server iterates the map and writes to every socket whose
    workflow context matches.
- **No explicit subscribe call.** Room membership is derived server-side from
  "which workflow is this tab currently editing" — established by the HTTP
  cookie session, not by a `JOIN` frame.

### 1.2 Broadcast strategy

- **In-process fan-out** by default: an `EventEmitter` walks the map of open
  sockets and writes per-socket. There is no message queue between emitter and
  socket — losing a message is treated as recoverable because the editor will
  re-fetch state on reconnect.
- **Multi-instance fan-out** (n8n queue mode + multi-server): a Redis pub/sub
  channel is the backplane. Each n8n process subscribes once; the local emitter
  forwards to its own sockets.
- **Two transports historically:** SSE was the original; WS was added later for
  bidirectional needs (execution data and editor-driven actions). The WS path
  is now the default.

### 1.3 JWT auth on connect

n8n authenticates the WS handshake using **the same session cookie** that
authenticates HTTP requests. There is no bearer-token-on-handshake step — the
upgrade carries `Cookie:` headers and the handler runs the same session
middleware before completing the upgrade. The push ref in the query string is
treated as untrusted and is only used for routing replies.

For SabFlow we deviate from n8n here: we have a dual-auth model (httpOnly
cookie for the browser + JWT for service-to-service / SDK), and we want the
gateway to be callable from a future headless SDK without cookies. Our handshake
must accept **either** the SabNode session cookie **or** a short-lived JWT in
the `Sec-WebSocket-Protocol` header (browsers cannot set arbitrary headers on
`new WebSocket()`, but the subprotocol header is settable). See §3.2.

### 1.4 Message types observed in n8n push

| n8n type                      | Direction | Purpose                                       |
| ----------------------------- | --------- | --------------------------------------------- |
| `executionStarted`            | S → C     | Execution lifecycle                           |
| `nodeExecuteBefore` / `After` | S → C     | Per-node tick                                 |
| `executionFinished`           | S → C     | Final state                                   |
| `sendWorkerStatusMessage`     | S → C     | Worker health for queue mode                  |
| `sendConsoleMessage`          | S → C     | Toast / dev console                           |
| `reloadNodeType`              | S → C     | Hot-reload after community node install       |
| Heartbeat ping                | both      | Keepalive                                     |

n8n's payloads are JSON, framed one event per WebSocket text frame, with a
`{type, data}` shape. That contract is **insufficient** for our use case
because Yjs updates are binary and high-frequency — we adopt n8n's *routing*
model but switch the wire format to binary frames + a small JSON control plane.
See §4.

---

## 2. Service location decision

### 2.1 Options surveyed

| Option | Where the WS server lives                                | Verdict      |
| ------ | -------------------------------------------------------- | ------------ |
| A      | Next.js route handler with WS upgrade on Vercel Fluid    | Rejected     |
| B      | New standalone Node service at `services/sabflow-ws/`    | **Selected** |
| C      | Folded into `services/sabwa-node/` (port 4001)           | Rejected     |
| D      | Managed pub/sub (Pusher / Ably / PartyKit)               | Deferred     |

### 2.2 Why not A — Next.js route handler upgrade on Vercel

`CLAUDE.md` says SabNode IS a Vercel project, and Vercel's policy is "use
platform-native primitives first." Fluid Compute does technically support
WebSocket upgrades inside Node functions: a function instance can hold a socket
open and (because Fluid reuses instances across concurrent requests) does not
cold-start every connection. **But** four properties of CRDT collab make this
the wrong fit:

1. **Lifetime mismatch.** Yjs sessions naturally run for minutes to hours. Fluid
   instances are scaled for request-shaped workloads — Vercel may evict an
   instance for cost / region reasons, terminating every socket on it. Editors
   would see reconnect storms on every scale-down.
2. **Per-instance state.** The doc room (Yjs `Y.Doc` plus the awareness map) is
   in-memory and must be **shared across all connections to that room**. Vercel
   Fluid does not guarantee that two clients of the same room land on the same
   instance, so every instance would need a Redis sync sidecar — and we'd still
   pay the awareness fan-out cost across Redis on every cursor move.
3. **Pricing model.** Active-CPU-time pricing penalises idle hold-open
   connections. A WS that mostly sleeps between cursor moves looks expensive
   under Fluid's billing units relative to a single always-on VM with N
   long-lived sockets.
4. **Deploy semantics.** Every Vercel deploy rolls instances; every roll kills
   sockets. With rolling releases that means N reconnects per editor per
   deploy, which is acceptable for SSE but not for CRDT mid-edit (clients lose
   awareness and momentarily double-cursor).

We treat the WS gateway as **infrastructure that *complements* the Vercel
deployment**, not a Vercel function. Vercel still serves all Next.js routes,
Server Actions, and Server Components — the gateway is a separate
process the browser dials directly (or via a Vercel rewrite, see §2.5).

### 2.3 Why not C — fold into `services/sabwa-node/`

`services/sabwa-node/` is the precedent for an always-on PM2 Node service
(port 4001, Baileys WhatsApp worker; see `package.json` and `src/realtime/`).
The pattern fits, but the *blast radius* does not: a CRDT bug or a Yjs memory
leak in the same process as the WhatsApp session manager would take both
products down. SabWa is a paid feature for a different customer segment;
isolation is cheaper than shared-process debugging. We borrow the *shape*
(`services/<name>-node/`, Express healthcheck, PM2 app entry, `SABFLOW_WS_URL`
+ `SABFLOW_WS_TOKEN` env pair mirroring `SABWA_ENGINE_URL` / `SABWA_ENGINE_TOKEN`)
without sharing the process.

### 2.4 Why B — standalone `services/sabflow-ws/`

- Long-lived process matches WS lifetime.
- Single in-memory room map (per instance) — no Redis hop for awareness in the
  single-instance case (Phase 7 Redis fan-out is the multi-instance upgrade).
- Independent deploy cadence from Vercel: a Next.js deploy does **not**
  disconnect editors.
- Mirrors `services/sabwa-node/`'s PM2 model so ops already know how to
  monitor / restart / log it. PM2 app name: `sabflow-ws`.
- Default port: **4002** (sabwa-node is 4002 + 1 from 4001 reserves the
  obvious adjacent slot). Confirm with ops before lockdown.
- Stays compatible with the future Rust swap-in (sibling sub-task #4) — the
  Rust binary slots into the same PM2 app entry with the same env contract.

### 2.5 How the browser reaches it

Two acceptable paths; choose at deploy time:

1. **Vercel Routing Middleware rewrite** — `wss://app.sabnode.com/_sabflow/ws`
   rewrites to the origin (`wss://sabflow-ws.internal:4002/ws`). Browser sees
   one domain, no CORS / cookie issues, deploy-independent.
2. **Direct subdomain** — `wss://flow-rt.sabnode.com/ws` pointed at the host
   running PM2. Simpler ops, but cookie sharing requires the `.sabnode.com`
   parent-domain cookie policy.

Default is (1) because cookie + CSRF + analytics already assume a single origin.

### 2.6 When we'd revisit option D

Managed pub/sub becomes attractive at >1000 concurrent editors or when we want
zero ops overhead. The contract in §3–§4 stays identical because Yjs binary
updates pass through any transport; only the dial endpoint changes. Re-evaluate
at Phase 10 load-test results.

---

## 3. Connection lifecycle

```
   Browser                                   Gateway
   ───────                                   ───────
1. HTTP GET /ws?docId=&pushRef= ───────────▶ Upgrade
        + Sec-WebSocket-Protocol: sabflow.v1, jwt.<token>
        + Cookie: sabnode_session=<...>   (one of token/cookie required)

2. ◀──────────────────────────── 101 Switching Protocols
        Sec-WebSocket-Protocol: sabflow.v1

3. {type:"auth.ok", userId, seatId, role}  ◀── server
4. {type:"join", docId} ──────────────▶
5. ◀── binary frame: Yjs sync step 1 (server state vector)
6. binary frame: Yjs sync step 2 (client diff) ──▶
7. ◀── binary frame: Yjs sync step 2 (server diff to client)
8. <updates flow both directions; awareness frames interleaved>
   <heartbeat every 30s>
9. close (1000 normal) or (4xxx app code) — see §3.6
```

### 3.1 Upgrade

`GET /ws?docId=<doc-uuid>&pushRef=<client-uuid>` over TLS. The gateway runs the
auth step before sending `101`. A rejected handshake returns:

- `401` — no/invalid token
- `403` — token valid but RBAC denies the doc, or seat-limit hit (see §6)
- `404` — doc does not exist
- `426` — required subprotocol missing
- `429` — per-IP / per-user upgrade rate limit hit

### 3.2 Auth

The handshake accepts **either**:

- **Cookie** `sabnode_session=<httpOnly>` — verified against the SabNode
  session table, same code path as Next.js Server Actions.
- **JWT** in `Sec-WebSocket-Protocol: sabflow.v1, jwt.<token>` — the gateway
  parses the second subprotocol token, strips the `jwt.` prefix, verifies it
  with `SABFLOW_WS_JWT_SECRET` (HS256), enforces 5-minute lifetime, and
  responds with `Sec-WebSocket-Protocol: sabflow.v1` (echoing only the
  protocol name, not the token).

Both paths resolve to a `{userId, workspaceId, planTier, roleSet}` triple.
That triple is the only thing carried forward into the room — neither raw
cookie nor raw JWT is stored on the socket object.

### 3.3 Join

Step 4 is the only `join`. The client sends `{type:"join", docId}` and the
server:

1. Re-checks RBAC: `sabflow:doc:read` for the doc.
2. Re-checks seat budget for `(workspaceId, docId)` — see §6.
3. Looks up or creates the in-memory `Room` for `docId`.
4. Adds the socket to the room's subscriber list.
5. Records the awareness slot (clientID, userId, color, name).

If anything fails at step 3, server sends `{type:"error", code, message}` and
closes with code `4403`.

### 3.4 Sync

After join, the gateway streams the Yjs sync protocol's three messages:
`sync-step-1` (server → client state vector), `sync-step-2` (each side's
missing updates), `update` (ongoing). All three are **binary frames**, opcode
0x2 (Binary). Awareness is a separate Yjs awareness-protocol message, also
binary. See §4 for framing.

### 3.5 Heartbeat

- Server pings every **30 s** (WebSocket control frame, opcode 0x9, empty
  payload).
- Client must answer with pong (opcode 0xA) within **10 s**.
- Tolerance: **2 missed cycles** (≈70 s) before server closes with code
  `4408 idle-timeout` and removes the socket from the room.
- Client also sends ping every 30 s if `document.visibilityState === 'visible'`
  to detect half-open NAT tables on browser side.
- No application-layer heartbeat needed — WS control frames pass through every
  reverse proxy we care about (Cloudflare honours them by default).

### 3.6 Reconnect with backoff

Client SDK (Phase 5) implements:

```
attempt:   1   2   3   4   5   6+
delay(s):  1   2   4   8   15  30 + jitter(±20%)
cap:                                       30 s
hard stop: after 12 attempts, raise to UI ("offline — refresh to retry").
```

On every reconnect the client:

1. Re-runs the handshake with a freshly-minted JWT (≤5 min lifetime) or the
   existing cookie.
2. On `auth.ok`, sends `{type:"join", docId, lastSyncedClock?: <Yjs-state-vector-base64>}`.
3. Gateway treats `lastSyncedClock` as a hint to skip frames the client already
   has; if missing, falls back to full sync from step 5 above.
4. Awareness state is **not** restored — the client re-publishes its current
   cursor / selection. Stale remote awareness on other peers ages out after 30 s.

Close codes the client treats as **retryable**: `1001`, `1006`, `1011`,
`1012`, `1013`, `4408`, `4429`, `4500`.

Close codes the client treats as **fatal** (do not retry, surface to user):
`4401`, `4403`, `4404`, `4413`, `4426`.

---

## 4. Message schema

### 4.1 Frame disposition

| WS opcode | Direction | Carries                                                         |
| --------- | --------- | --------------------------------------------------------------- |
| 0x1 text  | C ↔ S     | JSON control plane only (auth, join, presence chrome, error)    |
| 0x2 bin   | C ↔ S     | Yjs sync protocol frames + awareness protocol frames            |
| 0x9 ping  | S → C     | Heartbeat (empty payload)                                       |
| 0xA pong  | C → S     | Heartbeat reply                                                 |
| 0x8 close | both      | Close with 4-digit code from §3.6 vocab                         |

A single connection multiplexes both. Binary frames are framed with a 1-byte
**tag prefix** so the receiver can dispatch without parsing the Yjs payload:

```
+--------+---------------------------+
| u8 tag | yjs / awareness payload   |
+--------+---------------------------+

tag = 0x00  yjs sync (sync-step-1 / sync-step-2 / update)
tag = 0x01  yjs awareness update
tag = 0x02  yjs awareness query  (reserved, Phase 7)
tag = 0x7F  server batch         (length-prefixed concat of N tagged frames)
```

Tag `0x7F` is our addition over plain Yjs: the server may coalesce burst
updates into a single WS frame to reduce frame overhead. The decoder unwraps
into N sub-frames each dispatched as if it had arrived alone. See §5.

### 4.2 JSON control message catalogue

All JSON frames are `{type, ...}` and never larger than 4 KiB. Oversized JSON
is closed with `4413 payload-too-large`.

**Client → Server**

| `type`           | Fields                                  | Notes                              |
| ---------------- | --------------------------------------- | ---------------------------------- |
| `join`           | `docId`, optional `lastSyncedClock`     | Sent once per connection           |
| `presence.chrome`| `name`, `color`, `avatarUrl`            | Set the user-chrome for awareness  |
| `presence.focus` | `windowFocused: bool`                   | Hint for idle / away (Phase 7)     |
| `ping.app`       | `t: epoch-ms`                           | Optional app-layer RTT probe       |

**Server → Client**

| `type`           | Fields                                       | Notes                          |
| ---------------- | -------------------------------------------- | ------------------------------ |
| `auth.ok`        | `userId`, `seatId`, `role`, `planTier`       | Right after `101`              |
| `join.ok`        | `docId`, `roomSize`, `serverTime`            | After successful join          |
| `seats`          | `inUse`, `capacity`                          | Pushed when seats change       |
| `error`          | `code`, `message`, `retryable: bool`         | Recoverable errors             |
| `pong.app`       | `t: epoch-ms` (echoed)                       |                                |
| `kick`           | `reason: 'seat-revoked'\|'role-revoked'\|'admin'` | Followed by close 4403    |

### 4.3 Error codes (close + `error` JSON share the vocab)

- `4401 unauthenticated`
- `4403 forbidden` (RBAC or seat or doc-locked)
- `4404 doc-not-found`
- `4408 idle-timeout`
- `4409 conflict` (e.g. duplicate `pushRef` on same user/doc, evicting old)
- `4413 payload-too-large`
- `4426 protocol-upgrade-required` (client must update SDK)
- `4429 too-many-requests`
- `4500 server-error`

### 4.4 Event-name namespace

All JSON `type`s are dot-namespaced and stable across SDK versions:
`auth.*`, `join.*`, `presence.*`, `seats`, `error`, `kick`, `ping.app`,
`pong.app`. Adding a new namespace requires an additive ADR; renaming an
existing one is a breaking change requiring an SDK major.

---

## 5. Backpressure and rate-limit knobs

Per-connection state the gateway tracks and the policies it enforces:

| Knob                            | Default                     | Action on breach                                              |
| ------------------------------- | --------------------------- | ------------------------------------------------------------- |
| WS send queue depth (bytes)     | 1 MiB                       | Drain pause: stop reading from broadcast emitter for this socket; if still over after 5 s, close `4500` and let client reconnect |
| WS receive frame size (bytes)   | 256 KiB binary / 4 KiB JSON | Close `4413`                                                  |
| WS receive bytes / sec          | 512 KiB/s                   | Throttle: server stops `read()` for 250 ms; repeat offence → `4429` |
| Update messages / sec (inbound) | 60                          | Token-bucket; overage → drop frame + `error` warning          |
| Awareness msgs / sec (inbound)  | 30                          | Token-bucket; overage silently coalesced                      |
| Outbound coalesce window        | 16 ms                       | Server batches all room updates within window into one `0x7F` frame |
| Outbound max batch size         | 64 sub-frames or 256 KiB    | Whichever first; flush                                        |
| Upgrade attempts / IP / min     | 30                          | `429` HTTP at handshake                                       |
| Upgrade attempts / user / min   | 10                          | `429` HTTP at handshake                                       |
| Concurrent sockets / user       | 6                           | Newest wins: server closes oldest with `4409`                 |

The backpressure strategy is **shed, not buffer**: when a slow consumer hits
the 1 MiB queue cap we close it rather than growing memory. Yjs guarantees
eventual consistency on reconnect, so dropping the socket is safe.

Per-plan overrides for the rate-limit columns live in `src/lib/plans.ts`
(plan-tier → knob multiplier) so Free can't DoS a room shared with paid users.

---

## 6. Plan-tier seat enforcement at upgrade time

### 6.1 What a "seat" means

One seat = one active editor connection on one doc. Counted by `(workspaceId,
docId, userId)` — the same user editing in two tabs is still one seat (newest
wins, oldest is closed with `4409`).

### 6.2 Per-tier limits

Source of truth: `src/lib/plans.ts` (extended in Phase 8 sub-task #4). Initial
proposal mirrors the SabWa plan-limits pattern:

| Plan tier      | Concurrent seats / doc | Concurrent docs in collab / workspace |
| -------------- | ---------------------- | -------------------------------------- |
| `free`         | 1 (solo only)          | 1                                      |
| `starter`      | 3                      | 5                                      |
| `growth`       | 10                     | 50                                     |
| `scale`        | 25                     | unlimited                              |
| `enterprise`   | configurable           | configurable                           |

Free tier rejects the *second* concurrent seat — even read-only viewers count,
because awareness is the value-add.

### 6.3 Where the check runs

Three checkpoints, in order, all before `101` is sent:

1. **Token / cookie auth** resolves `(userId, workspaceId, planTier)`.
2. **RBAC** — `hasRbacKey(roleSet, 'sabflow:doc:read', docId)` via
   `src/lib/rbac-server.ts`. Fail → `403` close `4403`.
3. **Seat budget** — atomic Redis `INCR` on a key
   `sabflow:seats:{workspaceId}:{docId}` with a TTL refresh on every
   heartbeat. If the post-increment value exceeds the plan limit, decrement
   and reject with `403` + body `{code:'seat-limit', limit, planTier}`.

On socket close (any reason) the gateway runs the matching `DECR` in a
`finally`-style cleanup. A drift-recovery job (Vercel Cron, Phase 9) reconciles
the counter against the in-memory room size every 5 min to heal leaked
increments from crashed instances.

### 6.4 Live revocation

If the plan downgrades mid-session, the existing sockets are **not** killed
synchronously — that would feel hostile. Instead, the next heartbeat-tick
re-reads plan + RBAC and if the seat is now over-budget, the gateway emits
`kick {reason:'seat-revoked'}` and closes with `4403`. Other sockets in the
same workspace whose seat is still in-budget are untouched.

### 6.5 Credit metering hook

Active-seat-minutes are emitted to the credit-metering bus
(`src/lib/credits/*`, Phase 8 sub-task #5) every 60 s per connection. The
gateway is a *producer* only; metering / billing logic stays in the existing
SabNode credit subsystem.

---

## Open questions (resolve before Phase 3 implementation)

1. **Awareness over Redis at N=1.** Do we run Redis pub/sub from day 1 (single
   instance, single-process subscriber, no fan-out cost) or only when we add a
   second instance? Decision falls out of Phase 4 sync-protocol bench.
2. **Subprotocol token vs query-string token.** Subprotocol header is cleaner
   but some corporate proxies strip it. Confirm with one customer on a strict
   network before locking.
3. **Coalesce window**. 16 ms is a guess; bench harness (sibling sub-task #4)
   should sweep 4 / 8 / 16 / 32 ms.

---

## Summary (≤200 words)

**Service location.** Standalone `services/sabflow-ws/` Node process,
PM2-managed, mirroring `services/sabwa-node/`'s shape (port 4002, JWT-or-cookie
auth, `SABFLOW_WS_URL` + `SABFLOW_WS_TOKEN` env contract). **Not** a Next.js
route handler on Vercel Fluid Compute — WS lifetimes don't match Fluid's
request-shaped billing, instance recycling kills sockets mid-edit, and shared
in-memory rooms need single-process affinity Fluid doesn't guarantee. Vercel
still hosts the Next.js app; the gateway is reached via a Routing Middleware
rewrite from `/_sabflow/ws`. Same env contract leaves the door open for the
Rust swap if Phase 1's sibling bench shows ≥30% sustained gain.

**Message format.** Binary frames carrying the Yjs sync + awareness protocols
with a 1-byte tag prefix (sync / awareness / batch). JSON control plane on
text frames (`auth.*`, `join.*`, `presence.*`, `seats`, `error`, `kick`),
capped at 4 KiB. WS-native ping/pong every 30 s, 2-miss tolerance.

**Top 3 risks.**

1. Vercel rewrite latency on every WS handshake — adds a hop; might force
   direct-subdomain fallback for paying tiers.
2. Seat-counter drift between Redis and in-memory state on instance crash —
   leak-then-reconcile, but a noisy customer can hit phantom seat-limit errors.
3. Backpressure policy is *shed not buffer*; if Yjs sync-step-2 happens to
   land on a slow client during a deploy, that client may see repeated 4500
   reconnects until the doc fully syncs.
