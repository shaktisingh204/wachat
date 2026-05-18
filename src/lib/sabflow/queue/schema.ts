/**
 * SabFlow Redis queue schema — Bull v4-compatible key layout.
 *
 * Track B · Phase 2 · sub-task #1 of 10 (queue & dispatcher foundation).
 *
 * This file is **schema only**: no Redis I/O, no client construction, no Lua
 * loading. It exports the namespace constants, the typed job-hash shape, and
 * a `queueKeys()` builder that returns every sub-key for a given queue. The
 * surface is consumed by:
 *   - the Node producer side (Next.js Route Handlers / Server Actions
 *     enqueueing executions, webhook deliveries, and cron-fired triggers);
 *   - the Node / Rust worker side (claim loops, heartbeats, completion / fail
 *     handlers, stalled-job reaper);
 *   - `bull-board` and other off-the-shelf Bull inspectors, which read the
 *     keys directly without going through our code.
 *
 * Compatibility target: **Bull v4** (`bull@^4`) — the family `bull-board`
 * still ships first-class support for. BullMQ uses a similar but not
 * identical layout; the differences (e.g. `prioritized` ZSET, `events`
 * stream) are intentionally **not** mirrored here. The sibling Lua scripts
 * (sub-tasks #2–#10 of Phase 2) implement Bull v4 semantics, not BullMQ's.
 *
 * See: `docs/adr/sabflow-queue-schema.md` for the namespace rationale,
 * Bull-compat reasoning, multi-tenant scoping rule, and the explicit
 * "no `bull` npm dep" decision.
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Namespace
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Root namespace prefix for every SabFlow queue key on Redis.
 *
 * Final key shape: `${SABFLOW_QUEUE_NAMESPACE}:${queueName}:${subKey}`.
 * Keeping the prefix as a single constant lets us flip the whole tree under
 * a different root (e.g. for a blue/green Redis migration) by editing one
 * line, and prevents accidental collisions with non-SabFlow consumers on a
 * shared Redis instance.
 */
export const SABFLOW_QUEUE_NAMESPACE = 'sabflow:queue' as const;

/**
 * Canonical queue names. Three queues, each owning one trigger surface.
 *
 * - `sabflow:executions` — workflow runs (manual + production triggers that
 *   resolve to a full `WorkflowExecute` invocation).
 * - `sabflow:webhooks`   — inbound webhook deliveries; each job carries the
 *   request snapshot and the target workflow id. The webhook handler
 *   enqueues here and (for "Respond Immediately" mode) returns to the
 *   client without waiting on the worker.
 * - `sabflow:cron`       — scheduled-trigger fires from Vercel Cron. The
 *   cron endpoint pushes one job per fire; the worker resolves the trigger
 *   and enqueues a follow-up job on `sabflow:executions`.
 */
export const SABFLOW_QUEUE_NAMES = {
  EXECUTIONS: 'sabflow:executions',
  WEBHOOKS: 'sabflow:webhooks',
  CRON: 'sabflow:cron',
} as const;

/** Union of canonical queue names (string-literal type). */
export type QueueName =
  (typeof SABFLOW_QUEUE_NAMES)[keyof typeof SABFLOW_QUEUE_NAMES];

/** Runtime guard: is `value` one of the canonical queue names? */
export function isQueueName(value: unknown): value is QueueName {
  return (
    typeof value === 'string' &&
    (Object.values(SABFLOW_QUEUE_NAMES) as readonly string[]).includes(value)
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Key builder
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Every sub-key under a queue's namespace. The shape mirrors Bull v4 so an
 * unmodified `bull-board` instance can attach and render dashboards.
 *
 * Sub-key types (Redis data structure in parens):
 *
 * - `id`        (counter)  — monotonically increasing job-id source.
 *                            `INCR` on enqueue.
 * - `wait`      (LIST)     — job ids ready to be claimed. Producer
 *                            `LPUSH`es; worker atomically moves the head
 *                            into `active` via `BRPOPLPUSH`.
 * - `active`    (LIST)     — job ids currently being processed. One entry
 *                            per in-flight job per worker.
 * - `delayed`   (ZSET)     — score = run-at epoch-ms. A background mover
 *                            promotes due jobs into `wait` once
 *                            `score <= now`.
 * - `failed`    (LIST)     — terminal failed job ids (after retries
 *                            exhausted). Bounded by queue `meta.maxFailed`.
 * - `completed` (LIST)     — terminal succeeded job ids. Bounded by queue
 *                            `meta.maxCompleted`.
 * - `repeat`    (ZSET)     — repeatable-job definitions; score = next-run
 *                            epoch-ms. The producer for `sabflow:cron`
 *                            reads this on every tick.
 * - `meta`      (HASH)     — queue config (limits, defaults) + running
 *                            counts (atomic counters touched by Lua).
 * - `stalled`   (SET)      — job ids whose worker-heartbeat lock TTL has
 *                            lapsed. The stalled-job reaper drains this
 *                            set back into `wait` up to
 *                            `meta.maxStalledCount` times before pushing
 *                            the job into `failed`.
 *
 * Plus, **per job**:
 *
 * - `${jobId}`      (HASH) — the job record itself. See `JobHashFields`.
 * - `${jobId}:logs` (LIST) — bounded operator-visible log lines emitted by
 *                            the executor (one line per `LPUSH`). Trimmed
 *                            to `meta.maxLogsPerJob`.
 * - `${jobId}:lock` (STRING with TTL) — the heartbeat lock held by the
 *                            owning worker while the job is in `active`.
 *                            Renewed every `lockRenewMs`; expiry drops the
 *                            job id into `stalled`.
 */
export interface QueueKeys {
  /** Bare namespace prefix — `sabflow:queue:<queueName>`. */
  ns: string;
  /** Counter for job ids. */
  id: string;
  /** LIST — jobs waiting for a worker. */
  wait: string;
  /** LIST — jobs currently claimed by workers. */
  active: string;
  /** ZSET — jobs scheduled for a future run-at. Score = epoch-ms. */
  delayed: string;
  /** LIST — terminally failed jobs (capped). */
  failed: string;
  /** LIST — terminally succeeded jobs (capped). */
  completed: string;
  /** ZSET — repeatable-job definitions. Score = next-run epoch-ms. */
  repeat: string;
  /** HASH — queue-wide config + atomic counters. */
  meta: string;
  /** SET — jobs whose heartbeat lock expired. */
  stalled: string;
  /** Build the per-job HASH key. */
  job: (jobId: string) => string;
  /** Build the per-job LIST key for bounded log lines. */
  jobLogs: (jobId: string) => string;
  /** Build the per-job STRING (with TTL) key for the heartbeat lock. */
  jobLock: (jobId: string) => string;
}

/**
 * Compose every sub-key for `queueName`. Pure function; no I/O.
 *
 * @example
 *   const k = queueKeys(SABFLOW_QUEUE_NAMES.EXECUTIONS);
 *   k.wait              // → 'sabflow:queue:sabflow:executions:wait'
 *   k.job('42')         // → 'sabflow:queue:sabflow:executions:42'
 *   k.jobLogs('42')     // → 'sabflow:queue:sabflow:executions:42:logs'
 */
export function queueKeys(queueName: QueueName): QueueKeys {
  const ns = `${SABFLOW_QUEUE_NAMESPACE}:${queueName}`;
  return {
    ns,
    id: `${ns}:id`,
    wait: `${ns}:wait`,
    active: `${ns}:active`,
    delayed: `${ns}:delayed`,
    failed: `${ns}:failed`,
    completed: `${ns}:completed`,
    repeat: `${ns}:repeat`,
    meta: `${ns}:meta`,
    stalled: `${ns}:stalled`,
    job: (jobId: string) => `${ns}:${jobId}`,
    jobLogs: (jobId: string) => `${ns}:${jobId}:logs`,
    jobLock: (jobId: string) => `${ns}:${jobId}:lock`,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Job hash shape
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Workspace plan tier carried on every job. Used by the rate-limit sibling
 * (Phase 2 sub-task #4) to choose the per-job concurrency budget without a
 * second Mongo round-trip on the hot path. Kept as a string-literal union
 * so a forgotten plan upgrade is a compile error, not a silent fallback.
 *
 * Mirror the plan ids used by SabNode's plan-gate (`@/lib/plans`). If a new
 * plan lands, update this list in lockstep.
 */
export type JobPlanTier = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';

/**
 * Optional parent-reference for sub-workflow jobs. A sub-workflow invocation
 * captures the parent execution + node so the executor can resume the parent
 * once the child finishes. Matches n8n's `executeWorkflow` continuation.
 */
export interface JobParentRef {
  /** Parent job's `id` (from the same or another queue). */
  id: string;
  /** Queue the parent job lives on. */
  queue: QueueName;
  /** Node id inside the parent workflow that triggered the sub-workflow. */
  nodeId?: string;
}

/**
 * Bull-compatible job-hash field set, with SabFlow extensions.
 *
 * Stored as a Redis HASH under `${ns}:${jobId}`. **All values on disk are
 * strings** — Redis hashes have no typed values. Producers `JSON.stringify`
 * `data`, `opts`, `returnvalue`, and `parent` before `HSET`; consumers
 * parse them on read. Numeric fields are written as decimal strings.
 *
 * Multi-tenancy: `workspaceId` is **required** and lives on every job hash
 * so a stalled-job reaper, a `bull-board` dashboard, or a DLQ replay tool
 * can scope work without joining back to Mongo. Per CLAUDE.md SaaS rules.
 */
export interface JobHashFields {
  /** Job id (same as the trailing segment of the hash key). Decimal string. */
  id: string;
  /**
   * Job name — the **producer-supplied** logical name (e.g.
   * `execute-workflow`, `deliver-webhook`, `fire-cron`). Distinct from
   * `QueueName`. Bull dashboards group by this field.
   */
  name: string;
  /** Producer payload, JSON-encoded. Schema is per-queue and per-`name`. */
  data: string;
  /**
   * Bull-compat job options, JSON-encoded. Includes `attempts`, `backoff`,
   * `delay`, `removeOnComplete`, `removeOnFail`, `priority`, `jobId`,
   * `repeat`, `timeout`, `lifo`, plus SabFlow-only extensions documented in
   * `docs/adr/sabflow-queue-schema.md`.
   */
  opts: string;
  /** Priority (lower = higher priority). Decimal string. Default `'0'`. */
  priority: string;
  /** Configured retry budget. Decimal string. */
  attempts: string;
  /** Retries consumed so far. Decimal string. Bumped on every failure. */
  attemptsMade: string;
  /** Epoch-ms when the worker first claimed this job, if it ever was. */
  processedOn?: string;
  /** Epoch-ms when this job reached a terminal state. */
  finishedOn?: string;
  /** Failure reason captured at last attempt. Plain string, not JSON. */
  failedReason?: string;
  /** JSON-encoded successful return value, if the job completed. */
  returnvalue?: string;
  /**
   * Stack trace blob for the most recent failure. Same shape as Bull's
   * `stacktrace` field — a JSON array of strings, capped at the worker's
   * configured trace depth.
   */
  stacktrace?: string;
  /** Parent job ref, JSON-encoded. Present only on sub-workflow jobs. */
  parent?: string;
  /**
   * Owning workspace (multi-tenant scope). Required — every SabNode row,
   * Redis job, blob, and audit entry carries it.
   */
  workspaceId: string;
  /** Plan tier of `workspaceId` at enqueue time. Used by the rate limiter. */
  plan: JobPlanTier;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Re-exports for convenience
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Default queue-meta hash fields the producer writes on first `ensureQueue()`.
 * Read by the dispatcher, by `bull-board`, and by the alerting sibling
 * (Phase 2 sub-task #9). Schema-only — actual writes belong to the
 * dispatcher implementation.
 */
export interface QueueMetaFields {
  /** Bull-compat queue name (echoed for inspectors). */
  name: QueueName;
  /** Soft cap on the `completed` LIST length. */
  maxCompleted: string;
  /** Soft cap on the `failed` LIST length. */
  maxFailed: string;
  /** Soft cap on per-job log lines. */
  maxLogsPerJob: string;
  /** How many times a stalled job is re-queued before going to `failed`. */
  maxStalledCount: string;
  /** Heartbeat lock TTL (ms). */
  lockDurationMs: string;
  /** Heartbeat renew interval (ms). Producers honour `lockDurationMs / 2`. */
  lockRenewMs: string;
}
