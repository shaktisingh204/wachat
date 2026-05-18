# ADR — SabFlow Redis Queue Schema (Bull v4-compatible)

**Status:** Proposed (Track B · Phase 2 · sub-task #1 of 10)
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 2
**Phase branch:** `phase/b-2-queue`
**File ownership:** `src/lib/sabflow/queue/schema.ts`
**Related ADRs:**
- `docs/adr/sabflow-executor-foundation.md` — umbrella; pins "Bull on Redis, Bull-compatible job schema so existing n8n tooling can inspect queues".
- `docs/adr/sabflow-executor-n8n-survey.md` §4 — Bull queue semantics SabFlow inherits (atomic claim, lock + heartbeat, retry policy, delayed jobs, completion events, no first-class DLQ).
- `docs/adr/sabflow-execution-state.md` — Mongo-side execution record; the queue job holds a pointer to its execution id, not the heavy `runData`.

---

## 1. Summary (≤200 words)

SabFlow's queue layer on Redis uses a **Bull v4-compatible** key layout under
the namespace `sabflow:queue:<queueName>:*`. Three queues exist —
`sabflow:executions` (workflow runs), `sabflow:webhooks` (inbound deliveries),
`sabflow:cron` (scheduled fires) — and each carries the canonical Bull
sub-keys (`id`, `wait`, `active`, `delayed`, `failed`, `completed`,
`repeat`, `meta`, `stalled`, `<jobId>`, `<jobId>:logs`, `<jobId>:lock`).
Bull-compat means `bull-board` and any other off-the-shelf inspector can
attach without code changes, and operators carry their n8n mental model
across unchanged. Every job hash carries `workspaceId` and `plan` so
multi-tenant scoping survives at the queue layer without a Mongo join, and
so the rate-limit sibling can pick a concurrency budget on the hot path.
We deliberately do **not** depend on the `bull` npm package: Rust workers
must consume the same keys, and we own the Lua scripts so semantics stay
identical across Node and Rust consumers. This ADR fixes the schema only;
the dispatcher, claim loop, stalled-job reaper, retry engine, and Lua
scripts are owned by sibling sub-tasks #2–#10 of Phase 2.

## 2. Namespace rationale

A single root prefix (`sabflow:queue`) gives us three properties:

1. **Single-instance Redis safety.** SabNode shares a Redis instance with
   other modules (presence, rate-limit counters, session caches). A
   distinguishing root prefix prevents accidental key collisions and lets
   ops tools (`KEYS sabflow:queue:*`, `SCAN MATCH sabflow:queue:*`) scope
   to just the queue layer.
2. **Blue/green swap.** Migrating the whole queue tree under a different
   prefix (e.g. `sabflow:queue:v2`) becomes a single-constant change in
   `schema.ts`, not a grep across consumers. Sibling Lua scripts read the
   prefix from a passed-in key list, never hard-code it.
3. **Bull-compat at the dashboard layer.** `bull-board` expects a prefix
   followed by `:<queueName>:<subKey>`. Our shape is exactly that —
   `sabflow:queue` is the prefix, `<queueName>` is one of the three
   canonical names, and the sub-keys are the Bull v4 set.

Queue names are namespaced themselves (`sabflow:executions`, not
`executions`) so that even if someone reads keys without the root prefix,
the queue identity stays unambiguous in logs and span attributes.

## 3. Bull v4 compatibility — what we mirror, what we don't

| Bull v4 sub-key       | Type         | We mirror it? | Notes                                                       |
| --------------------- | ------------ | ------------- | ----------------------------------------------------------- |
| `<ns>:id`             | counter      | Yes           | `INCR` on enqueue; monotonic.                               |
| `<ns>:wait`           | LIST         | Yes           | `LPUSH` producer / `BRPOPLPUSH` claim.                      |
| `<ns>:active`         | LIST         | Yes           | One entry per in-flight job.                                |
| `<ns>:delayed`        | ZSET         | Yes           | Score = run-at epoch-ms.                                    |
| `<ns>:failed`         | LIST         | Yes           | Bounded; trimmed by Lua.                                    |
| `<ns>:completed`      | LIST         | Yes           | Bounded; trimmed by Lua.                                    |
| `<ns>:repeat`         | ZSET         | Yes           | Used by `sabflow:cron`.                                     |
| `<ns>:meta`           | HASH         | Yes           | Queue config + atomic counters.                             |
| `<ns>:stalled`        | SET          | Yes           | Drained by the stalled-job reaper.                          |
| `<ns>:<jobId>`        | HASH         | Yes           | Job record. See `JobHashFields`.                            |
| `<ns>:<jobId>:logs`   | LIST         | Yes           | Bounded operator-visible log lines.                         |
| `<ns>:<jobId>:lock`   | STRING + TTL | Yes           | Heartbeat lock.                                             |
| `<ns>:events`         | STREAM       | **No**        | BullMQ-only — not needed; we publish via Redis pub/sub.     |
| `<ns>:prioritized`    | ZSET         | **No**        | BullMQ-only; we use Bull v4's per-job `priority` field.     |
| `<ns>:waiting-children` | ZSET       | **No**        | Sub-workflow continuation lives on the parent job hash.     |

We mirror **Bull v4**, not BullMQ. The reason is `bull-board`: its v4
adapter is the most stable and most widely deployed in the n8n operator
ecosystem we're targeting for migration. The BullMQ-only keys
(`events` STREAM, `prioritized` ZSET, `waiting-children`) are not added —
they would force every consumer (including the Rust worker) to ship two
code paths.

### Job-hash fields

The fields below are present on every job hash. All values are stored as
strings on Redis; JSON-encoded fields are documented as such.

| Field            | Type    | Source             | Notes                                                                                         |
| ---------------- | ------- | ------------------ | --------------------------------------------------------------------------------------------- |
| `id`             | string  | counter            | Same as the trailing key segment.                                                             |
| `name`           | string  | producer           | Logical name (`execute-workflow`, `deliver-webhook`, `fire-cron`). Distinct from queue name.  |
| `data`           | JSON    | producer           | Payload. Per-queue, per-`name` schema.                                                        |
| `opts`           | JSON    | producer           | Bull options: `attempts`, `backoff`, `delay`, `priority`, `removeOnComplete`, `repeat`, ...   |
| `priority`       | number  | `opts.priority`    | Lower = higher.                                                                               |
| `attempts`       | number  | `opts.attempts`    | Retry budget.                                                                                 |
| `attemptsMade`   | number  | worker             | Incremented on every failure.                                                                 |
| `processedOn`    | number? | worker             | Epoch-ms of first claim.                                                                      |
| `finishedOn`     | number? | worker             | Epoch-ms of terminal state.                                                                   |
| `failedReason`   | string? | worker             | Most recent failure message.                                                                  |
| `returnvalue`    | JSON?   | worker             | Successful return value.                                                                      |
| `stacktrace`     | JSON?   | worker             | Capped array of stack frames.                                                                 |
| `parent`         | JSON?   | producer           | Sub-workflow continuation; `{ id, queue, nodeId? }`.                                          |
| `workspaceId`    | string  | producer           | **Required.** Multi-tenant scope.                                                             |
| `plan`           | string  | producer           | Plan tier; read by the rate limiter without a Mongo round-trip.                               |

## 4. Multi-tenant scoping

Per CLAUDE.md ("Assume multi-tenant, plan-gated, credit-metered,
RBAC-guarded"), every artefact in SabNode carries `workspaceId`. The queue
is no exception:

- Every job hash has `workspaceId` set at enqueue time. Producers that
  cannot resolve a workspace must fail-closed; they must not enqueue with
  a placeholder.
- `plan` is captured at enqueue so the rate-limit sibling can pick a
  concurrency budget without re-reading Mongo on every claim. If a
  workspace's plan changes mid-job, the in-flight job retains the
  enqueue-time tier — re-pricing happens on the next enqueue, not
  mid-execution.
- We do **not** shard the queue by workspace. One global queue per
  surface (`executions` / `webhooks` / `cron`), with workspace filtering
  applied at claim time (the rate-limit Lua sibling consumes
  `meta:budget:<workspaceId>` counters). Sharding by workspace would
  multiply the stalled-job reaper's work by O(workspaces) and break
  `bull-board`'s dashboard view.

Dashboards (`bull-board`, operator tooling) that need a per-workspace cut
should filter by the `workspaceId` hash field; the schema makes that a
single `HGET` per job, not a Mongo join.

## 5. Why we don't depend on the `bull` npm package

We are Bull-**compatible** on the wire, not Bull-**dependent** in code.
The reasons:

1. **Rust consumers.** Per `sabflow-executor-foundation.md` §3, hot-path
   workers may be Rust. The Rust consumer cannot import the `bull` npm
   package; it must speak the wire schema directly. If Node consumers
   used `bull`'s in-process semantics and Rust consumers used hand-rolled
   Lua, the two would drift the first time `bull` changed a script. By
   owning the Lua ourselves, Node and Rust consumers run **identical**
   scripts against the same Redis.
2. **Lua ownership.** Bull's claim / promote / move-to-failed scripts are
   battle-tested but opaque to us when we need to add SabFlow-specific
   atomic operations (per-workspace rate-limit decrement, plan-aware
   priority bumping, credit-metering hooks). Owning the Lua means we can
   add those operations in the same atomic batch as the claim, not as a
   second round-trip.
3. **No JS-runtime dependency for the schema.** The schema file is
   pure-type. Importing `bull` would pull in `ioredis` and the entire Bull
   runtime into any file that wants to type-check a job hash — including
   the Next.js bundle for any Route Handler that just wants to enqueue.
4. **Bull v3 / v4 / BullMQ split.** The ecosystem is fragmented. Pinning to
   a wire-level subset (Bull v4 layout) is more durable than pinning to
   any one npm package version, all of which are at different points in
   their deprecation cycle.

What we **do** keep:

- Wire-level compat with `bull-board` (and similar inspectors).
- The same key shapes, the same data structures (LIST / ZSET / HASH /
  SET / STRING), and the same atomic-claim sequence (`BRPOPLPUSH` head of
  `wait` into `active`, set lock with TTL, renew lock at half the TTL).
- Bull's `opts` JSON shape inside the job hash, so migrated n8n queues
  can be replayed by a small adapter that rewrites only the namespace
  prefix.

## 6. Out of scope

Owned by sibling Phase 2 sub-tasks:

- #2 — dispatcher (Lua scripts: enqueue, claim, complete, fail, promote,
  reap-stalled).
- #3 — worker claim loop + heartbeat (Node) and Rust mirror.
- #4 — rate-limit Lua script reading `plan` off the job hash.
- #5 — retry policy + exponential backoff with jitter.
- #6 — delayed-job mover (`delayed` → `wait` when `score <= now`).
- #7 — repeatable-job materialiser for `sabflow:cron`.
- #8 — DLQ promotion (sub-workflow of `failed`).
- #9 — observability + alerting hooks on `meta`.
- #10 — `bull-board` mounting + auth on the operator dashboard.

## 7. Decision log

| Date       | Event                     | Notes                                                                                   |
| ---------- | ------------------------- | --------------------------------------------------------------------------------------- |
| 2026-05-18 | Schema landed             | Phase 2 sub-task #1 of 10. Namespace fixed; Bull v4 compat; no `bull` npm dep; multi-tenant `workspaceId` on every hash. |
