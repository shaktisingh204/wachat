# ADR — SabFlow execution pinning

**Status:** Accepted
**Date:** 2026-05-18
**Track:** C · Phase 9 · sub-task #4
**Authors:** SabFlow team

## Context

SabFlow stores per-run execution state in two MongoDB collections:

- `sabflow_executions` — the run header (status, timings, variables, node summaries). Pruned by `/api/cron/sabflow-executions-retention` on a **90-day** age cap plus a **per-flow row cap** (1000 by default).
- `sabflow_execution_traces` — the verbose per-step trace (inputs / outputs / errors) used by the replay UI. Each trace row carries a Mongo TTL `expiresAt` field set to **`now() + 30d`** on insert, swept automatically by the `expiresAt_1` TTL index.

The 30-day trace TTL is a deliberate cost / retention tradeoff: traces are large and accessed rarely, so we discard them quickly. But users have **specific runs** they need to keep indefinitely:

- A run that produced a customer-visible bug — kept for the postmortem.
- A "known good" run used as a reference baseline for partial re-execution.
- A run flagged for compliance / audit review.

Without a mechanism to opt individual runs out of the TTL, users were forced to either:

1. Export the trace to SabFiles by hand (lossy — loses live re-run capability), or
2. Lower the global retention to "never", which is prohibitively expensive at scale.

## Decision

Introduce an explicit **pin / unpin** API on executions:

```
POST   /api/sabflow/executions/[executionId]/pin     → pin
DELETE /api/sabflow/executions/[executionId]/pin     → unpin
```

### Behaviour

**Pin** does two things atomically per resource (the route performs them sequentially but neither is required for the other to succeed):

1. Sets `sabflow_executions.pinned = true` and stamps `pinnedAt = new Date()`.
2. **Removes** the `expiresAt` field on the matching `sabflow_execution_traces` row (`$unset`). With the field absent, the TTL monitor leaves the row alone indefinitely.

**Unpin** is the reverse:

1. Sets `sabflow_executions.pinned = false` and unsets `pinnedAt`.
2. **Re-applies** `expiresAt = now() + 30d` on the trace, putting the row back into the rolling retention window. If the trace was already swept (the user pinned late, then unpinned much later), the no-op `updateOne` returns `matchedCount: 0` and the response surfaces that to the caller — no error.

The 30-day window is **not** tracked from the original `startedAt`. We reset it on unpin so the user gets a full retention window from the moment they release the pin. This matches the mental model of "unpin = put it back on the rolling shelf".

### Authorisation

Two new RBAC keys are **reserved** in `src/lib/sabflow/rbac-keys.ts`:

| Key                          | Grants                                                    |
|------------------------------|-----------------------------------------------------------|
| `sabflow.execution.pin`      | POST `/.../pin` — pin a run.                              |
| `sabflow.execution.unpin`    | DELETE `/.../pin` — unpin a run.                          |
| `sabflow.execution.admin`    | Catch-all — implies both pin and unpin.                   |

The route enforces "either the specific key OR `execution.admin`" via two parallel `canServer()` calls. The default role grants give both `admin` and `owner` workspace roles all three keys; `editor` and `viewer` get none.

### Forward-declared registration

Following the **credentials-rbac pattern** (`src/lib/sabflow/executor/credentials/rbac.ts`) and the trigger-keys pattern, these keys are **not yet registered** in:

- `src/lib/permission-modules.ts` (`globalModules` + `moduleCategories.SabFlow`)
- `src/lib/definitions.ts` (`GlobalRolePermissions` type)

Global registration lands in **Phase B.8 §1** alongside the rest of the SabFlow permission inventory. Until then, the keys are enforceable via `canServer` because the role-grant table (`DEFAULT_SABFLOW_ROLE_GRANTS`) is consulted at the workspace level and is the source of truth for which keys a workspace role implies. Workspaces without a customised permission template fall through to those defaults.

### Audit

Every pin / unpin emits one audit row through the existing `recordFlowAction` middleware, under the **`exec.*`** namespace:

- `exec.pinned`   — POST success.
- `exec.unpinned` — DELETE success.

Each row carries `userId`, `workspaceId`, `flowId`, the execution id as `target`, and a metadata blob with `{ traceMatched, traceModified }` so operators can see whether the trace was still live when the pin landed. Failures are not audited (consistent with the rest of the SabFlow audit surface — only successful mutations are logged).

## Consequences

### Positive

- Users can keep individual runs indefinitely without disabling global retention.
- The pinned flag is queryable, so the executions list view can render a pin badge cheaply (`{ pinned: true }` projection).
- The retention cron is untouched — the trace TTL is enforced by Mongo's native TTL monitor, so dropping `expiresAt` is sufficient. No code change needed in the cleanup job.
- Forward-declared registration keeps the per-phase blast radius small; Phase B.8 picks up the keys when the rest of the SabFlow permission catalogue is wired into the global RBAC inventory.

### Negative / risks

- **No per-flow pin quota.** A malicious or buggy automation could pin every run and defeat retention entirely. We accept this for now — the same workspace-level admin who can pin can also unpin, and storage cost is monitored at the platform level. A `maxPinnedPerFlow` cap is a candidate for a follow-up phase if pinned-run growth becomes a problem.
- **`sabflow_executions` rows are still subject to the 90-day age cap** in the retention cron. Pinning **does not** extend the lifetime of the header row, only the trace. If the header is needed indefinitely too, the retention cron must be taught to skip `pinned: true` rows — explicitly out of scope for this phase.
- **Trace-not-found on pin is silent.** If the trace was never written (e.g. the execution failed before the trace flush) the pin still succeeds and reports `traceMatched: false`. Callers reading the response can surface a warning toast in the UI.

### Non-goals

- Per-step pinning — only the whole execution can be pinned. Per-step pin lives on the flow-document level (n8n-style `pinData`) and is unrelated.
- Pin expiry / scheduled-unpin — pins are explicit and persist until the user unpins.
- Cross-workspace pinning — pinning is single-tenant; the authorisation guard rejects cross-workspace access at the same layer as the GET execution detail route.

## References

- Route: `src/app/api/sabflow/executions/[executionId]/pin/route.ts`
- RBAC keys: `src/lib/sabflow/rbac-keys.ts` (`SABFLOW_EXECUTION_PERMISSION_KEYS`)
- Audit middleware: `src/lib/sabflow/audit/middleware.ts` (`recordFlowAction`)
- Retention cron (unchanged): `src/app/api/cron/sabflow-executions-retention/route.ts`
- Prior art for forward-declared keys:
  - `src/lib/sabflow/executor/credentials/rbac.ts`
  - `src/app/api/sabflow/triggers/[id]/replay/route.ts` (workflow/trigger keys)
