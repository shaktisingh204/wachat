# SabFlow WS Gateway — Crash Recovery Runbook

- **Track / Phase / Sub-task:** Track A · Phase 9 · #1 (reliability hardening for the Phase 1 gateway)
- **Status:** Proposed
- **Owner:** SabFlow collab on-call
- **Related:** `docs/adr/sabflow-ws-gateway-node.md` (the gateway design this runbook drives), `docs/adr/sabflow-persistence.md` §6 (snapshot / oplog compaction the gateway feeds), `services/sabflow-ws/` (PM2 app `sabflow-ws`, port 4002), `docs/runbooks/sabflow-credentials-kms-rotation.md` (template).

> Scope. Covers the `services/sabflow-ws/` Node process (PM2 app `sabflow-ws`, port 4002) when it crashes or is force-restarted: Redis-side state reconciliation, client reconnect-storm management, sticky-session loss on the Vercel Routing Middleware rewrite path. Does **not** cover Yjs doc-level corruption (see `sabflow-doc-corruption.md`) or Redis split-brain (see `sabflow-redis-split-brain.md`). Plan-tier seat counters are touched here because the gateway is the seat-counter producer; the deeper credit-metering bus is owned by the Phase 8 billing subsystem.

---

## 1. Scope — what a "WS gateway crash" means here

The gateway is a single Node process (and, in multi-instance mode, N such processes behind a sticky LB) that holds:

- **In-memory room map.** One `Room` per `docId` containing a `Y.Doc`, an awareness map, and the list of subscriber sockets. The room *is* the live CRDT state until the next compaction fold (`sabflow-persistence` ADR §6).
- **Live WebSocket fds.** Each socket carries a `(userId, workspaceId, planTier, roleSet, seatId)` triple resolved at handshake (`sabflow-ws-gateway-node` ADR §3.2).
- **Redis-resident counters.** `sabflow:seats:{workspaceId}:{docId}` (atomic INCR/DECR per connection) and, in Phase 7 multi-instance mode, the `sabflow:awareness:*` pub/sub channels.
- **Per-doc `seq` allocator** (Phase 3 gateway-resident path) — a Redis `INCR` on `sabflow:seq:{docId}` whose value is written into each `sabflow_oplog` row as it is appended.

A **crash** is any of:

- PM2 reports the `sabflow-ws` app exited with non-zero status (`pm2 jlist | jq` shows `restart_time` bumped or `pm2 logs sabflow-ws --err`).
- Health probe `GET /healthz` on port 4002 returns 5xx for ≥3 consecutive scrapes (15s).
- The Vercel Routing Middleware rewrite at `/_sabflow/ws` returns 502/504 for handshake upgrades.
- N+1 instances drop out of the LB pool simultaneously (deploy roll, kernel OOM, host eviction).

When a crash happens:

- All sockets on that instance close with code `1006` (abnormal closure — no clean close frame). Clients enter the §3.6 reconnect-with-backoff loop from the gateway ADR.
- The in-memory `Room` for each affected doc evaporates. Any awareness state (cursor positions, selection ranges) is lost.
- Any `sabflow_oplog` writes that were in-flight (`appendUpdate` called, Mongo write not yet ack'd) may have landed, may not. The `(docId, seq)` UNIQUE index protects against dupes; **seq holes** are the failure mode to plan for.
- Seat counters in Redis leak — the `finally`-style DECR never ran. The gateway ADR §6.3 already commits to a 5-min reconciliation Cron; this runbook is how you trigger it on demand.

---

## 2. Detect

Detection is layered. Page on §2.1; investigate via §2.2; confirm-clean via §2.3.

### 2.1 Paging signals (these wake on-call)

- [ ] **PM2 process exit.** `pm2-logrotate` plus the `#sabflow-oncall` PagerDuty integration fires on `process:exit` events for app `sabflow-ws`. Threshold: any single exit during business hours, ≥2 within 5 min off-hours.
- [ ] **Healthz failing.** Uptime probe on `https://app.sabnode.com/_sabflow/ws/healthz` (rewrite into the gateway) returning non-2xx for ≥3 consecutive 5s probes (15s total). The Routing Middleware probe target lives in the same `vercel.json` block as the Phase 1 rewrite.
- [ ] **Handshake 502 spike.** Vercel Analytics → Routing Middleware → `4xx/5xx on /_sabflow/ws` exceeds 1% of upgrades over 60s (baseline is ~0.05%).
- [ ] **Client reconnect-storm anomaly.** Browser SDK emits `sabflow.ws.reconnect_attempt` to the Vercel Functions log; a >5x spike over the rolling 5-min baseline pages.
- [ ] **Seat-counter drift.** Phase 9 reconciliation Cron emits `sabflow.seats.drift` when `Redis(sabflow:seats:*) - sum(roomSize)` > 50 for a single workspace; this is a soft-page during a crash window.

### 2.2 Investigation order (first 10 minutes on-call)

- [ ] `pm2 list` on the gateway host(s) — confirm the app is `online` vs `errored` vs `stopped`. Restart counter is the canonical "did this just crash" signal.
- [ ] `pm2 logs sabflow-ws --err --lines 500` — grep for `RangeError`, `Out of memory`, `ECONNRESET`, `Unhandled rejection`. The gateway ADR §5 "shed not buffer" policy means a single bad doc can cascade if backpressure is wrong, so scan for the `4500 server-error` close-code emit too.
- [ ] `redis-cli --scan --pattern 'sabflow:*' | head -200` — sanity check the keyspace is reachable; if Redis itself is down, escalate to the split-brain runbook instead.
- [ ] `db.sabflow_oplog.find({}, { docId:1, seq:1, ts:1 }).sort({ ts:-1 }).limit(50)` — look at the most recent appends across docs. **A run of identical `seq` values across different docs is normal**; what you're looking for is whether appends stopped abruptly at the crash timestamp (expected) or whether they continued (means a different instance was healthy — partial outage, not full).
- [ ] Vercel deploy log — was a `services/sabflow-ws/` deploy in flight? PM2 rolling restarts are expected to cause one short reconnect cycle per instance; that's not a crash.

### 2.3 Confirm-clean (post-recovery)

- [ ] `pm2 describe sabflow-ws` shows `online`, `uptime` rising, `restarts` no longer incrementing.
- [ ] `/healthz` returns `{ status: "ok", rooms: <int>, sockets: <int> }` for ≥3 consecutive probes.
- [ ] `sabflow.ws.reconnect_attempt` rate is back within 1.5x of baseline.
- [ ] Seat-counter drift metric `sabflow.seats.drift` is at 0 for the affected workspaces (manual `reconcileSeats(workspaceId)` if not — §4.3).

---

## 3. Contain — stop the bleeding before recovering state

### 3.1 If a single instance is bad

- [ ] Drain it from the LB pool first (Vercel Routing Middleware: set `?weight=0` on the upstream entry, or `pm2 stop sabflow-ws` on the host so the health probe takes it out of rotation).
- [ ] Confirm sockets have migrated to surviving instances by watching `roomSize` on `/healthz` across the pool. Expect ~5–30s of reconnect churn.
- [ ] **Do not** force-kill (`pm2 kill`) without draining unless the process is wedged — uncontrolled kills compound the reconnect-storm in §3.3.

### 3.2 If the whole pool is bad (full outage)

- [ ] Flip the gateway into **maintenance mode** at the Routing Middleware layer: rewrite `/_sabflow/ws` to a static handler that closes with `4500 server-error` immediately. Browser SDK treats `4500` as retryable but the static handler will not 502, which calms the LB and stops cascading retries from clients with broken backoff state.
- [ ] Broadcast `doc.maintenance` over any surviving SSE channel (admin dashboard) so editors see a banner. The flag for this is `sabflow_settings.gatewayMaintenance = true` — checked by the Next.js editor shell on page load.
- [ ] Halt the Phase 9 seat-reconciliation Cron temporarily so it doesn't fight a partial recovery (`vercel env add SABFLOW_RECONCILE_PAUSED=true production`, redeploy, or toggle the entry in `vercel.json` if Cron entries are managed there).

### 3.3 Manage the reconnect storm

When the gateway comes back, every disconnected client retries. The gateway ADR §3.6 backoff (`1, 2, 4, 8, 15, 30s + jitter`) bounds the per-client rate but **N clients × hard arrivals at 1s** still hammers the handshake path. Containment knobs:

- [ ] **Server-side admission cap.** The gateway has a per-instance upgrade-attempts/sec cap (default 200/s; see ADR §5 "Upgrade attempts / IP / min" — same knob, instance-wide ceiling). Set `SABFLOW_WS_MAX_UPGRADES_PER_SEC=100` for the first 60s of recovery to throttle admission below sustainable Redis-INCR rate.
- [ ] **Server-side staggered ready.** Don't flip `/healthz` to ok until in-memory bookkeeping (room map, Redis subscriber, seq allocator) is fully primed. The LB will continue to 503 incoming upgrades until the probe is green, which gives clients more time to spread out their backoff jitter.
- [ ] **Client-side cap (already in SDK).** The `±20% jitter` in §3.6 of the gateway ADR is the primary defense; on-call's job is to verify the SDK rollout matches what's actually running (check the `sabflow-sdk` version histogram in Vercel Analytics — if >5% of traffic is on a pre-jitter build, escalate to a forced cache-bust of `/_next/static/` so users pick up the patched SDK).
- [ ] **Hard cap connections during recovery.** Set `SABFLOW_WS_MAX_SOCKETS_PER_INSTANCE=80%-of-prod-norm` for the first 5 min. Sockets over the cap close with `4429 too-many-requests`, which clients treat as retryable, deferring further.

### 3.4 Sticky-session loss on the rewrite path

The Routing Middleware rewrite is **not** sticky out of the box. In single-instance mode this doesn't matter (every socket lands on the one process). In multi-instance mode (Phase 7 onwards) we rely on Redis pub/sub fan-out to make room membership location-independent. If the LB rolls a client onto a different instance mid-edit, behaviour should be transparent — verify by:

- [ ] Confirm the Redis subscriber on each instance is connected (`/healthz.redis.subscribed == true`). If any instance lost its subscriber during the crash, that instance is serving stale awareness; mark it drained.
- [ ] If you suspect sticky-session is required (single-instance Phase 1 deploy, Redis fan-out not yet wired): set the LB to consistent-hash on `pushRef` (the per-tab UUID from the upgrade query string). Vercel Routing Middleware does not natively offer consistent-hash; the workaround is a direct subdomain (`wss://flow-rt.sabnode.com/ws` — gateway ADR §2.5 option 2) with the gateway behind a hash-aware proxy.
- [ ] **Do not** attempt to "pin" sockets by `userId` — `pushRef` is the right key because a single user can legitimately have multiple tabs landing on different instances (newest-wins concurrency, gateway ADR §6.1).

---

## 4. Recover — bring state back to consistent

State to recover lives in three places: Mongo (durable, mostly self-healing), Redis (volatile, needs reconciliation), in-process room map (rebuilt on demand on next `join`).

### 4.1 Mongo / oplog: heal `seq` holes if any

The `(docId, seq)` UNIQUE index prevents corruption; the failure mode is **gaps** in `seq` for a doc that had an in-flight append at crash time.

- [ ] For each "hot" doc (any doc with a connection in the last 5 min before crash), run:

  ```ts
  const tail = await db.sabflow_oplog
    .find({ docId }, { seq: 1 })
    .sort({ seq: 1 })
    .toArray();
  // Detect gaps: expected seq == previous + 1.
  ```

- [ ] **Gaps are tolerable**, not catastrophic — Yjs CRDT semantics make `applyUpdate` commutative and idempotent. A missing `seq` means an update was dropped before durable persistence; the originating client will re-send on reconnect via the `lastSyncedClock` hint (gateway ADR §3.6 step 2).
- [ ] **What you do is NOT renumber `seq`**. Renumbering breaks the compaction worker's seq-fence (`sabflow-persistence` ADR §6 — worker only folds `seq ≤ snapshotSeq`). Leave the holes; the compaction worker handles them on the next fold.
- [ ] If a gap exceeds 50 entries for a single doc, that's a flag for the doc-corruption runbook (`sabflow-doc-corruption.md` §3) — escalate.

### 4.2 In-process room map: lazy rebuild on demand

- [ ] Do **not** preemptively warm rooms. The gateway's `Room` is created lazily on the first `{type:"join", docId}` after restart. Preemptive warm-up duplicates work for docs nobody reopens.
- [ ] Verify the first few joins by tailing logs: `pm2 logs sabflow-ws | grep 'room.created'` — confirm `loadDoc(workspaceId, docId)` from the persistence repo returns within the per-tier SLO (Phase 8 plan ladder; 500ms for `pro`, 2s for `free`).
- [ ] If a room fails to materialise (loadDoc throws), check whether the underlying snapshot is corrupted — fall through to `sabflow-doc-corruption.md`.

### 4.3 Redis: reconcile seat counters

The `finally`-style DECR on close didn't run for any socket that crashed. The result: `sabflow:seats:{workspaceId}:{docId}` is **over-counted**. Clients hitting the gateway after restart see `seat-limit` rejections that are false positives.

- [ ] Run the reconciliation routine manually:

  ```ts
  import { reconcileSeats } from '@/lib/sabflow/gateway/seats';
  // For a single workspace:
  await reconcileSeats({ workspaceId });
  // Or sweep all workspaces with non-zero counters:
  await reconcileSeats({ all: true });
  ```

  The routine reads in-memory room sizes (`/healthz.rooms[].seatCount`) across the gateway pool and `SET`s each `sabflow:seats:*` key to the observed value. This is **destructive write** — only run when the gateway is healthy and serving live traffic, otherwise you'll briefly under-count.

- [ ] If `reconcileSeats` itself fails (Redis unreachable), do not retry-loop — escalate to `sabflow-redis-split-brain.md`.
- [ ] After reconcile, unpause the Phase 9 Cron: `vercel env rm SABFLOW_RECONCILE_PAUSED production` and redeploy.

### 4.4 Restore client traffic

- [ ] Flip the Routing Middleware rewrite back to live (remove the maintenance handler). New upgrades flow to the gateway.
- [ ] Unset `sabflow_settings.gatewayMaintenance`.
- [ ] Monitor `/healthz`, the reconnect-attempt rate, and Mongo write throughput for 15 min. Roll back to maintenance if any metric drifts outside §2.3 thresholds.

### 4.5 Multi-instance: bring drained instances back

- [ ] One at a time: `pm2 start sabflow-ws` on the drained host, wait for `/healthz` green, return to LB pool. Wait ≥60s between hosts so each takes a measured share of the reconnect load.
- [ ] Verify the Redis subscriber connects on each instance (`/healthz.redis.subscribed`).

---

## 5. Post-mortem — file within 5 business days

- [ ] Open a doc under `docs/runbooks/incidents/<YYYY-MM-DD>-ws-gateway-crash.md` using the standard incident template.
- [ ] Required sections:
  - **Timeline.** Page time → on-call ack → drain → restart → healthy. Wall-clock per phase.
  - **Root cause.** OOM / unhandled exception / dependency outage / deploy-induced / external (Vercel platform). Cite the log line.
  - **Blast radius.** Number of affected docs, workspaces, users. Total reconnect count from the SDK metric. Plan-tier breakdown for SLA tracking.
  - **Data integrity.** Seq-hole count, doc-corruption escalations, seat-counter drift size at recovery.
  - **What went well / what didn't.** Be specific: which detection signal fired first, where the runbook was wrong, what tooling you wished you had.
- [ ] Action items: file each as a tracked task with an owner. Common categories:
  - Memory-leak fix in the gateway → Track A Phase 9 bench harness.
  - Detection gap → add a new metric / alarm.
  - Backoff tuning → bump SDK version.
  - Sticky-session gap → revisit gateway ADR §2.5.
- [ ] If RTO exceeded the plan-tier SLO for any `pro` / `business` / `enterprise` workspace, raise a sev-2 follow-up; if the crash induced data loss (seq-hole that didn't self-heal on reconnect, doc went unreadable), raise sev-1 and link to `sabflow-doc-corruption.md`.
- [ ] Update §3.3 reconnect-storm caps in this runbook based on what actually worked.
- [ ] Run a tabletop walk-through of the incident at the next `#sabflow-oncall` weekly.

---

## 6. Quick reference

| Operation                                         | Command / call                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| Check gateway status                              | `pm2 describe sabflow-ws` / `curl https://app.sabnode.com/_sabflow/ws/healthz` |
| Drain an instance                                 | `pm2 stop sabflow-ws` on the host (LB drops it on next probe)                  |
| Maintenance mode                                  | Toggle Routing Middleware rewrite → static `4500` handler                      |
| Cap admission during reconnect storm              | `SABFLOW_WS_MAX_UPGRADES_PER_SEC=100` (env, then redeploy)                     |
| Cap sockets/instance                              | `SABFLOW_WS_MAX_SOCKETS_PER_INSTANCE=<N>` (env)                                |
| Reconcile seat counters (one workspace)           | `await reconcileSeats({ workspaceId })`                                        |
| Reconcile seat counters (all workspaces)          | `await reconcileSeats({ all: true })`                                          |
| Pause / unpause seat-reconciliation Cron          | `vercel env add/rm SABFLOW_RECONCILE_PAUSED production`                        |
| Inspect oplog tail for a hot doc                  | `db.sabflow_oplog.find({ docId }).sort({ seq:1 })`                             |
| Force a client to re-sync (after recovery)        | Broadcast `doc.restored` over the room (gateway admin tool)                    |
