# SabFlow Redis — Pub/Sub Split-Brain Detection & Recovery Runbook

- **Track / Phase / Sub-task:** Track A · Phase 9 · #2 (reliability hardening for the Phase 7 multi-instance gateway)
- **Status:** Proposed
- **Owner:** SabFlow collab on-call
- **Related:** `docs/adr/sabflow-ws-gateway-node.md` §1.2 (Redis pub/sub backplane for multi-instance fan-out), §5 (seat counters in Redis), §6.3 (atomic seat INCR/DECR), `docs/adr/sabflow-persistence.md` §6 (per-doc `seq` allocator may be Redis-resident), `docs/runbooks/sabflow-ws-gateway-crash.md` (gateway-side counterpart — read first if the gateway is also unhealthy).

> Scope. Covers Redis when the gateway pool **splits its view** of pub/sub state — one or more instances see writes other instances don't, awareness messages stop crossing instance boundaries, seat counters fork between primary and replica, or the `seq` allocator double-issues. Does **not** cover: complete Redis outage (the gateway falls back to single-instance no-fanout mode automatically; pages on-call but the playbook is "wait for Redis to come back"); per-doc CRDT corruption (`sabflow-doc-corruption.md`); gateway-process crashes that aren't Redis-induced (`sabflow-ws-gateway-crash.md`).

---

## 1. Scope — what split-brain means for SabFlow

Redis is **not** SabFlow's source of truth. Mongo is. But Redis carries three pieces of in-flight state that, if forked, produce user-visible inconsistency:

- **Pub/sub fan-out for awareness and updates.** Each gateway instance `SUBSCRIBE`s on `sabflow:room:{docId}` (or a shared `sabflow:fanout:*` channel). When a write arrives on instance A and is `PUBLISH`'d, instance B's subscriber forwards it to instance B's local sockets. Split-brain here means **a publish on A's Redis isn't seen by B's Redis** — typically because A and B are talking to two different Redis nodes that have lost replication to each other (a failover gone half-baked, a Sentinel misconfiguration, a Marketplace integration regional split).
- **Seat counters.** `sabflow:seats:{workspaceId}:{docId}` is incremented atomically per connection (gateway ADR §6.3). If A and B are reading/writing different Redis primaries, the counter on each side reflects only that side's sockets — total seat enforcement breaks.
- **Per-doc `seq` allocator.** The gateway's append path may use a Redis `INCR` on `sabflow:seq:{docId}` to allocate the next oplog `seq` (persistence ADR §5.1 — the Mongo counter is the alternative). A forked allocator hands out **duplicate seq values across instances**, which collide on the `(docId, seq)` UNIQUE index and surface as `appendUpdate` write failures.

In practice split-brain manifests as one of:

- Awareness "dead zone": users on instance A see each other, users on instance B see each other, but A and B users are invisible to each other in the same doc.
- Seat-limit false positives **or** false negatives: a `pro` workspace that should hit its 10-seat cap admits 19 sockets, or rejects the 4th when only 3 are actually connected.
- `appendUpdate` writes failing with `E11000 duplicate key error` on `(docId, seq)`. The gateway logs `MongoServerError: duplicate key` and the originating client sees an `error.code = 4500 server-error` plus a close-and-retry.
- Compaction lock `SETNX sabflow:compact:<docId>` succeeds on two instances simultaneously, producing two competing fold writes — caught by the optimistic `version` check (persistence ADR §6) but wasteful and noisy in logs.

---

## 2. Detect

The detection job is to distinguish split-brain from its lookalikes: full Redis outage, single-instance gateway crash, doc-level corruption, and "the Marketplace integration is just slow today."

### 2.1 Paging signals

- [ ] **Awareness-fan-out mismatch.** Phase 9 reliability probe `sabflow.fanout.echo` writes a synthetic awareness event on each instance and asserts it arrives on every other instance's subscriber within 500ms. Misses → page.
- [ ] **Seat-counter drift across instances.** The Phase 9 seat-reconcile Cron compares `Redis.GET(sabflow:seats:*)` against `sum(roomSize)` across the gateway pool. Drift > 50 for any single workspace, sustained across two consecutive 5-min windows → page.
- [ ] **Oplog duplicate-key spike.** `MongoServerError code 11000` on collection `sabflow_oplog` exceeding 5 events/min (baseline ~0/min) → page.
- [ ] **Two compaction folds for the same doc.** `sabflow_audit_log` (or, until Phase 2 #9 ships, the gateway's `compact.*` log line) shows two `version` bumps for the same `docId` within 5s → page.
- [ ] **Redis replication lag.** Marketplace Redis integration (or self-hosted Sentinel/Cluster) emits `replication_lag_seconds > 30` → page. This is the **leading** indicator; if you act here you can usually prevent §2.1's lagging indicators.

### 2.2 Investigation order (first 10 min)

The split-brain confirmation procedure is small and worth running before any containment:

- [ ] On every gateway host: `redis-cli -u "$REDIS_URL" INFO replication`. Compare the `role`, `master_host`, `master_port`, and (on replicas) `master_link_status` fields. **If two hosts report `role: master` for the same logical instance, you have a definite split-brain.**
- [ ] On every gateway host: `redis-cli -u "$REDIS_URL" CLIENT LIST | grep sabflow-ws` — confirm the subscriber is connected, has been for the expected uptime, and is on the expected master.
- [ ] **Marker write** — write a unique sentinel from instance A and read it from instance B:

  ```bash
  # Run on host A
  redis-cli -u "$REDIS_URL_A" SET sabflow:probe:$(date +%s) "from-A" EX 60
  # Run on host B (within 60s)
  redis-cli -u "$REDIS_URL_B" KEYS 'sabflow:probe:*'
  ```

  If B doesn't see the key, A and B are pointed at different masters — full split.
- [ ] **Publish-marker** — same but for pub/sub:

  ```bash
  # Host B subscribes
  redis-cli -u "$REDIS_URL_B" SUBSCRIBE sabflow:probe:fanout
  # Host A publishes
  redis-cli -u "$REDIS_URL_A" PUBLISH sabflow:probe:fanout "ping-$(date +%s)"
  ```

  If B's subscriber doesn't print the message within 2s, fan-out is broken between A and B.
- [ ] Check the Marketplace integration dashboard (Vercel → Integrations → the Redis vendor → Cluster health). For Sentinel-managed clusters look for `+sdown` / `+odown` events; for Cluster mode look for cluster bus partitions in the cluster nodes output.

### 2.3 Confirm-clean (post-recovery)

- [ ] Marker write/publish probes (§2.2) pass.
- [ ] `INFO replication` shows a single master, all replicas with `master_link_status: up` and `lag: 0`.
- [ ] `sabflow.fanout.echo` synthetic probe is green for ≥3 consecutive 60s windows.
- [ ] No new `E11000` duplicate-key errors on `sabflow_oplog` for ≥15 min.
- [ ] Seat counters across the pool match `sum(roomSize)` (run `reconcileSeats({ all: true })` and verify the post-reconcile drift is ≤2 per workspace — small drift is normal during live traffic).

---

## 3. Contain — stop divergence from getting worse

The principle: **the longer split-brain persists, the more state diverges, the more painful the merge.** Containment is about freezing writes to one side so the other becomes the authority.

### 3.1 Pick a winner

- [ ] If a Sentinel or Cluster failover is in progress, **wait** for it to complete (≤60s typically) before doing anything else. Half the time the system heals itself.
- [ ] If both masters have writes and there's no obvious winner: the side with **more recent `LASTSAVE` and lower replication lag delta** wins. Tie-break by region: the master in the region with the gateway pool's plurality wins.
- [ ] **Document the choice** in `#sabflow-oncall` before acting. Subsequent operators must not flip the decision mid-recovery.

### 3.2 Quiesce the losing side

- [ ] Drain gateway instances pointed at the losing master, in order: `pm2 stop sabflow-ws` on each host. The sockets close with `1006`; clients reconnect, get rebalanced to surviving hosts (which point at the winning master). This is the gateway-crash playbook in miniature (`sabflow-ws-gateway-crash.md` §3.1).
- [ ] If draining alone isn't fast enough (writes still landing on the losing side because of, e.g., a gateway with cached connection state): force the losing Redis into `--readonly` mode (`CONFIG SET min-replicas-to-write 999` — unsatisfiable, blocks writes) so subsequent writes fail explicitly rather than diverging further.
- [ ] **Do not** `DEBUG RELOAD` or `FAILOVER` from the CLI without coordination with the Redis vendor's support — those commands can compound the problem.

### 3.3 Stop the secondary writers

The gateway is the dominant Redis writer, but two others touch the same keyspace:

- [ ] **Seat-reconcile Cron** — pause: `vercel env add SABFLOW_RECONCILE_PAUSED=true production`, then redeploy. This Cron runs `SET sabflow:seats:*` based on observed in-memory state; running it against a split brain corrupts the winning side with the loser's room map.
- [ ] **Compaction worker** — pause: it's a separate process (`services/sabflow-ws/` runs the gateway; compaction runs in a Vercel Cron-triggered Function, persistence ADR §6). Set `SABFLOW_COMPACT_PAUSED=true` and redeploy. The worker acquires `SETNX sabflow:compact:<docId>` locks; during a split it can acquire the lock twice (once per master) and produce competing folds.
- [ ] **Anything else hitting the `sabflow:*` keyspace** — there shouldn't be anything else. Confirm by `redis-cli MONITOR | grep sabflow` for 30s; if you see writes from a process that isn't the gateway or the workers, escalate to `#sabflow-eng`.

### 3.4 If split-brain spans regions (Marketplace multi-region)

- [ ] Engage the Marketplace integration's support immediately (Vercel → Integrations → vendor support). Regional split-brain on a managed cluster is almost always faster to resolve via the vendor's tools than from app code.
- [ ] While waiting, accept temporary regional partition: each region's gateway pool operates against its local master, **and tells the SDK to short-circuit cross-region awareness** by emitting `kick {reason:'admin'}` to any session whose `workspaceId` is in the affected list. Users see "collab unavailable, try again in 5 min" rather than ghost-cursor confusion.

---

## 4. Recover — reconcile state, then bring losers back

### 4.1 Make the winner authoritative

- [ ] Confirm the winning Redis master is healthy: `INFO replication` shows `role:master`, replicas re-attaching successfully (`master_link_status: up` from each replica's side).
- [ ] The losing master is now **discarded**: do **not** reconnect any gateway to it. If it's a Sentinel cluster, mark the losing node out of rotation; if it's Cluster mode, run the vendor's documented "remove and re-add node" procedure.
- [ ] If the losing master held writes that aren't on the winner: those writes are **lost** for the keys we care about. That's acceptable because:
  - **Pub/sub messages** are inherently fire-and-forget; Yjs re-sync on the client's next reconnect heals the data.
  - **Seat counters** will be rewritten by §4.3.
  - **`seq` allocator** is rebuilt by §4.4.
  - **Compaction locks** are short-TTL (15s) and self-heal on expiry.

### 4.2 Reconcile the data we do care about

The only Redis state that matters for correctness is what the gateway can recompute from Mongo + in-memory room state. Walk each:

#### 4.2.1 Pub/sub (no reconciliation needed)

Pub/sub is volatile by design — there's no historical state to reconcile. The act of bringing gateways back online and resubscribing on the winning master fully restores fan-out. Validate via `sabflow.fanout.echo` from §2.1.

#### 4.2.2 Seat counters

- [ ] After the gateway pool is healthy on the winning Redis (§4.5), run:

  ```ts
  import { reconcileSeats } from '@/lib/sabflow/gateway/seats';
  await reconcileSeats({ all: true });
  ```

  This iterates every workspace with a non-zero seat key, reads each gateway's `/healthz.rooms[].seatCount`, sums per `(workspaceId, docId)`, and writes the result back with `SET sabflow:seats:{ws}:{doc} <value> EX 3600`.
- [ ] Verify post-reconcile: `redis-cli GET sabflow:seats:<workspaceId>:<docId>` should match the sum of `roomSize` for that doc across the pool. Drift > 2 is a sev-3 follow-up.

#### 4.2.3 `seq` allocator

The allocator's value should equal the max `seq` already in Mongo for each doc. If the split caused the allocator to fall behind reality (because a now-discarded master held the higher value), set it forward:

- [ ] For each `docId` with recent traffic (last 1h):

  ```ts
  const maxSeq = await db.sabflow_oplog
    .find({ docId })
    .sort({ seq: -1 })
    .limit(1)
    .project({ seq: 1 })
    .toArray();
  await redis.set(`sabflow:seq:${docId}`, maxSeq[0].seq);
  ```

- [ ] **Never decrement the allocator** even if it's ahead of Mongo. Holes in `seq` are fine (per `sabflow-ws-gateway-crash.md` §4.1); collisions are not.
- [ ] If you don't know which docs to scan, run the Phase 9 `seqDriftScan` admin task — it sweeps all docs touched in the last 24h.

#### 4.2.4 Compaction locks

- [ ] `redis-cli --scan --pattern 'sabflow:compact:*' | xargs -r redis-cli DEL` — all locks are short-TTL anyway; clearing them is safe once the pool is healthy. The compaction worker will reacquire as needed.

### 4.3 Resolve oplog duplicate-key residue

The `E11000` errors during split-brain mean the **second** write attempt for a collided `seq` failed cleanly — the data isn't double-written. The originating client should have retried via the gateway's `error 4500` → reconnect → re-sync path. Verify:

- [ ] For each `docId` that hit `E11000` during the incident window:
  - Read the doc's `lastEditorId` and confirm a recent successful `appendUpdate` exists for that user (within 5 min of the failures).
  - If not, that client's edits **never landed**. Ask the SDK to re-sync by broadcasting `doc.restored` over the room — clients respond by emitting their `Y.Doc` state vector and the gateway fills any gap.
- [ ] If a doc shows `E11000` for >50 distinct `seq` values, escalate to `sabflow-doc-corruption.md` §3 — the doc may have wedged in a state the auto-resync can't recover from.

### 4.4 Unpause secondary writers

In the same order they were stopped:

- [ ] Compaction worker: `vercel env rm SABFLOW_COMPACT_PAUSED production`, redeploy. Wait for the first scheduled fold to complete cleanly on a low-traffic doc before moving on.
- [ ] Seat-reconcile Cron: `vercel env rm SABFLOW_RECONCILE_PAUSED production`, redeploy.

### 4.5 Bring drained gateway instances back

- [ ] On each previously-drained host: confirm the Redis client config points at the winning master (or the Sentinel/Cluster endpoint that now resolves to it). For Marketplace integrations the env var is auto-managed — `vercel env pull` and verify `REDIS_URL` on the host matches what Vercel provisioned.
- [ ] `pm2 start sabflow-ws`. Wait for `/healthz` green plus `/healthz.redis.subscribed == true` before moving to the next host. ≥60s between hosts (mirrors `sabflow-ws-gateway-crash.md` §4.5).
- [ ] Run `sabflow.fanout.echo` between each pair of restored hosts to confirm fan-out is symmetric.

### 4.6 Tell clients to re-sync

- [ ] Broadcast `doc.restored` from the gateway admin tool to every doc in the affected workspaces. The SDK responds by emitting its current state vector; the gateway replies with the diff. This is the same path used by `sabflow-ws-gateway-crash.md` §4.2 and the persistence-backup runbook §3.1.
- [ ] Monitor `sabflow.ws.reconnect_attempt` and `sabflow.sync.diff_size` for 15 min. Large diffs are expected (because of awareness fan-out gaps during the split) but should taper within 5 min.

---

## 5. Post-mortem — file within 5 business days

- [ ] Open a doc under `docs/runbooks/incidents/<YYYY-MM-DD>-redis-split-brain.md`.
- [ ] Required sections (extend the standard template):
  - **Timeline.** First lagging-indicator alert → marker-write confirmation → winner picked → drain complete → reconcile complete → green. Wall-clock per phase.
  - **Root cause.** Which Redis topology component failed and why: failover that didn't promote, network partition, Marketplace integration deploy, OOM on a node, Sentinel quorum loss. Cite the vendor's incident report if applicable.
  - **Blast radius.** Affected docs, workspaces, users; how many seats were misenforced (high or low); how many `E11000` events fired; how many doc-corruption escalations spun out of this.
  - **Data integrity.** Confirm no doc-level data loss (Mongo is source of truth) — if a doc *did* corrupt, that escalation is owned by `sabflow-doc-corruption.md` and linked here.
  - **What went well / what didn't.** Did marker probes (§2.2) reproduce cleanly? Was the pause-the-secondary-writers step missed? Did `reconcileSeats({ all: true })` finish in the expected time?
- [ ] Action items, common:
  - **Topology change.** If split-brain came from a single-master no-replica config, that's the headline AI: move to a Marketplace integration tier that includes auto-failover.
  - **Detection gap.** If lagging indicators paged before leading indicators, retune §2.1 thresholds.
  - **Tooling.** Was the marker-publish probe in §2.2 hard to run? Add a `gateway-admin` command for it.
- [ ] If split-brain caused doc data loss for any `pro` / `business` / `enterprise` workspace, raise sev-1 and link to the doc-corruption runbook; otherwise sev-2.
- [ ] Walk the incident at the next `#sabflow-oncall` weekly. Update §3.1 winner-selection criteria if the chosen heuristic produced regret.

---

## 6. Quick reference

| Operation                                          | Command / call                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| Confirm topology (per host)                        | `redis-cli -u "$REDIS_URL" INFO replication`                                |
| Marker write probe                                 | `redis-cli SET sabflow:probe:<ts> "<tag>" EX 60` on A; `KEYS` on B          |
| Marker publish probe                               | `SUBSCRIBE sabflow:probe:fanout` on B; `PUBLISH` from A                     |
| Block writes on losing master                      | `CONFIG SET min-replicas-to-write 999`                                       |
| Drain a gateway host                               | `pm2 stop sabflow-ws`                                                       |
| Pause seat-reconcile Cron                          | `vercel env add SABFLOW_RECONCILE_PAUSED=true production` + redeploy        |
| Pause compaction worker                            | `vercel env add SABFLOW_COMPACT_PAUSED=true production` + redeploy          |
| Reconcile seat counters                            | `await reconcileSeats({ all: true })`                                       |
| Repair `seq` allocator                             | `SET sabflow:seq:<docId> <max(seq) from Mongo>`                             |
| Clear stale compaction locks                       | `redis-cli --scan --pattern 'sabflow:compact:*' \| xargs -r redis-cli DEL`  |
| Broadcast `doc.restored` to a workspace            | Gateway admin tool: `gateway-admin doc:restored --workspaceId <oid>`        |
| Synthetic fan-out probe                            | `sabflow.fanout.echo` metric (Phase 9 probe)                                |
