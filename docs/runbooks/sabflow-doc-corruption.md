# SabFlow Yjs Doc — Corruption Detection, Roll-Forward & Roll-Back Runbook

- **Track / Phase / Sub-task:** Track A · Phase 9 · #3 (reliability hardening for the Phase 1 persistence layer)
- **Status:** Proposed
- **Owner:** SabFlow collab on-call
- **Related:** `docs/adr/sabflow-persistence.md` §6 (snapshot/oplog compaction — the model this runbook recovers from), §2 (`sabflow_docs` and `sabflow_oplog` shapes), §4 (R2 cold-tier version history we roll back through), `docs/runbooks/sabflow-persistence-backup.md` §3.5 (replay procedure this runbook borrows) and §4 (corruption-recovery procedure this runbook deepens), `docs/runbooks/sabflow-ws-gateway-crash.md` §4.1 (seq-hole tolerance — adjacent topic).

> Scope. Covers Yjs doc-level corruption: failed merge, `Y.applyUpdate` throwing on a snapshot or oplog entry, oplog/snapshot drift (the snapshot says it's at `version=N` but applying the oplog from `snapshotSeq` produces something different), and the user-visible "this doc won't open" failure mode. Does **not** cover: gateway-process crashes (`sabflow-ws-gateway-crash.md`), Redis split-brain causing oplog duplicate-key writes (`sabflow-redis-split-brain.md` §4.3 hands off to here when it can't self-heal), and execution-side persistence (owned by Track B).

---

## 1. Scope — what "doc corruption" means

A SabFlow doc is a Yjs `Y.Doc` represented in storage by **one snapshot** in `sabflow_docs.snapshot` (or cold-tier R2 at `sabflow/<workspaceId>/<docId>/<version>.bin`) plus **N oplog rows** in `sabflow_oplog` keyed `(docId, seq)`. The persistence-backup runbook (§4) defines a doc as corrupted when any of:

- `Y.applyUpdate` throws while reading `sabflow_docs.snapshot` (or its cold-tier copy).
- The decoded snapshot fails the SabFlow doc-schema validator (missing required fields, malformed `nodes` / `connections` JSON).
- The WS gateway repeatedly closes connections of one room with framing errors.

To that we add three more, all detected by the Phase 9 #4 corruption detector (forward-ref) or by ops investigation:

- **Snapshot/oplog drift.** Applying the oplog from `snapshotSeq + 1` onto the snapshot yields a doc that doesn't round-trip through `Y.encodeStateAsUpdate` cleanly. Indicates the compaction worker wrote a snapshot that doesn't actually represent the state it claims to.
- **Failed merge.** Two concurrent updates produced an oplog state that, when applied in `seq` order, deterministically throws `Y.applyUpdate` mid-replay. Yjs's CRDT guarantees this shouldn't happen, but encoder bugs, wire-format mismatches across SDK versions, or storage rot have produced it historically.
- **Seq-hole exceeds tolerance.** Per `sabflow-ws-gateway-crash.md` §4.1, small `seq` gaps are tolerated (CRDT merges across them via reconnect re-sync). A **gap > 50 entries** for a single doc, or a gap that the originating client cannot re-supply (client never reconnected), is treated as corruption.

Corruption is sev-1 if it affects a `pro` / `business` / `enterprise` workspace, sev-2 otherwise. **Never** auto-recover — manual gating is required so the doc isn't silently rewritten with an unintended state.

---

## 2. Detect

### 2.1 Paging signals

- [ ] **Phase 9 #4 doc-corruption detector** (forward-ref — not yet shipped). When it lands, it'll page on:
  - `sabflow_doc_health[docId] = unreadable` (the detector failed `loadDoc` on a sample sweep).
  - `sabflow.compact.validate.fail` metric — the compaction worker wrote a snapshot that failed the round-trip check (this should be impossible under Yjs guarantees but is the canary that proves it isn't).
- [ ] **Gateway error spike on a single doc.** WS gateway emits close `4500 server-error` for >5 sockets on the same `docId` within 60s. Page.
- [ ] **`Y.applyUpdate` throws in the gateway log.** Stack trace contains `RangeError: Invalid array length`, `EOF while decoding update`, `Unknown content type`. Single occurrence pages (these errors are not normal).
- [ ] **Compaction failure on a doc.** `sabflow.compact.fail` metric — the compaction worker errored, did not bump `version`, did not tombstone oplog entries. Repeated failures on the same `docId` are corruption-shaped.
- [ ] **Support ticket — "my flow won't open."** Triage path: confirm the affected `docId`, then run the manual probe in §2.2.

### 2.2 Investigation order (first 10 min)

Goal: classify the corruption (snapshot-only, oplog-only, snapshot+oplog drift, seq-hole), and identify the latest known-good `version` to roll back to.

- [ ] **Manual `loadDoc` probe** against the staging shell (NEVER production — a buggy load can mutate in-memory state on the live gateway if `gc:true` triggers):

  ```ts
  import { loadDoc } from '@/lib/sabflow/repo';
  try {
    const { snapshot, version, head } = await loadDoc(workspaceId, docId);
    console.log({ ok: true, version, head, size: snapshot?.byteLength });
  } catch (e) {
    console.log({ ok: false, err: e.message, stack: e.stack });
  }
  ```

  Outcomes:
  - **Throws on snapshot decode** → snapshot itself is corrupted. Go to §2.3.
  - **Loads but `head < snapshotSeq`** → oplog tail truncated (likely TTL ate it before the snapshot included it). Recoverable from R2 history if any.
  - **Loads, but snapshot+oplog replay fails partway** → drift or failed merge. Identify the first `seq` that throws.

- [ ] **List oplog tail** to spot seq holes:

  ```ts
  const tail = await db.sabflow_oplog
    .find({ docId }, { seq:1, ts:1, clientId:1, size:1 })
    .sort({ seq: 1 })
    .toArray();
  ```

  Inspect for gaps in `seq`. Note the largest gap and its position relative to `sabflow_docs.snapshotSeq`.

- [ ] **List cold-tier history** for roll-back candidates:

  ```ts
  // Query SabFiles for the version-history fan-out
  const versions = await sabfiles.list({
    prefix: `__system/sabflow/${workspaceId}/${docId}/`,
  });
  ```

  Each `<version>.bin` is a historical snapshot generation. Newest first; the persistence ADR §4 retains them per the version-history policy (separate from the cold-tier rule).

### 2.3 Classify and pick a recovery strategy

| Symptom                                                  | Strategy            | Section |
| -------------------------------------------------------- | ------------------- | ------- |
| Snapshot decode throws; oplog intact                     | Roll-forward from oplog using previous snapshot version | §4.1 |
| Snapshot intact; oplog has a few bad entries             | Roll-forward, skipping bad entries                     | §4.2 |
| Snapshot intact; seq-hole > 50 / client never reconnected | Roll-forward; accept bounded data loss                  | §4.2 |
| Snapshot+oplog drift (compaction bug)                    | Roll-back to last good `<version>.bin`, replay forward | §4.3 |
| Both snapshot and oplog unreadable                       | Roll-back to last good `<version>.bin`, accept loss     | §4.4 |
| Cold-tier R2 object missing AND oplog TTL'd              | Bounded by plan-tier RPO from `sabflow-persistence-backup.md` §5 | §4.4 (degraded) |

---

## 3. Contain — freeze writes before recovering

The principle: **a corrupted doc that's still accepting writes is a corrupted doc that's getting more corrupted.** Containment must come before any analysis that touches Mongo.

### 3.1 Take the doc offline (gateway side)

- [ ] Mirror persistence-backup §4.2 step 1: `db.sabflow_docs.updateOne({ _id: docId }, { $set: { active: false } })`. The `active` flag is mainly a trigger-registration signal but the gateway also checks it on `join`; clients hitting it after this point see `error 4500` and a doc-locked banner.
- [ ] Broadcast `doc.maintenance` over the WS room: `gateway-admin doc:maintenance --docId <oid> --reason "investigating-corruption"`. Connected editors get a banner and the SDK stops emitting writes.
- [ ] Kick existing sockets out of the room: `gateway-admin doc:kick --docId <oid>` — server emits `kick {reason:'admin'}` followed by close `4403`. Forces clients to retry the join and see the `4500 doc-locked` rejection.
- [ ] **Verify no writes are landing.** `db.sabflow_oplog.countDocuments({ docId, ts: { $gt: <quiesce-time> } })` should stop growing within 5s. If it's still growing, something is bypassing the gateway — escalate to `#sabflow-eng`.

### 3.2 Stop the compaction worker on this doc

- [ ] Acquire the compaction lock for this doc so the worker doesn't pick it up: `redis-cli SET sabflow:compact:<docId> "investigating-<incident-id>" EX 3600 NX`. The TTL is generous so the lock survives a full investigation; refresh it if the investigation runs longer.
- [ ] If the worker is already mid-fold (you see a recent `compact.start` log without a matching `compact.complete`), let it complete or fail naturally — interrupting it can leave the doc half-written. Then re-acquire the lock.

### 3.3 Preserve forensics

- [ ] **Copy the corrupted state aside** before touching anything:

  ```ts
  // Snapshot the current sabflow_docs row
  await db.sabflow_docs.findOne({ _id: docId }, { /* full row */ })
    .then(row => sabfiles.write(
      `__system/sabflow/forensics/${incidentId}/${docId}/sabflow_docs.json`,
      row
    ));
  // Snapshot the oplog tail
  const ops = await db.sabflow_oplog.find({ docId }).sort({ seq: 1 }).toArray();
  await sabfiles.write(
    `__system/sabflow/forensics/${incidentId}/${docId}/sabflow_oplog.json`,
    ops
  );
  ```

  Forensic copies stay in SabFiles for 90 days per the standard incident-retention policy (file alongside the post-mortem under `docs/runbooks/incidents/`).
- [ ] **Do not delete the bad oplog rows.** They might be needed for vendor escalation (Yjs library bug report) or for replay if the recovery has to be redone.

---

## 4. Recover — roll forward or roll back

Always run in a **staging database** first, validate, then cut over by replacing the production row atomically. The persistence-backup runbook §3.5 (replay procedure) is the canonical loop — this runbook adds the corruption-specific decisions on top.

### 4.1 Roll-forward — snapshot corrupted, oplog intact

- [ ] Locate the previous good snapshot. Order of preference:
  1. The cold-tier R2 object for the most recent `<version>.bin` that's `<` the current corrupt `version` (newest viable history snapshot).
  2. The most recent logical-dump's row for this `docId` (persistence-backup §2.2).
  3. The Atlas PIT snapshot, restored into a staging cluster (persistence-backup §3.3 in miniature — single-doc scope).
- [ ] Load that snapshot into a fresh `Y.Doc({ gc: true })` in staging.
- [ ] Apply oplog rows for `docId` in `seq` order, starting from the snapshot's `snapshotSeq + 1`. The persistence-backup §3.5 replay loop:

  ```ts
  for (const row of oplog) {
    try { Y.applyUpdate(doc, row.update); }
    catch (e) {
      // skip bad entry, log to sabflow_replay_skipped
      await db.sabflow_replay_skipped.insertOne({
        incidentId, docId, seq: row.seq, reason: e.message,
      });
    }
  }
  ```

- [ ] Validate the rebuilt doc with `Y.encodeStateAsUpdate(doc)` and the SabFlow doc-schema validator (`validateDocShape(decoded)`).
- [ ] **If validation passes:** atomically write back into production with `$set: { snapshot: <new>, version: oldVersion + 1, versionId: <new-uuid>, updatedAt: now, lastEditorId: 'system:recovery', snapshotSeq: <last-applied-seq> }`. Bumping `version` is mandatory (mirrors persistence-backup §3.1) so any client that buffered writes during the maintenance window fails optimistic-concurrency and re-syncs.
- [ ] **If validation fails:** stop. Do not write. Fall through to §4.3 or §4.4 depending on what the validator reported.

### 4.2 Roll-forward — snapshot intact, oplog has bad entries (or seq-hole)

- [ ] Load `sabflow_docs.snapshot` into staging.
- [ ] Replay oplog as in §4.1, with the skip-on-throw policy.
- [ ] **Escalation rule (mirrors persistence-backup §4.2):** if you skip **>5% of oplog rows** for the affected window, escalate to `#sabflow-eng` before continuing. That percentage of corrupt entries means a systemic encoder issue, not a single bad update — likely fix is at the SDK or gateway level, not at the doc level.
- [ ] **Seq-hole tolerance.** A hole in `seq` is *not* a "bad entry" — `Y.applyUpdate` won't throw on missing entries. But a hole > 50 means the originating client likely never reconnected to fill it; data is lost regardless of the recovery path. Document the hole and proceed.
- [ ] Validate and write back per §4.1's last two bullets.

### 4.3 Roll-back — snapshot+oplog drift, cold-tier history exists

This is the path when the snapshot itself was written incorrectly by a compaction bug (`sabflow.compact.validate.fail` metric trips here). The current snapshot can't be trusted, and replaying oplog onto it produces a wrong-but-not-crashing doc.

- [ ] **Pick a target version to roll back to.** Walk the cold-tier R2 fan-out (`sabflow/<workspaceId>/<docId>/<version>.bin`) backwards from the corrupt `version`. The newest version whose snapshot loads cleanly AND validates is the target. Bound the walk by the workspace's plan-tier RPO (persistence-backup §5).
- [ ] Load that historical snapshot into staging as the baseline.
- [ ] **Replay oplog forward from the target's `snapshotSeq + 1`.** Important: the oplog rows for `seq` values between the target's `snapshotSeq` and the corrupt `version`'s `snapshotSeq` may have been TTL'd already (persistence ADR §3.2 — 7 days post-compaction, 24h floor). If they have, the rolled-back doc represents the state **at the target version**, and edits between target and corruption are **lost**.
- [ ] Validate and write back. The new `version` is `corruptVersion + 1` (always forward — never reuse a version number).
- [ ] Notify the affected users: gateway broadcasts a `doc.restored` system message with `{ restoredFromVersion: <target>, droppedEditsWindow: '<start> to <end>' }`. The SDK shows a banner; the workspace owner gets an email with the same info from the standard incident-notification pipeline.

### 4.4 Roll-back — snapshot and oplog both lost / unreadable

The worst case: snapshot is corrupted, oplog is missing or also corrupt or TTL'd, and the only recovery substrate is the cold-tier history.

- [ ] Walk cold-tier history as in §4.3 to find the latest good `<version>.bin`.
- [ ] If no good `<version>.bin` exists either: the doc is bounded by the workspace's plan-tier RPO (persistence-backup §5). Restore from the most recent **logical dump** (persistence-backup §2.2) or **Atlas PIT** (§2.1) within that bound.
- [ ] **Worst-worst case** (free tier with 24h RPO, dump older than that, oplog TTL'd, cold-tier missing): the doc is unrecoverable. Communicate the bounded data loss to the user; do not silently emit a stale state.
- [ ] Validate and write back. Document the RPO miss in the post-mortem if it exceeds the plan-tier target.

### 4.5 Cut over and re-open the doc

- [ ] Atomic write of the rebuilt snapshot into `sabflow_docs` (§4.1 last bullet).
- [ ] Release the forensic compaction lock: `redis-cli DEL sabflow:compact:<docId>`. The next worker pass will treat the doc normally.
- [ ] Re-enable the doc: `db.sabflow_docs.updateOne({ _id: docId }, { $set: { active: true } })`.
- [ ] Broadcast `doc.restored` so connected clients (if any are still on the room from the maintenance banner) re-issue initial sync.
- [ ] Record in `sabflow_audit_log` (when Phase 2 #9 lands; until then, into the gateway log) with `{ action: "recover", docId, fromVersion, toVersion, strategy: "roll-forward"|"roll-back", skipped: <count>, droppedWindow?: ..., incidentId }`.

### 4.6 Verify

- [ ] Smoke-test from a staging editor session: open the doc, confirm nodes/connections render, confirm a small edit + reload preserves the change.
- [ ] Monitor the doc for 24h: any `sabflow.compact.fail` or `Y.applyUpdate` throw against the same `docId` re-opens the incident.
- [ ] If the recovery dropped edits (§4.3 or §4.4), confirm the affected user(s) acknowledged the data-loss notice before closing the incident.

---

## 5. Post-mortem — file within 5 business days

- [ ] Open a doc under `docs/runbooks/incidents/<YYYY-MM-DD>-doc-corruption-<docId-short>.md`.
- [ ] Required sections:
  - **Timeline.** First symptom → manual `loadDoc` probe → classification → containment → recovery strategy chosen → cut over → verified. Wall-clock per phase. Compare to plan-tier RTO from `sabflow-persistence-backup.md` §5.
  - **Root cause.** One of:
    - **Encoder / Yjs bug** — wire-format produced by client X is unparseable. Cite SDK version. Loop in `#sabflow-eng` for an upstream fix.
    - **Compaction bug** — the worker wrote a snapshot that doesn't validate. Cite the worker code path; file a fix against `sabflow-persistence` ADR §6.
    - **Storage rot / bit-flip** — extremely rare; cite the affected `BinData` field, the surrounding rows' integrity, and the Mongo / R2 vendor.
    - **Upstream — split-brain induced** — link to the `sabflow-redis-split-brain.md` incident this spun out of.
    - **Operator-induced** — a manual write went wrong. Document the command and add a safeguard.
  - **Blast radius.** Number of users on the doc, plan tier, whether edits were dropped, how many.
  - **Data integrity.** Recovery strategy used; skipped-oplog count; dropped-edit window; cold-tier version rolled back to.
  - **What went well / what didn't.** Did the manual `loadDoc` probe classify the corruption correctly? Was the maintenance broadcast effective at stopping writes? Did the cold-tier history have a usable version?
- [ ] Action items, common:
  - **SDK fix.** File against the `sabflow-sdk` repo; pin minimum client version after rollout.
  - **Detector coverage.** If Phase 9 #4 missed this corruption class, expand its checks.
  - **Compaction validation.** Add a post-fold round-trip check that errors loudly instead of silently writing bad snapshots.
  - **History retention bump.** If the rollback fell off the cold-tier window, the plan tier's history retention may be too short — raise with product.
- [ ] If data was lost on a `pro` / `business` / `enterprise` workspace, sev-1 follow-up and customer-comms; otherwise sev-2.
- [ ] Walk the incident at the next `#sabflow-oncall` weekly. Update §2.3 classification table if a new symptom-strategy pairing emerged.

---

## 6. Quick reference

| Operation                                          | Command / call                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| Manual load probe                                  | `await loadDoc(workspaceId, docId)` in a staging shell                        |
| List oplog tail                                    | `db.sabflow_oplog.find({ docId }).sort({ seq:1 }).toArray()`                  |
| List cold-tier history                             | `sabfiles.list({ prefix: '__system/sabflow/<ws>/<doc>/' })`                   |
| Take a doc offline                                 | `db.sabflow_docs.updateOne({_id:docId},{$set:{active:false}})`                |
| Broadcast doc maintenance                          | `gateway-admin doc:maintenance --docId <oid>`                                 |
| Kick sockets out of a room                         | `gateway-admin doc:kick --docId <oid>`                                        |
| Hold compaction lock during investigation          | `redis-cli SET sabflow:compact:<docId> "incident-<id>" EX 3600 NX`            |
| Forensic copy of sabflow_docs row + oplog          | Write to `__system/sabflow/forensics/<incidentId>/<docId>/` via SabFiles      |
| Run the replay loop                                | Persistence-backup runbook §3.5                                               |
| Validate rebuilt doc                               | `validateDocShape(Y.encodeStateAsUpdate(doc))`                                |
| Atomic write-back                                  | `$set: { snapshot, version+1, versionId:<uuid>, snapshotSeq, lastEditorId:'system:recovery' }` |
| Release compaction lock                            | `redis-cli DEL sabflow:compact:<docId>`                                       |
| Re-enable doc                                      | `db.sabflow_docs.updateOne({_id:docId},{$set:{active:true}})`                 |
| Broadcast restored                                 | `gateway-admin doc:restored --docId <oid>`                                    |
| Audit the recovery                                 | Append `{action:"recover", strategy, fromVersion, toVersion}` to `sabflow_audit_log` |
