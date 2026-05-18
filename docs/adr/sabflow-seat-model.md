# ADR: SabFlow Real-Time Collab — Plan-Tier Seat Model

- **Track:** A — Real-time collab
- **Phase:** 1 — Foundation
- **Sub-task:** 8 of 10
- **Status:** Proposed
- **Date:** 2026-05-18
- **Scope:** Define the per-document concurrent-editor seat model SabFlow's
  WebSocket gateway will enforce. This ADR does **not** modify billing or plan
  code — it specifies the contract that Phase 3 (`Track A — Phase 3 §7
  Plan-tier seat enforcement`) and Phase 8 (`§4 Plan gating`, `§5 Credit
  metering`) will implement.

---

## 1. Reference — n8n Cloud seat pricing

n8n Cloud's public pricing (per n8n.io/pricing, captured for context — not a
contract) ladders seats together with execution caps. Seats are **workspace
members** (not "concurrent editors on a single workflow"), but they're the
closest n8n analogue and they set the order-of-magnitude expectation users
arrive with.

| Tier         | Members / seats                  | Active workflows | Executions / mo  | Notes                                       |
| ------------ | -------------------------------- | ---------------- | ---------------- | ------------------------------------------- |
| Starter      | 1                                | 5 active         | 2,500            | Hobby / individual                          |
| Pro          | up to 5 (Pro 2 plan)             | 15 active        | 10,000           | Small team                                  |
| Business     | up to 50 (advanced perms, SSO)   | 50 active        | 50,000+          | Cross-team workspace, RBAC                  |
| Enterprise   | unlimited (negotiated)           | unlimited        | unlimited / SLA  | SSO, on-prem option, dedicated support      |

**Key observation:** n8n Cloud does **not** cap "concurrent editors per
workflow" — it caps members per workspace + executions per month. Real-time
collab is a feature SabFlow is adding **ahead of n8n parity**, so the seat
ladder below is SabFlow-original and slots into the existing SabNode plan
table (§2) rather than copying n8n's ladder.

---

## 2. SabNode's existing plan + credit plumbing

Found and cited verbatim — do **not** modify in this phase.

### 2.1 Plan ladder (canonical)

`src/lib/billing/entitlements.ts` — `PLAN_TABLE` const, lines 28–169.

Plan ids exposed: **`free` / `starter` / `pro` / `business` / `enterprise`**.

Each tier exposes:

- `caps: Partial<Record<MeteredFeature, number>>` — hard caps; `-1` =
  unlimited, `0` = disabled.
- `features: Record<string, boolean>` — flag map; already includes
  `sabflow: true` on every tier (free included), so the **feature itself is
  on every plan** — what differs is *how many editors* can collaborate on
  one doc.
- `seats: number` — currently a **workspace-member** seat, not a per-doc
  editor seat (the two concepts must not be conflated; see §3).
- `overagePurchaseAllowed: boolean` — whether the tenant can purchase
  add-on packs when a cap is hit (already wired through
  `Subscription.addons[]` in `src/lib/billing/types.ts:111`).

### 2.2 Metered features registry

`src/lib/billing/types.ts:26–39` — `MeteredFeature` union. Existing entries
relevant to SabFlow:

- `workflow_executions` — already plan-capped (`free: 100` ... `enterprise:
  -1`); this is the execution-side meter, **not** the collab meter.
- `seats` — workspace-member seats; **not** per-doc editor seats.
- `projects` — workspace count.

There is **no existing `MeteredFeature` for collab seats**. Phase 8 §5
(credit metering for active collab) will need to add one — proposed name
`sabflow_collab_minutes` (see §5 below). The addition is one line in
`types.ts` plus a cap row per plan in `entitlements.ts`; out-of-scope for
this ADR, in-scope for Phase 8.

### 2.3 Usage meter

`src/lib/billing/usage-meter.ts`:

- `recordUsage({ tenantId, feature, units, idempotencyKey? })` — line 28.
- `usageForPeriod(tenantId, feature, period)` — line 76.
- `enforceCap(tenantId, feature, planId, period)` — line 114, returns
  `false` when over cap. WS gateway will call this on connection upgrade
  (see §4).

### 2.4 Entitlement helpers

- `entitlementsFor(planId)` — `src/lib/billing/entitlements.ts:175`, pure
  synchronous lookup, edge-safe.
- `canUse(tenantId, feature)` — `entitlements.ts:184`, async; combines
  plan cap + addon packs + active-subscription status check.

### 2.5 SabWa precedent — per-tier numeric caps

`src/lib/sabwa/plan-limits.ts` already implements the exact pattern this
ADR codifies for SabFlow: a `Record<Tier, Limits>` table with `number |
'unlimited' | 'custom'` semantics, plus a `getSabwaLimits(planName)`
lookup and `isWithinSabwaQuota(quota, value)` helper. SabFlow's collab
ceiling should follow the same shape so the admin plan-builder UI can
render it identically.

---

## 3. Proposed seat model

### 3.1 Concept: per-document concurrent editor cap

A **collab seat** is one live WebSocket connection holding write capability
on **one SabFlow doc**. It is distinct from a workspace **member seat**
(`PlanEntitlements.seats`). A workspace can have 50 members but, on the
Pro tier, no more than 5 of them may be inside the **same** doc at once;
the 6th gets `SEAT_LIMIT` (§4).

Rationale:

- Workspace seats meter *who has access*. Per-doc collab seats meter
  *who's editing at the same instant*, which is the real cost driver (WS
  fan-out, CRDT merge work, awareness state, presence broadcast).
- Decoupling them lets a 50-seat Business workspace still have small
  focused edit sessions, and lets a single-seat Free user invite a guest
  via share-link without breaking the cap (guests count toward the
  per-doc ceiling, not the workspace seat ceiling).

### 3.2 Ceiling table

Matched to the existing plan ids in `entitlements.ts:28–169`:

| Plan id        | Per-doc concurrent editors | Viewers (read-only) | Share-link guests count? |
| -------------- | -------------------------- | ------------------- | ------------------------ |
| `free`         | **1** (solo)               | up to 5             | Yes — count as editors   |
| `starter`      | **3**                      | up to 25            | Yes                      |
| `pro`          | **5**                      | up to 100           | Yes                      |
| `business`     | **10**                     | unlimited           | Yes                      |
| `enterprise`   | **unlimited** (`-1`)       | unlimited           | Yes                      |

Notes:

- Ladder is more conservative than the brief's initial sketch (Free 1 /
  Pro 3 / Business 10 / Enterprise unlimited) — the brief omitted
  `starter`, which exists in the canonical table; this ADR slots Starter
  at 3 and bumps Pro to 5 so each step is meaningfully wider than the
  one below. Mirrors the SabWa `sessions` cap progression in
  `sabwa/plan-limits.ts:47–75` (1 / — / 3 / 10 / unlimited).
- "Viewers" = clients connected with **read-only intent** (`role <
  editor` per Track A Phase 8 §2). They consume awareness fan-out but
  no CRDT write capacity, so the cap is intentionally an order of
  magnitude higher.
- Encoding: `-1` for unlimited (matches existing convention in
  `entitlements.ts:22`), or `'unlimited'` in any new `sabflow/plan-limits.ts`
  module if SabFlow follows the SabWa string-literal style.
- Add-on packs: when `overagePurchaseAllowed === true`, tenants may buy a
  `sabflow_collab_seats` addon that lifts the per-doc ceiling by `N` for
  the doc(s) it's attached to. Wires through the existing
  `Subscription.addons[]` shape (`billing/types.ts:111`).

### 3.3 Where this table lives (when implemented)

Phase 8 will create `src/lib/sabflow/plan-limits.ts` mirroring
`src/lib/sabwa/plan-limits.ts`:

```ts
// proposed shape — DO NOT add in Phase 1
export type SabflowPlanLimits = {
    perDocEditors: number | 'unlimited';
    perDocViewers: number | 'unlimited';
};

export const sabflowPlanLimits: Record<PlanTier, SabflowPlanLimits> = { ... };

export function getSabflowLimits(planId: string | null | undefined): SabflowPlanLimits;
```

The values in §3.2 are normative; the file location is recommended.

---

## 4. Enforcement point — WS gateway

The cap is enforced **exactly once**, at WebSocket upgrade, by the gateway
defined in Track A Phase 3.

### 4.1 Sequence

1. Client opens `wss://.../sabflow/docs/<docId>` with a SabNode JWT.
2. Phase 3 §2 verifies the JWT and resolves `{ userId, tenantId, planId,
   workspaceId, role }`.
3. Gateway atomically increments a Redis counter
   `sabflow:collab:<docId>:editors` (write-role connections only;
   viewers go to a separate `:viewers` counter — both checked against
   the table in §3.2).
4. If `current > getSabflowLimits(planId).perDocEditors`:
   - Decrement the counter back.
   - Close the socket with **close code 4403** and a structured payload
     `{ "code": "SEAT_LIMIT", "tier": "<planId>", "limit": <N>,
     "docId": "<docId>", "retryAfterMs": null }`.
   - Emit OTEL span attribute `sabflow.collab.seat_limit_hit = true`
     and counter `sabflow.collab.rejections{plan=<planId>}++`.
5. On socket close (any reason), decrement the counter; on heartbeat
   miss (Phase 3 §4), counter expires via Redis TTL so a crashed gateway
   cannot strand seats permanently.

### 4.2 Error code contract

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| WS close code   | `4403` (application-defined, in the `4000–4999` reserved range)     |
| Payload `code`  | `SEAT_LIMIT`                                                        |
| Payload `tier`  | One of `free / starter / pro / business / enterprise`               |
| Payload `limit` | The integer ceiling that was hit (`Infinity` is impossible — caller |
|                 | only sees this code when the cap is finite)                         |

This is the canonical error code clients SHOULD react to (see §6 UX).

### 4.3 Why the gateway, not Server Actions / middleware

- The cap is a **concurrency** invariant; only the long-lived socket
  layer knows the live count.
- Routing Middleware runs per-request, before upgrade, with no view of
  current room population — it can authenticate but not seat-gate.
- Server Actions don't enter the picture: collab is socket-only.

---

## 5. Credit metering — punt with recommendation

**Recommendation:** *do* meter active collab time, but ship the seat cap
in Phase 3 **without** credit metering, and add metering in Phase 8 §5
once the WS gateway is stable enough to emit reliable session events.
The cap alone is sufficient to bound platform cost; metering adds
revenue/upsell signal, not safety.

### 5.1 Proposed meter

Add to `MeteredFeature` (`src/lib/billing/types.ts:26`):

```ts
| 'sabflow_collab_minutes'   // 1 unit = 1 user-minute of active edit on a doc
```

Definition of "active":

- Socket open AND the client has sent at least one awareness or CRDT
  update in the last 60 seconds (idle / away clients per Phase 7 §8 do
  **not** consume credits).
- Granularity: 1-minute buckets. A client connected for 30s and 90s
  counts as 1 + 2 = 3 minutes.
- Recording: gateway emits one `recordUsage` call per minute per active
  client, with `idempotencyKey = "<docId>:<userId>:<bucketMinute>"` so
  the existing dedupe in `usage-meter.ts:52–67` makes the write safe to
  retry.

### 5.2 Proposed plan caps

| Plan         | `sabflow_collab_minutes` / mo cap |
| ------------ | --------------------------------- |
| `free`       | 60 (1 hour — solo only anyway)    |
| `starter`    | 1,000                             |
| `pro`        | 10,000                            |
| `business`   | 100,000                           |
| `enterprise` | `-1` unlimited                    |

These integrate cleanly with `enforceCap()` (`usage-meter.ts:114`) —
when the cap is reached, the gateway downgrades the socket to read-only
(see §6) rather than disconnecting, so live work in progress isn't
destroyed.

### 5.3 Alternative considered — per-seat-month

Charging "per concurrent collab seat per month" (e.g. $5 / seat /
month) was considered and rejected for now: it duplicates the
workspace-seat billing dimension and is hard to reconcile with the
per-doc nature of the cap. Punt to billing review before Phase 8.

---

## 6. UX for hitting the seat cap

Three behaviors, layered by user state:

### 6.1 Hard reject at upgrade — `SEAT_LIMIT`

When a user tries to open a doc that's already at capacity:

- **Modal, not toast.** The action they took (clicking the doc) was
  intentional, the failure is binding — toast is wrong UX. Modal title:
  "This flow is full". Body: "Your `<plan>` plan allows `<N>` editors
  per flow at the same time. There are already `<N>` people editing —
  ask one of them to leave, or join as a viewer."
- **Two CTAs:**
  1. **Join as viewer** (read-only socket; only counts against the
     viewer cap from §3.2). This is the queue-substitute — they get
     live updates, just can't edit.
  2. **Upgrade plan** — deep links to `/dashboard/billing` with
     `?reason=sabflow_seat_cap&plan=<currentPlanId>`. Free / Starter
     users see this prominently; Enterprise customers don't see it
     (the cap is unlimited there, so they wouldn't be in this modal).
- Optional **request edit access** button — sends an in-app
  notification to the doc's owner (uses the existing notification
  bridge in `src/lib/events/notification-bridge.ts`). Out-of-scope for
  Phase 3; nice-to-have in Phase 8.

### 6.2 Soft demotion when meter cap hits (§5 cap, not §3 cap)

When `sabflow_collab_minutes` for the tenant is exhausted mid-session:

- Gateway sends a `meter_exceeded` frame to the client.
- Client downgrades to **read-only** in-place (CRDT ops rejected
  locally with a banner: "You've hit your monthly collab limit. View
  only until next month, or upgrade to keep editing."). Existing live
  edits are preserved — the user is not disconnected.
- This is the "queue / read-only fallback" the brief asks for.

### 6.3 Paywall as escape hatch

The "Upgrade plan" CTA in 6.1 / 6.2 routes to the existing billing
dashboard at `src/app/dashboard/billing` (page already exists per
project memory). No new paywall surface is added; the seat model just
emits the right deep-link reasons so the billing page can pre-select
the recommended tier.

---

## 7. Out of scope for this ADR

- Implementing `src/lib/sabflow/plan-limits.ts` (Phase 8).
- Adding `sabflow_collab_minutes` to `MeteredFeature` (Phase 8 §5).
- Building the share-link role tokens (Phase 8 §3).
- Multi-instance counter coordination (Phase 7 §9 Redis pub/sub — same
  Redis the counter lives in, so the topology lines up naturally).
- Billing-side revenue impact analysis (punted to billing review per
  §5.3).

---

## 8. Open questions

1. Should "viewer cap" be a hard cap or soft (warn-only)? §3.2 lists
   numbers but the WS gateway design in §4 only enforces editor cap.
   **Decision (2026-05-18):** the viewer cap is **soft** in Phase 3 — the
   per-tier numbers in §3.2 are an *advisory* ceiling enforced by client UX
   (banner + "upgrade" CTA), not by the gateway. Rationale: `sabflow-ws-
   gateway-node.md` §5 already shears slow viewers via the 1 MiB send-queue
   cap and `4500` close, and §6 only counts editor seats. Hardening to a
   gateway-enforced viewer counter is deferred to Phase 8 §5 once the
   `sabflow_collab_minutes` meter ships — at that point viewers above the
   cap get demoted to polling rather than rejected, matching the editor
   meter-cap UX (read-only demotion).
2. When a workspace admin is over the per-doc editor cap, do they get
   a forced-bump-someone-else override? Punt to Phase 8 §10 (workspace
   admin override).
3. Should `enterprise` `perDocEditors` actually be `-1` or a very large
   finite number (e.g. 500) to bound CRDT merge cost? Track A Phase 1
   §4 bench will inform — if Yjs/yrs both flatline past 200
   clients/doc, the literal value becomes "high enough nobody notices"
   regardless of whether it's `-1` or `500`.

---

## Summary

SabFlow real-time collab introduces a **per-document concurrent-editor
cap** distinct from workspace member seats. Five tiers, matched to the
canonical plan ids in `src/lib/billing/entitlements.ts:28–169`:

| Plan         | Per-doc editors | Per-doc viewers   |
| ------------ | --------------- | ----------------- |
| `free`       | 1               | 5                 |
| `starter`    | 3               | 25                |
| `pro`        | 5               | 100               |
| `business`   | 10              | unlimited         |
| `enterprise` | unlimited       | unlimited         |

**Enforcement point:** the SabFlow WebSocket gateway (Track A Phase 3
§7). On upgrade, the gateway atomically increments a Redis counter
`sabflow:collab:<docId>:editors`; the N+1 connection is rejected with WS
close code `4403` and JSON payload `{ "code": "SEAT_LIMIT", "tier": …,
"limit": …, "docId": … }`. Counters TTL out on heartbeat miss so a
crashed gateway can't strand seats.

**Credit metering:** punt the per-minute meter
(`sabflow_collab_minutes`) to Phase 8 §5 — ship the cap alone first; the
cap is sufficient to bound platform cost. When the meter ships, it
downgrades the socket to read-only rather than disconnecting, preserving
the user's in-progress work.

**UX:** modal at hard cap with "Join as viewer" + "Upgrade plan" CTAs;
soft read-only demotion at meter cap; no new paywall surface — deep-link
into the existing `/dashboard/billing` page.

No billing or plan code is modified by this ADR; it is the contract that
Phase 3 §7 and Phase 8 §4–§5 will implement.
