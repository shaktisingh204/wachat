# SabFlow Persistence — Backup & Restore Runbook

- **Track / Phase / Sub-task:** Track A · Phase 2 · #10
- **Status:** Proposed
- **Owner:** SabFlow persistence on-call
- **Related:** `docs/adr/sabflow-persistence.md` (collection shapes, indexes, retention, R2 cold-tier rule), `docs/adr/sabflow-seat-model.md` (plan ladder used by the RTO/RPO matrix below), `PLAN-sabflow-crdt-collab.md` (Track A Phase 9 #4 forward-ref for the doc-corruption detector, §1, §4 below).

> Scope note. This runbook covers **doc-side** persistence only: snapshots, CRDT oplog, RBAC shares, and the R2 cold-tier objects that hold archived snapshots. Execution-side persistence (`execution_entity` analogue, owned by Track B Phase 7 + Track B Phase 9 #9 R2 archival) has its own runbook and is intentionally out of scope here.

---

## 1. Backup scope

Four artifact classes must be captured for a complete SabFlow doc-side restore. Any restore that omits one class will produce a partial recovery — note the gap in §3.4.

- [ ] **`sabflow_docs`** — snapshot collection. Carries `snapshot` (BSON `Binary`, the Yjs baseline), `version`, `versionId`, `coldTier` pointer, RBAC owner, settings, and soft-delete tombstones. This is the canonical doc identity row; loss of `sabflow_docs._id` is unrecoverable from oplog alone.
- [ ] **`sabflow_oplog`** — append-only CRDT updates keyed `(docId, seq)` UNIQUE. Each row holds a raw Yjs update blob. Required to replay edits made after the most recent snapshot (`seq > snapshotSeq`). TTL evicts folded rows 7 days after compaction (24h hard floor); see ADR §3.2.
- [ ] **`sabflow_doc_shares`** — RBAC join (n8n `shared_workflow` analogue). Loss leaves docs orphaned (only `owner` reachable). Has a sparse TTL on `expiresAt` for share-link tokens.
- [ ] **R2 cold-tier objects via SabFiles** — keyed `sabflow/<workspaceId>/<docId>/<version>.bin`. Holds historical snapshot generations once a doc has been archived (>30 days untouched AND `snapshotSize > 256 KB`, per ADR §4). **Always exported through SabFiles**, never via a direct R2 SDK call (per SabFiles policy in `CLAUDE.md`).

### Non-scope (forward-refs)

- [ ] `sabflow_audit_log` (Phase 2 #9) — back up alongside this set when it lands. Until then, audit events flow through SabNode's central audit store.
- [ ] Execution records — owned by Track B Phase 7 #1 + #9; separate runbook.

---

## 2. Routine backup procedure

Run as scheduled Vercel Cron jobs in the `sabflow-ops` project. All targets land in the workspace's SabFiles `__system/sabflow/backups/<YYYY-MM-DD>/` folder (system-owned tenant). Never write to a raw R2 bucket from a one-off SDK call.

### 2.1 Mongo Atlas — managed continuous backup (primary)

- [ ] Confirm the SabFlow cluster has **continuous cloud backup** enabled in Atlas (Project Settings → Backup → Cloud Backup, snapshot frequency `every 6h` minimum, PIT enabled on `pro` tier and above).
- [ ] Verify the retention window matches the plan-tier matrix in §5 (Atlas backup retention is set per cluster — at least the longest tier-RPO present on that cluster).
- [ ] Set the snapshot schedule alert (Atlas → Project Alerts → "Backup Snapshot Failed") to page `#sabflow-oncall`.
- [ ] Tag snapshots with the deploy SHA via the Atlas API after each green production deploy so PIT restores can be aligned with code state.

### 2.2 Mongo — collection-level logical dump (secondary, plan-driven)

Use this when restoring a **single workspace** or a **single doc** — Atlas cluster restore is workspace-blind, so logical dumps stay the surgical option.

- [ ] Trigger `mongodump --uri "$MONGO_URI" --db sabnode --collection sabflow_docs --query '{ "workspaceId": <oid> }' --out s3://sabfiles-staging/dump/<YYYY-MM-DD>/`.
- [ ] Repeat for `sabflow_oplog` and `sabflow_doc_shares` with the same `workspaceId` filter.
- [ ] Pipe each dump through SabFiles upload (system folder) so it's catalogued, retention-managed, and accessible via the standard signed-URL path. No raw R2 SDK writes.
- [ ] Record the dump manifest in `__system/sabflow/backups/<date>/manifest.json` with `{ workspaceIds[], collections[], mongoSnapshotId, sha256[] }`.

### 2.3 Self-hosted Mongo (enterprise / on-prem tenants only)

- [ ] Use `mongodump` against a hidden replica-set member to avoid load on primaries.
- [ ] Stream the output to the customer-managed SabFiles bucket the tenant has provisioned for backups (Marketplace storage binding, never hand-rolled S3).
- [ ] Run a daily `db.runCommand({ dbHash: 1, collections: ["sabflow_docs", "sabflow_oplog", "sabflow_doc_shares"] })` and store the hash next to the dump for tamper detection.

### 2.4 R2 cold-tier sync via SabFiles export

Cold-tier snapshots are already in R2 (under SabFiles), but they live in a **system-owned tenant folder**. Backup means **replicating that folder out** of the live SabFiles bucket into the archival bucket, so a SabFiles outage cannot also take out the cold tier.

- [ ] Enumerate cold-tier objects: query `sabflow_docs` where `coldTier != null` and project `coldTier.key`. Group by `workspaceId`.
- [ ] For each key, call SabFiles `copyObject(srcKey, "__system/sabflow/backups/<date>/<workspaceId>/<docId>/<version>.bin")`. **Do not** use the R2 SDK directly — go through SabFiles so lifecycle, signing, and audit hit the same code path the cold-tier worker uses.
- [ ] Verify each copy: SabFiles `headObject` on the destination, compare `etag` and `contentLength` to the source. Record mismatches in `manifest.json.discrepancies[]` and page on-call.
- [ ] Optional (enterprise): replicate the archival folder to a second geographic region via the SabFiles cross-region lifecycle rule (configured at the bucket level, not per object).

### 2.5 Retention windows by plan tier

Aligns with the plan ladder in `sabflow-seat-model.md` §3.2. Stored snapshots and oplog dumps are pruned by the SabFiles lifecycle rule on `__system/sabflow/backups/`; cold-tier R2 objects keep their own version-history retention separately.

| Plan tier      | Mongo snapshot cadence | Logical-dump cadence | Backup retention | Cold-tier copy retention |
| -------------- | ---------------------- | -------------------- | ---------------- | ------------------------ |
| `free`         | Daily (Atlas)          | Weekly               | 7 days           | 30 days                  |
| `starter`      | Every 12h (Atlas)      | Daily                | 14 days          | 60 days                  |
| `pro`          | Every 6h (Atlas + PIT) | Daily                | 30 days          | 180 days                 |
| `business`     | Every 6h (Atlas + PIT) | Every 6h             | 90 days          | 365 days                 |
| `enterprise`   | Every 1h (Atlas + PIT) | Every 6h             | 365 days + legal hold support | Indefinite (per contract) |

> Cap encoding follows the existing convention in `entitlements.ts` (`-1` for unlimited). The numbers above are the **storage retention floor**; tenants may purchase add-on retention packs via the existing `Subscription.addons[]` plumbing.

---

## 3. Restore procedure

Four scenarios, in increasing scope: single doc → single workspace → full cluster → cold-tier-only repair. All restores write into a **staging database** first, validate, then cut over by renaming the namespace. **Never** restore directly over a live production collection.

### 3.1 Single-doc restore (most common)

- [ ] Identify `docId` + `workspaceId` from the support ticket. Confirm the requester has `owner` or `workspace.admin` (see ADR §5.2 `canAccess`).
- [ ] Acquire the compaction lock so a concurrent fold can't race the restore: `SETNX sabflow:compact:<docId>` with a 15-minute TTL. If the lock is held, wait — do not steal.
- [ ] Pull the most recent **snapshot** for that doc from the backup: extract the `sabflow_docs` row from the most recent logical dump that contains `_id == docId` and `workspaceId == <oid>`.
- [ ] Pull the **oplog tail** for that doc from the same dump (filter on `docId`). If the dump's oplog `seq` range doesn't reach the desired restore point, fall back to the Atlas PIT snapshot for the gap.
- [ ] Rebuild the Y.Doc in staging (see §3.5 replay procedure). Verify `Y.encodeStateAsUpdate(doc)` decodes cleanly and the node/connections JSON shape passes the SabFlow doc-schema validator.
- [ ] Write the rebuilt snapshot back into production `sabflow_docs` with `$set: { snapshot, version: version + 1, versionId: <new-uuid>, updatedAt: now, lastEditorId: "system:restore" }`. Bumping `version` is mandatory so any in-flight client save fails with optimistic-concurrency and re-syncs.
- [ ] Re-insert any oplog rows whose `seq > snapshotSeq` so future folds remain consistent.
- [ ] Release the compaction lock.
- [ ] Notify the workspace's connected clients via the WS gateway's `doc.restored` system message — they will re-issue initial sync.
- [ ] Record the restore in `sabflow_audit_log` (when available — Phase 2 #9) with `{ action: "restore", docId, fromBackupId, performedBy, ticketRef }`.

### 3.2 Single-workspace restore

- [ ] Restore the workspace's `sabflow_docs`, `sabflow_oplog`, and `sabflow_doc_shares` rows from the most recent logical dump into a staging DB.
- [ ] Restore the workspace's cold-tier R2 objects from the archival SabFiles folder back into the live SabFiles system folder, preserving the `sabflow/<workspaceId>/<docId>/<version>.bin` key shape.
- [ ] Run the doc-schema validator across every restored `sabflow_docs` row. Quarantine failures into `sabflow_docs_quarantine_<date>` for manual review.
- [ ] Cut over: rename the staging collections into production using a Mongo aggregation `$out` with `workspaceId` filter on the destination side, so untouched tenants stay live.
- [ ] Rebuild indexes per ADR §3 (`{ workspaceId: 1, updatedAt: -1 }`, the per-doc oplog UNIQUE on `(docId, seq)`, etc.). Atlas restores carry indexes; logical dumps do not.

### 3.3 Full-cluster restore (disaster recovery)

- [ ] Promote the Atlas continuous backup to a new cluster. Do **not** restore over the live cluster.
- [ ] Point a staging Next.js deployment at the restored cluster, run the doc-schema validator across every collection, and bring the WS gateway up in read-only mode.
- [ ] Verify the cold-tier R2 folder is reachable via SabFiles from the staging deployment. If the archival region also lost data, replay from the cross-region replica (enterprise only).
- [ ] Smoke-test with the chaos-test harness (Phase 9 #10 forward-ref) before flipping DNS.
- [ ] DNS cutover. Old cluster stays on standby for 72h before deletion.

### 3.4 Cold-tier-only repair

When `sabflow_docs.coldTier.key` points at a missing or corrupted R2 object:

- [ ] Look up the doc in `sabflow_docs`. If `snapshot != null`, no cold-tier repair is needed — clear `coldTier` and let the cold-tier worker re-archive on its next pass.
- [ ] If `snapshot == null` (the doc is cold-only) and the R2 object is unreadable: copy the `<version>.bin` blob back from the archival SabFiles folder using `copyObject` (never raw R2 SDK).
- [ ] If the archival copy is **also** missing, fall through to replay-from-oplog (§3.5) — provided the oplog wasn't TTL-evicted. If both archival and oplog are gone, restore is bounded by the workspace's plan-tier RPO (§5); document the resulting data loss in the incident report.

### 3.5 Replay procedure — rebuilding a doc from snapshot + oplog

This is the canonical "make a Y.Doc whole again" loop. Used by §3.1, §3.4, and the corruption-recovery path (§4).

- [ ] Load the **baseline snapshot** bytes from the most recent good source, in priority order: (a) live `sabflow_docs.snapshot`, (b) latest logical-dump row, (c) cold-tier R2 object via SabFiles, (d) prior `<version>.bin` in the version-history fan-out (one back).
- [ ] Instantiate `new Y.Doc({ gc: true })` and `Y.applyUpdate(doc, snapshotBytes)`.
- [ ] Load oplog rows for `docId` ordered by `seq` ascending, filtered to `seq > snapshotSeq`.
- [ ] For each row, try `Y.applyUpdate(doc, row.update)`. On `RangeError` / decode failure, **skip** the row, log `{ docId, seq, reason }` to `sabflow_replay_skipped`, and continue. (See §4 for when to escalate vs continue.)
- [ ] After the loop, `Y.encodeStateAsUpdate(doc)` and validate the resulting JSON shape via the doc-schema validator.
- [ ] If validation passes: write back per §3.1 step "Write the rebuilt snapshot". If it fails: stop, do **not** write, and escalate to §4.

---

## 4. Corruption / "doc is unreadable" recovery

A doc is considered **corrupted** when any of the following holds:

- `Y.applyUpdate` throws while reading `sabflow_docs.snapshot`.
- The decoded snapshot fails the SabFlow doc-schema validator (missing required fields, malformed `nodes` / `connections` JSON).
- The WS gateway repeatedly disconnects clients of a single room with framing errors.

### 4.1 Detect

- [ ] Forward-ref to the **doc-corruption detector** (Track A Phase 9 #4 — not yet shipped). Until that lands, detection is reactive: incoming support ticket, WS gateway error log, or failed compaction job.
- [ ] Interim manual probe: run `loadDoc(workspaceId, docId)` against a staging shell session; if it throws, mark the doc as corrupted in `sabflow_doc_health` (forward-ref to Phase 9 #4 schema).
- [ ] Page `#sabflow-oncall`. Do not let the corrupted doc auto-restore — manual gating is required.

### 4.2 Recover

- [ ] Take the doc offline: set `sabflow_docs.active = false` and broadcast `doc.maintenance` over the WS room so clients show a banner and stop attempting writes.
- [ ] Identify the **latest known-good snapshot**: walk backwards through `version` generations in the cold-tier R2 path (`sabflow/<workspaceId>/<docId>/<version>.bin`), oldest acceptable bound = the workspace's plan-tier RPO (§5).
- [ ] Run the replay procedure (§3.5) starting from that snapshot.
- [ ] **Skip bad oplog entries**: any oplog row whose `Y.applyUpdate` throws is added to `sabflow_replay_skipped` and dropped from the replay. Do **not** delete it from `sabflow_oplog` yet — keep it for forensic analysis until the incident is closed.
- [ ] If skipping >5% of oplog rows for the affected window, escalate: this indicates wire-format corruption (encoder bug, MITM, or storage rot), not a single bad update. Loop in `#sabflow-eng` before proceeding.
- [ ] Validate the rebuilt doc with the doc-schema validator and a manual editor open against the staging deployment.
- [ ] Re-enable the doc: set `active = true`, bump `version`, broadcast `doc.restored`, and write an incident summary into `sabflow_audit_log`.
- [ ] After 7 days with no further reports, purge the quarantined `sabflow_replay_skipped` rows.

---

## 5. RTO / RPO targets per plan tier

Targets align with the seat-model plan ladder (`sabflow-seat-model.md` §3.2). **RTO** = time from incident declared to doc(s) readable again. **RPO** = maximum acceptable data loss measured in elapsed real-time.

| Plan tier      | RTO (single doc) | RTO (workspace) | RTO (full cluster) | RPO   | Notes |
| -------------- | ---------------- | --------------- | ------------------ | ----- | ----- |
| `free`         | 4h               | 24h             | 24h                | 24h   | Best-effort; no SLA |
| `starter`      | 2h               | 8h              | 12h                | 12h   | Best-effort |
| `pro`          | 1h               | 4h              | 8h                 | 6h    | SLA-backed |
| `business`     | 30m              | 2h              | 4h                 | 1h    | SLA-backed; Atlas PIT in scope |
| `enterprise`   | 15m              | 1h              | 2h                 | 15m   | Contractual; cross-region replica required |

> Numbers chosen to be tighter than the corresponding **backup cadence** in §2.5 — RPO can never be larger than the snapshot interval. Enterprise's 15-minute RPO is the reason the cadence row in §2.5 is `every 1h` (Atlas PIT covers the gap). Adjust the §2.5 cadence first if a tier's RPO is tightened in future.

---

## 6. Test cadence — monthly fire drill

Run on the first Wednesday of each month, 14:00 UTC, in the `sabflow-staging` cluster (never production). Owner rotates per the `#sabflow-oncall` schedule.

- [ ] **Day -7 — prep.** Confirm the staging cluster mirrors production schema (run the Phase 2 #4 index audit). Snapshot the staging cluster pre-drill so the drill itself is reversible.
- [ ] **Day 0 — scenario A: single-doc restore.** Pick a random non-empty doc from a `pro`-tier workspace. Drop its `sabflow_docs` row + oplog tail. Walk through §3.1. Measure wall-clock from "drop" to "doc readable". Compare to `pro` RTO (1h).
- [ ] **Day 0 — scenario B: corruption + replay.** Mutate one `sabflow_docs.snapshot` blob to invalid bytes. Confirm the detector (or manual probe, pre-Phase-9-#4) catches it. Walk through §4. Measure wall-clock and percentage of oplog rows skipped.
- [ ] **Day 0 — scenario C: cold-tier loss.** Pick a doc with `coldTier != null`. Delete the R2 object via SabFiles. Walk through §3.4. Confirm replay from oplog succeeds when oplog is still in TTL window, and confirm graceful failure mode (with bounded data loss per §5 RPO) when oplog has been reaped.
- [ ] **Day +1 — postmortem.** File a report into `docs/runbooks/fire-drills/<YYYY-MM>.md` with measured RTOs, gaps vs targets, and action items. Any RTO miss on `pro` or `business` is a sev-2 follow-up; any miss on `enterprise` is sev-1.
- [ ] **Quarterly — full-cluster drill.** Once per quarter, replace scenario A with a full §3.3 cluster restore against a throwaway staging cluster. Page rotation participation is mandatory.

---

## Summary (≤200 words)

This runbook covers backup and restore for SabFlow's doc-side persistence: `sabflow_docs`, `sabflow_oplog`, `sabflow_doc_shares`, and the R2 cold-tier objects routed through SabFiles. Backups combine Atlas continuous + PIT snapshots (primary), workspace-scoped `mongodump` logical dumps (surgical), and SabFiles `copyObject` replication of the cold-tier folder into a separate archival folder. All backups land in `__system/sabflow/backups/<date>/` — never a raw R2 SDK write. Retention windows ladder from 7 days (`free`) to 365+ days (`enterprise`), matching the plan ladder in `sabflow-seat-model.md`. Restores stage into a fresh namespace, validate via the doc-schema validator, then cut over; a corrupted doc is rebuilt by replaying oplog onto the latest known-good snapshot and dropping any row whose `Y.applyUpdate` throws. RTO/RPO targets are tiered (15m / 15m at `enterprise` to 24h / 24h at `free`), with the §2.5 backup cadence set tighter than the matching RPO row. A monthly fire drill on staging validates §3.1, §3.4, and §4 paths; a quarterly drill replaces scenario A with a full §3.3 cluster restore.
