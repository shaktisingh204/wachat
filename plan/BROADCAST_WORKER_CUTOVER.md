# Broadcast Worker Cutover Playbook

Phase 9 of the wachat broadcast → Rust port. Migrates the broadcast send
worker from `src/workers/broadcast/index.js` (Node + BullMQ) to a native
Rust BullMQ consumer (the `wachat-broadcast-worker` binary produced by
Agents 1+2).

This document covers only the cutover. Implementation details for the
Rust worker live in its own crate-level docs.

---

## 1. Pre-cutover checklist

### 1a. Code

- [ ] `rust/crates/wachat-broadcast-worker` binary builds clean
      (`cargo build --release -p wachat-broadcast-worker`).
- [ ] `BROADCAST_WORKER_CUTOVER.md` (this file) reviewed by on-call.
- [ ] `ecosystem.config.js` filter logic verified locally with both
      `BROADCAST_WORKER=node` and `BROADCAST_WORKER=rust`
      (`pm2 ecosystem` dry-run prints the expected app set).
- [ ] Phase-9 broadcast counter Rust endpoint
      (`POST /v1/wachat/webhook-status/broadcast-statuses`) deployed and
      reachable from the Node webhook receiver
      (`src/lib/webhook-processor.ts:processStatusUpdateBatch`).

### 1b. Env vars

Set in the deploy environment BEFORE the first `pm2 start`:

```bash
# Cutover knob. Default 'node'. Flip to 'rust' to switch.
BROADCAST_WORKER=node

# Same Redis the Node worker uses. The Rust binary connects with the
# same client tag so BullMQ prefetch + retry semantics carry over.
REDIS_URL=redis://...

# Mongo handle for direct broadcast_contacts / broadcasts I/O.
MONGODB_URI=mongodb://...
MONGODB_DB=...

# Required by the Rust send-call path (Meta token resolve + JWT).
RUST_JWT_SECRET=...
FACEBOOK_APP_SECRET=...

# Optional. Pin instance count — defaults to 1 for Rust (native async
# fan-out) and 4 for Node (PM2 cluster mode for throughput).
BROADCAST_WORKER_INSTANCES=1
```

### 1c. Observability

- [ ] Rust binary logs flow into the same log aggregator as `sabnode-api`
      (Loki / CloudWatch / etc.).
- [ ] Metrics scraped at `:9090/metrics` on the Rust binary if exposed
      (Agents 1+2 — confirm before flipping).
- [ ] Dashboard panel "Broadcast send rate (msg/s)" wired to whichever
      worker is alive (label by `service=node-worker|rust-worker`).
- [ ] Alert "Broadcast worker queue lag > 10 min" pages on-call.

### 1d. Data parity

- [ ] BullMQ queue names match exactly:
      `broadcast-control` and `broadcast-send` on both workers (Phase 1
      from Agent 1).
- [ ] Job payload shape matches (Phase 2 from Agent 2 — see
      `BROADCAST_PARITY.md` if it exists, or the
      `wachat-queue::JobOptions` DTO).
- [ ] Phase-1 rate-limiter alignment: Redis token-bucket key format is
      `wachat:rl:broadcast:{broadcastId}` on both sides.
- [ ] Webhook broadcast counters now go through Rust on every env (set
      pre-cutover so a Rust worker increment + Node webhook increment
      don't double-count during the transition).

---

## 2. Staging cutover

Run on staging before touching prod. Total expected wall-clock: ~30 min.

1. **Deploy code.** All three of: Rust BFF (already running), Rust
   `broadcast-worker` binary, Node site with the migrated webhook
   processor (this PR).

2. **Establish baseline (still on Node).**
   - Trigger a 100-contact test broadcast. Use a project with a junk
     audience (internal opt-in list).
   - Record:
     - Wall-clock from `START` → `COMPLETED` (`broadcasts.startedAt` →
       `broadcasts.finishedAt`).
     - Final `successCount`, `failedCount`, `deliveredCount`, `readCount`
       on the `broadcasts` document.
     - Job counts per BullMQ queue: `bullmq.broadcast-control.completed`,
       `bullmq.broadcast-send.completed`.

3. **Flip the flag.**
   ```bash
   BROADCAST_WORKER=rust pm2 reload ecosystem.config.js --update-env
   ```
   Confirm `pm2 list` shows `sabnode-broadcast-worker` as `cargo run...`
   not `node ./src/workers/broadcast/index.js`.

4. **Verify Redis connection.** `redis-cli CLIENT LIST | grep broadcast`
   should show the Rust binary's client tag, not the Node one.

5. **Re-run the same 100-contact test broadcast.**
   - Same audience, same template, same time of day window.
   - Compare counts to the baseline. Acceptance threshold:
     `|rustCount - nodeCount| / nodeCount < 1%` for each of `success`,
     `delivered`, `read`.
   - Wall-clock within ±20% of baseline (Rust should be ≥ Node).

6. **Run a 24h soak.** Leave staging on `rust` overnight. Watch:
   - Queue lag stays < 30s.
   - `broadcasts.failedCount` ratio across the day matches the Node
     baseline within 1%.
   - No DLQ entries written by the Rust worker (or, if any, they are
     identical in shape to what the Node worker wrote previously).

If any check fails → see § 4 (Rollback).

---

## 3. Production canary

3a. **One-tenant flag toggle (preferred).** If the deploy environment
supports per-tenant env override (e.g. via the operator dashboard at
`/dashboard/admin/feature-flags`), set `BROADCAST_WORKER=rust` for one
internal tenant first.

The Rust + Node workers can NOT coexist in production: BullMQ queue
ownership is global. Per-tenant flagging therefore means swapping the
worker for the WHOLE deploy with the test tenant's traffic gating which
binary actually executes the job (worker reads the flag and refuses jobs
where the broadcast's `tenant_id` does not match the configured allow
list). If the Rust worker doesn't yet support per-tenant gating, skip to
3b.

3b. **Percentage rollout via separate Redis prefix.** Run BOTH workers
simultaneously, each pointed at a DIFFERENT BullMQ queue prefix
(`bullmq-canary:` for Rust, `bullmq:` for Node). Route N% of new
broadcasts to the canary prefix from the producer side
(`src/app/actions/broadcast.actions.ts` already enqueues via
`wachat-queue::enqueue_control` — pick the prefix at enqueue time based
on `Math.random() < CANARY_RATE`). Increase from 1% → 10% → 50% → 100%
with a 30-min hold at each step.

3c. **All-in flip.** Once the canary is at 100% for ≥ 24h with no
incidents:

```bash
# On every prod node:
BROADCAST_WORKER=rust pm2 reload ecosystem.config.js --update-env
pm2 save
```

After the flip, monitor for 1h before stepping away. Key dashboards:

- Broadcast send rate (target: stable, no drop > 10%).
- Meta API 4xx rate (must not increase — would mean payload-shape skew).
- Queue depth on both `broadcast-control` and `broadcast-send` (must
  stay flat or trend down).

---

## 4. Rollback procedure

Goal: ≤ 1 minute from "rollback decision" to "Node worker is the only
worker accepting broadcast jobs."

```bash
# On every prod node, in parallel:
BROADCAST_WORKER=node pm2 reload ecosystem.config.js --update-env
pm2 save
```

What this does:

1. PM2 re-evaluates `ecosystem.config.js` with the new env.
2. The conditional filter at the top of the file removes the Rust
   broadcast-worker app from the active set and re-adds the Node one.
3. PM2 stops the Rust binary (it gets `kill_timeout: 30000ms` to drain
   in-flight jobs cleanly) and starts the Node worker fresh.
4. BullMQ consumers reconnect; pending jobs resume on the Node worker.

If step 3 hangs (Rust binary refuses to drain), force:

```bash
pm2 delete sabnode-broadcast-worker
BROADCAST_WORKER=node pm2 start ecosystem.config.js
```

In-flight jobs will be retried by BullMQ — the worker port preserves
job idempotency keys so a partial Rust send + a Node retry will not
double-send.

---

## 5. Cleanup (post-cutover, after N days on `rust`)

Defer to **Task 9** of the broadcast worker port. Do NOT delete during
the cutover window.

After 14 days on `BROADCAST_WORKER=rust` with zero rollbacks:

- [ ] Delete `src/workers/broadcast/` (the Node worker) entirely.
- [ ] Delete the `BROADCAST_WORKER === 'node'` branch from
      `ecosystem.config.js`. Keep the env var as a hard check (throw on
      anything other than `'rust'`) for one more release, then remove.
- [ ] Delete `worker.js` (the legacy poller — already obsolete; only
      kept around for in-flight broadcasts queued under the pre-BullMQ
      code path).
- [ ] Drop the `BROADCAST_USE_BULLMQ` env var — meaningless once Node
      worker is gone.
- [ ] Update `ecosystem.config.js` so `sabnode-broadcast-worker` is a
      single app definition with no conditional.

---

## 6. Known wire-compat caveats

- **Rate limiter** — aligned per Phase 1 (Agent 1). Both workers share
  the same Redis token-bucket key format
  (`wachat:rl:broadcast:{broadcastId}`) and the same per-broadcast MPS
  semantics. Switching workers mid-broadcast is safe: the next batch
  resumes at the rate the previous worker left off.
- **BullMQ producer ↔ consumer parity** — Phase 2 (Agent 2). Job
  payload shape is fixed across Rust + Node. The producer
  (`src/app/actions/broadcast.actions.ts` and the Rust
  `wachat-broadcast::handlers::start`) writes the SAME shape regardless
  of which worker will pick it up.
- **Webhook broadcast counters** — Phase 9 (this task). Migrated to the
  Rust endpoint
  `POST /v1/wachat/webhook-status/broadcast-statuses`. Status-hierarchy
  and field names (`broadcast_contacts.status`,
  `broadcasts.deliveredCount`, `broadcasts.readCount`) are byte-for-byte
  the same as the previous TS implementation, so a Rust send-counter
  increment + a Node-era webhook increment cannot disagree on the
  resulting document.
- **DLQ** — both workers write to `bullmq:broadcast-control:dlq`. The
  Rust DLQ payload is a strict superset of the Node one (extra `traceId`
  field). Existing DLQ tooling treats unknown fields as opaque.
- **Outgoing message log** — UNCHANGED. The Node webhook receiver
  still owns the `outgoing_messages.bulkWrite` for status updates.
  Phase 9 migrates ONLY the broadcast counter side effects, not the
  per-message status log. That migration is on the roadmap as a separate
  slice but is not on the critical path for the worker cutover.

---

## 7. Final wiring step (before this playbook is actionable)

The Rust broadcast-counter endpoint code is in place
(`rust/crates/wachat-webhook-status/src/{broadcast,handlers,router,state}.rs`).
The orchestrating `api` crate must mount it. One-line additions:

In `rust/crates/api/src/state.rs`:

```rust
use wachat_webhook_status::WachatWebhookStatusState;

// in AppState:
pub webhook_status: WachatWebhookStatusState,

// in AppState::new args + body: pass through.

// FromRef impl:
impl FromRef<AppState> for WachatWebhookStatusState {
    fn from_ref(s: &AppState) -> Self { s.webhook_status.clone() }
}
```

In `rust/crates/api/src/router.rs`:

```rust
let webhook_status = wachat_webhook_status::router::<AppState>();
// ...
.nest("/v1/wachat/webhook-status", webhook_status)
```

In `rust/crates/api/src/main.rs`, at AppState construction:

```rust
let webhook_status_state = wachat_webhook_status::WachatWebhookStatusState::new(mongo.clone());
// pass into AppState::new(...)
```

These are deferred to whichever agent owns the orchestrator wiring step
of the broadcast-worker port — they live OUTSIDE this task's file
ownership.
