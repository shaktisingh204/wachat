# SabFlow Real-Time Collaboration

- **Status:** GA (General Availability)
- **Module:** SabFlow (workflow editor)
- **Available since:** Phase C.8 closeout (2026-05-18)
- **Related ADRs:** [`sabflow-foundation.md`](../adr/sabflow-foundation.md), [`sabflow-seat-model.md`](../adr/sabflow-seat-model.md), [`sabflow-ws-gateway-node.md`](../adr/sabflow-ws-gateway-node.md), [`sabflow-crdt-lib.md`](../adr/sabflow-crdt-lib.md)
- **Audit:** [`docs/inventory/collab-state.md`](../inventory/collab-state.md)

---

## §1. Overview

SabFlow Real-Time Collaboration lets multiple people edit the same workflow at the same time, the way a modern document editor works — every keystroke, drag, connection, and node configuration change is synced across all open sessions in under 100 ms, with full presence awareness (avatars, live cursors, selection highlights, typing indicators) and offline-tolerant convergence.

The feature is built on:

- **Yjs CRDTs** for the workflow document model (nodes / edges / groups / settings). Concurrent edits merge automatically — no last-write-wins.
- **A standalone Node WebSocket gateway** (`services/sabflow-ws/`, port 4002, PM2 app `sabflow-ws`) that brokers per-document rooms, broadcasts updates, and enforces plan-tier seat caps at the upgrade handshake.
- **Mongo + R2** persistence — `sabflow_docs` snapshot + `sabflow_oplog` append-only CRDT log, with cold-tier archival through SabFiles.
- **SabNode dual-auth** — the existing httpOnly cookie + JWT pair is reused on the WS upgrade; no new auth surface.
- **Presence awareness** — avatar stack, remote cursors, selection highlight, typing indicators, idle/away detection, multi-instance Redis backplane.

The user-facing capabilities now live as first-class behaviour in the editor at `/dashboard/sabflow/[id]`. Opening a flow joins a live room; closing the tab leaves it. No setting needs to be flipped per-flow.

### What you get out-of-the-box

- Live multi-user editing on every workflow doc (subject to the per-doc concurrent-editor cap in §3).
- Live presence — coloured avatars in the chrome, deterministic per-user colours, remote cursors on the canvas, "Alex is editing this node" indicators.
- Conflict-free convergence — if two people edit the same node config at the same time, both edits land and the doc stays valid.
- Optimistic local edits with auto-rollback if the server rejects them, surfaced via the `ConflictBanner` overlay.
- A CRDT-aware undo/redo stack (per-user, not global).
- Offline tolerance — if the WS drops, edits queue locally and resync on reconnect.
- Audit log — every edit, presence change, role change, and share-link revoke writes to `sabflow_audit_log`.

### What's intentionally **not** in this release

See §4 — version history UI, branching/forking docs, n8n workflow.json import, and the manual repair CLI are scoped to follow-on phases.

---

## §2. Enabling for your workspace

Collab is **on by default** for every workspace on every plan, with a per-doc concurrent-editor cap that scales with the plan (§3). There is no per-workspace opt-in.

### §2.1 Feature flag (rollout safety net)

For incident response or staged rollout, the platform exposes a runtime feature flag:

| Flag | Default | Effect when `false` |
| ---- | ------- | ------------------- |
| `SABFLOW_COLLAB_ENABLED` | `true` | Editor falls back to the pre-CRDT single-user state model; the WS gateway accepts no upgrades. Open editors stay functional but stop syncing across sessions. |

The flag is read at request time from Vercel environment configuration; flipping it via `vercel env` propagates within ~60 s. **Customers do not need to set this flag** — it is an internal kill-switch only.

### §2.2 Workspace admin actions

A workspace admin can:

1. **Invite collaborators** — `/dashboard/sabflow/[id]/share` exposes share-link creation, revoke, and per-user role assignment (`viewer / editor / admin / owner`). Roles are governed by the RBAC keys registered in `src/lib/sabflow/rbac-keys.ts` (`sabflow.doc.read / write / delete / share / admin`).
2. **Promote viewers to editors** in-session, up to the per-doc editor cap (§3).
3. **Revoke share links** from the share dialog — revocation is immediate; affected sockets drop within one heartbeat (~5 s).
4. **Transfer ownership** of a doc to another workspace member via the share dialog (creates an `owner` row in `sabflow_doc_shares`, demotes the previous owner to `admin`).
5. **Override the per-doc cap** (workspace admin only) — admins joining a full doc bump out the longest-idle editor with a polite notice. Use sparingly; this is the in-app equivalent of `sudo`.

### §2.3 What end-users do

End-users do nothing. Opening a flow joins the room; closing the tab leaves it. Sharing a link, copying the URL, or sending an invite from the share dialog all just work — the receiving user's session is gated by the plan-tier seat check (§3) and the share-link role.

---

## §3. Plan-tier seat caps

The cap is **per-document concurrent editors**, distinct from workspace-member seats. A 50-member Business workspace can still have ten focused 10-person rooms running concurrently across different flows — what's capped is how many of them are inside the **same** flow at the same instant.

| Plan         | Per-doc editors | Per-doc viewers | Share-link guests count? |
| ------------ | --------------- | --------------- | ------------------------ |
| `free`       | 1 (solo)        | up to 5         | Yes — count as editors   |
| `starter`    | 3               | up to 25        | Yes                      |
| `pro`        | 5               | up to 100       | Yes                      |
| `business`   | 10              | unlimited       | Yes                      |
| `enterprise` | unlimited       | unlimited       | Yes                      |

Source of truth: `docs/adr/sabflow-seat-model.md` §3.2. Values are mirrored in `src/lib/sabflow/plan-limits.ts` and applied at the WS upgrade by `services/sabflow-ws/src/seats.ts`.

### §3.1 What happens when you hit the cap

- **At upgrade (joining a full doc):** the WS handshake is rejected with close code `4403` and payload `{ "code": "SEAT_LIMIT", "tier": "<plan>", "limit": <N>, "docId": "<docId>" }`. The editor surface shows a modal titled **"This flow is full"** with two CTAs:
  1. **Join as viewer** — opens a read-only socket against the separate viewer counter; live updates stream but local edits are disabled.
  2. **Upgrade plan** — deep-links to `/dashboard/billing?reason=sabflow_seat_cap&plan=<currentPlanId>`. The billing page pre-selects the next tier up.
- **Optional "Request edit access"** — sends an in-app notification to the doc's owner via the existing notification bridge.

### §3.2 Credit metering — `sabflow_collab_minutes`

Active collaboration time is metered as `sabflow_collab_minutes` (1 unit = 1 user-minute of active edit on a doc). "Active" means the socket is open and the client has sent at least one awareness or CRDT update in the last 60 s. Idle users don't burn minutes.

| Plan         | `sabflow_collab_minutes` / month |
| ------------ | -------------------------------- |
| `free`       | 60                               |
| `starter`    | 1,000                            |
| `pro`        | 10,000                           |
| `business`   | 100,000                          |
| `enterprise` | unlimited                        |

When a workspace exhausts its monthly cap, **open sessions are not disconnected** — the server sends a `meter_exceeded` frame and clients downgrade in-place to read-only with a banner: "You've hit your monthly collab limit. View only until next month, or upgrade to keep editing." Existing edits are preserved; only new edits are blocked.

Add-on packs (`sabflow_collab_seats`) lifting the per-doc ceiling for a specific doc are available when `overagePurchaseAllowed === true` on the plan — purchasable from `/dashboard/billing` via the standard `Subscription.addons[]` flow.

### §3.3 What's **not** plan-gated

- **Reading a flow you have access to** — single-user load works on every plan, regardless of seat cap.
- **Asynchronous edits** — opening a flow, editing it solo, saving, and closing always works. The cap is on **concurrent** editors, not on the editing surface itself.
- **Audit log access** — write-side is always on; read-side follows the existing RBAC for `sabflow_audit_log`.

---

## §4. Known limitations

Tracked in [`docs/inventory/collab-state.md`](../inventory/collab-state.md) §1 phases A.9–A.10. Items listed here are present-day at GA; the linked phase covers when each is expected to close.

1. **Version-history UI is not in this release** (A.9 #6). The server captures every edit in `sabflow_oplog` and snapshots compact into `sabflow_docs`, so the data is fully reconstructable, but there is no in-product "view at point in time" surface yet. Cold-tier snapshots are accessible via SabFiles for the doc owner.
2. **Branching / forking a doc is not in this release** (A.9 #7). Duplicating a flow via the existing "Duplicate" action still works (it produces a new doc with a fresh CRDT id), but live forks of an in-progress doc are not yet supported.
3. **n8n `workflow.json` import compatibility is partial** (A.9 #8). Exporting to JSON works for any doc. Importing an n8n-exported workflow.json round-trips the standard shape (`nodes[]` / `connections{}` / `settings{}`) but expression-syntax differences (n8n `$json` vs SabFlow `{{ data.x }}`) are not yet auto-rewritten. Imports of n8n-style expressions land verbatim and must be hand-migrated.
4. **Manual repair CLI is not yet shipped** (A.9 #5). If a doc's snapshot+oplog disagree on a CRDT boundary, the operator-side repair path is currently a manual procedure documented in the WS-gateway runbook. Customer-facing impact: a corrupted doc surfaces a banner "This flow needs attention — contact support". Internal-facing impact: support pages on-call.
5. **A `usePresence` consolidation** (A.7) is still partially mid-flight. The legacy `src/components/sabflow/presence/usePresence.ts` hook remains importable for backward-compat with embeddings outside SabFlow; new SabFlow code uses `src/lib/sabflow/client/usePresence.ts` (Yjs awareness). Both produce equivalent UI in this release; the legacy one will be deleted in a follow-up.
6. **WS gateway is single-region.** The gateway runs as one PM2 app per deploy. Multi-region failover with replica sync (A.9 #3) is scoped to a follow-on phase; for now, a regional WS outage degrades collab to single-user mode (last-writer wins on reconnect) — the editor stays usable. Mongo + R2 persistence is unaffected.
7. **No live cursors on minimap.** Live cursors render on the main canvas only; the minimap shows static node positions.
8. **Touch / mobile editing is unsupported.** The editor is desktop-only; mobile users on the same flow show as "viewer" presence and cannot submit CRDT updates.

---

## §5. Reporting bugs

If you hit something that looks wrong, please file via the in-product **Help → Report an issue** menu — this attaches the doc id, the user id, the SabFlow client telemetry buffer (see `src/lib/sabflow/client/telemetry.ts`), and the last 100 lines of WS log automatically.

### What to include in a manual bug report

1. **Doc id** (visible in the editor URL: `/dashboard/sabflow/<docId>`).
2. **Workspace id + your plan tier** (Settings → Workspace shows both).
3. **What you expected** vs **what happened**, with timestamps if possible.
4. **Browser + OS**.
5. **Were other users in the doc at the time?** (and how many).
6. **Screenshot or screen recording** — for visual issues, the recording is decisive. The presence layer is timing-sensitive and stills rarely capture it.

### Where to file

- **Customer-success-routed (Pro / Business / Enterprise):** email `support@sabnode.com` with subject prefix `[SabFlow Collab]`. Customer Success owns the pilot rollout (see `docs/onboarding/sabflow-collab-pilot.md`) and will triage.
- **Self-serve (Free / Starter):** the in-product report flow above. Sev-1 issues (data loss, edits not landing, doc corruption) page on-call automatically; everything else queues into the standard support inbox.
- **Internal — SabNode team:** open an issue on the SabNode tracker tagged `area:sabflow` + `kind:collab`. Sev-1 also pages `#sabflow-oncall` via the existing PagerDuty integration.

### Severity guide

| Sev | Examples                                                                                          | SLA       |
| --- | ------------------------------------------------------------------------------------------------- | --------- |
| 1   | Edits not persisting, doc shows different content for two users staring at the same state.       | 1 h ack   |
| 2   | Presence layer flickers, cursors lag >2 s, seat cap rejects a user who should be in.             | 1 bday    |
| 3   | Avatar colour clashes, idle-state misdetected, typing indicator shows the wrong block.           | 1 wk      |
| 4   | Cosmetic — UI polish, tooltip wording, etc.                                                       | Best-effort |

### What we collect automatically

The client telemetry hook (`src/lib/sabflow/client/telemetry.ts`) emits a small stream of events (`sabflow.collab.seat_limit`, `sabflow.collab.conflict_rollback`, `sabflow.collab.reconnect`, `sabflow.collab.awareness_lag`) into the standard SabNode telemetry pipe. No CRDT payloads, no document content, no awareness state — events are metadata only. Disabling client telemetry follows the existing workspace-level toggle in Settings → Privacy.

---

## See also

- [`docs/adr/sabflow-foundation.md`](../adr/sabflow-foundation.md) — umbrella ADR (Track A Phase 1)
- [`docs/adr/sabflow-seat-model.md`](../adr/sabflow-seat-model.md) — full seat-model rationale and credit-metering design
- [`docs/inventory/collab-state.md`](../inventory/collab-state.md) — phase-by-phase implementation audit
- [`docs/changelog/sabflow-collab-ga.md`](../changelog/sabflow-collab-ga.md) — GA changelog entry
- [`docs/onboarding/sabflow-collab-pilot.md`](../onboarding/sabflow-collab-pilot.md) — internal pilot rollout checklist
