# SabFlow Real-Time Collaboration — General Availability

- **Release:** SabFlow Collab GA
- **Date:** 2026-05-18
- **Track / Phase:** Track A · Phase C.8 (collab GA closeout) · Sub-task #10
- **Branch:** `worktree-agent-ac87ae1df423ca74d`
- **Feature doc:** [`docs/features/sabflow-realtime-collab.md`](../features/sabflow-realtime-collab.md)
- **Pilot rollout:** [`docs/onboarding/sabflow-collab-pilot.md`](../onboarding/sabflow-collab-pilot.md)

---

## Highlights

- **Live multi-user editing** is on by default for every SabFlow workflow doc, on every plan, subject to the per-doc concurrent-editor cap below.
- **Presence layer** — avatar stack, deterministic per-user colours, remote cursors, selection highlights, typing indicators, idle/away detection — is mounted in the live editor at `/dashboard/sabflow/[id]`.
- **Conflict-free convergence** via Yjs CRDTs — concurrent edits to the same node, edge, or settings field merge automatically; the editor stays valid.
- **Per-doc concurrent-editor seat caps** are enforced at the WebSocket upgrade handshake by the gateway in `services/sabflow-ws/`.
- **Active-collab credit metering** (`sabflow_collab_minutes`) is wired into the existing SabNode `usage-meter`; idle users do not burn minutes.
- **Share-link, invite, owner-transfer, and workspace-admin override** flows ship in the same release.

---

## Plan-tier seat caps

Per-document concurrent editors, distinct from workspace-member seats.

| Plan         | Per-doc editors | Per-doc viewers   |
| ------------ | --------------- | ----------------- |
| `free`       | 1               | 5                 |
| `starter`    | 3               | 25                |
| `pro`        | 5               | 100               |
| `business`   | 10              | unlimited         |
| `enterprise` | unlimited       | unlimited         |

Hitting the cap closes the WS with code `4403` and payload `{ "code": "SEAT_LIMIT", "tier": "<plan>", "limit": <N>, "docId": "<docId>" }`. The editor surfaces a modal with **Join as viewer** + **Upgrade plan** CTAs.

Source of truth: [`docs/adr/sabflow-seat-model.md`](../adr/sabflow-seat-model.md) §3.2.

---

## What landed in C.8 (closeout phase)

Phase C.8 closes the production wiring around the Track A modules merged in Phases A.1 – A.8. See [`docs/inventory/collab-state.md`](../inventory/collab-state.md) for the per-phase audit; the C.8 mapping below is what was done in **this release**:

| Sub-task | Deliverable | Status |
| -------- | ----------- | ------ |
| C.8.1    | `EditorPage.tsx` + `WorkflowCanvas.tsx` switch from local `useState(initialFlow)` to `useSabFlowDoc(flowId)` + `<SabFlowProvider>`, with `Y.Array<Node>` / `Y.Array<Edge>` threaded through `GraphProvider`. | Shipped |
| C.8.2    | Conflict toast + diff view; editor perf regression check vs `main`. | Shipped |
| C.8.3    | `PresenceAvatarStack`, `PresenceSidebar`, `RemoteCursors`, `TypingIndicators`, `SelectionHighlightLayer` mounted; legacy `usePresence` shimmed for backward-compat. | Shipped |
| C.8.4    | Share-link tokens (create / list / revoke) backed by `sabflow_doc_shares`; UI at `/dashboard/sabflow/[id]/share`. | Shipped |
| C.8.5    | Plan-tier seat gating in WS upgrade (`services/sabflow-ws/src/seats.ts` lifted from scaffold to enforcement); `sabflow_collab_minutes` metering writes through `src/lib/billing/usage-meter.ts`. | Shipped |
| C.8.6    | Invite + email flow; owner-transfer endpoint; workspace-admin override. | Shipped |
| C.8.7    | Crash recovery from snapshot+oplog; WS failover playbook; replica sync between WS instances; doc-corruption detector. | Shipped |
| C.8.8    | Version-history server-side capture + JSON export; n8n `workflow.json` import (structural round-trip, expressions hand-migrate). | Partial — see §"Known limitations" |
| C.8.9    | Load harness N=2 / 10 / 50 / 200; p99 SLO budget; Grafana dashboards `sabflow-collab*`; Playwright multi-client E2E; 24 h soak. | Shipped |
| C.8.10   | Feature-flag wiring (`SABFLOW_COLLAB_ENABLED`); plan-tier rollout gate; this announce package. | **This commit** |

---

## New + changed surfaces

### User-facing

- `/dashboard/sabflow/[id]` — editor opens a live CRDT room on load.
- `/dashboard/sabflow/[id]/share` — share-link management, role assignment, owner transfer, workspace-admin override.
- `/dashboard/billing?reason=sabflow_seat_cap&plan=<tier>` — deep-link target when the seat cap is hit; billing page pre-selects the recommended upgrade.

### Telemetry events (already in `src/lib/sabflow/client/telemetry.ts`)

- `sabflow.collab.seat_limit` — emitted when a connection is rejected for cap.
- `sabflow.collab.conflict_rollback` — emitted when an optimistic local edit is rolled back.
- `sabflow.collab.reconnect` — emitted on WS reconnect with the new state vector.
- `sabflow.collab.awareness_lag` — sampled every 30 s with the awareness round-trip estimate.

### Server-side

- `services/sabflow-ws/` — port 4002, PM2 app `sabflow-ws`; reads `SABFLOW_JWT_SECRET`, `MONGO_URI`, `REDIS_URL`, `SABFLOW_COLLAB_ENABLED`.
- `sabflow_docs`, `sabflow_oplog`, `sabflow_doc_shares` — Mongo collections (snapshot + CRDT log + RBAC join).
- `sabflow_audit_log` — write-path captures every edit, presence change, role change, share-link revoke.
- `MeteredFeature.sabflow_collab_minutes` — added to `src/lib/billing/types.ts` with per-plan caps in `entitlements.ts`.
- `Subscription.addons[].sabflow_collab_seats` — add-on pack that lifts the per-doc ceiling for a specific doc.

### Environment variables (read by the deploy)

| Var | Required | Notes |
| --- | -------- | ----- |
| `SABFLOW_COLLAB_ENABLED` | optional (default `true`) | Internal kill-switch; flip to `false` to fall back to single-user mode. |
| `SABFLOW_JWT_SECRET` | yes | WS gateway upgrade verification. Shared with SabNode's existing JWT-issuing path. |
| `SABFLOW_WS_URL` | yes (client) | e.g. `wss://sabnode.com/sabflow/ws`. |
| `SABFLOW_WS_PORT` | yes (server) | Default `4002`. |
| `SABFLOW_REDIS_URL` | yes | Backplane + seat-counter store. |

All keys are provisioned via `vercel env` per workspace and documented in `.env.example`.

---

## Migrations

None required for existing workspaces. Opening any existing flow auto-creates the matching `sabflow_docs._id` row on first load (lazy migration; the legacy `flows` document is preserved as the initial snapshot baseline).

Workspaces with custom integrations that read `flows.nodes[]` / `flows.edges[]` continue to work — the legacy fields are mirrored from the CRDT state on every snapshot compaction.

---

## Known limitations at GA

Mirrored from the feature doc (`docs/features/sabflow-realtime-collab.md` §4):

1. Version-history UI is not in this release (server-side capture is complete; UI ships in a follow-up).
2. Branching / forking an in-progress doc is not supported.
3. n8n `workflow.json` import round-trips the structural shape; expression-syntax differences must be hand-migrated.
4. Manual repair CLI is not yet shipped — operator-side repair is procedural via the WS gateway runbook.
5. `usePresence` legacy hook is shimmed for backward-compat; deletion deferred.
6. WS gateway is single-region; regional outage degrades collab to single-user, persistence unaffected.
7. Live cursors render on the canvas only, not the minimap.
8. Touch / mobile editing is unsupported (mobile users join as viewers).

---

## Rollback procedure

If GA needs to be reverted:

1. Set `SABFLOW_COLLAB_ENABLED=false` via `vercel env` (propagates within ~60 s).
2. The editor falls back to the pre-CRDT single-user state model; existing sessions are not disconnected but stop syncing across users.
3. Data is preserved — `sabflow_docs` and `sabflow_oplog` keep their state. Re-enabling the flag resumes collab from the latest snapshot.
4. If a Mongo-side schema rollback is needed, see [`docs/runbooks/sabflow-persistence-backup.md`](../runbooks/sabflow-persistence-backup.md) §3 for the snapshot-only restore path.

No customer action is required for rollback.

---

## Credits

ADR umbrella: [`sabflow-foundation.md`](../adr/sabflow-foundation.md). Sibling ADRs: state management, doc schema, WS gateway, CRDT lib, persistence, auth, seat model, sync ordering, executor bench, credentials schema. Implementation: Track A Phases 1–8 (merged Phase 1 – Phase 8 branches) + Phase C.8 closeout (this release).
