/**
 * SabFlow executor — dead-letter queue admin surface + alert dispatcher.
 *
 * Sibling of `rust/crates/sabflow-executor/queue/src/dlq.rs`. The Rust
 * dispatcher (Track B Phase 2 sub-task #3) writes terminally-failed jobs
 * into Redis with the layout below; this module is the Node-side reader,
 * mutator, and alert fanout.
 *
 * ## Key layout (must match dlq.rs)
 *
 * ```text
 *   sabflow:queue:{name}:dlq         LIST  — LPUSH'd by Rust dispatcher,
 *                                            LTRIM'd to 10k FIFO.
 *   bull:{queue}:{jobId}             HASH  — original BullMQ job hash;
 *                                            the Rust side HSET's two
 *                                            extra fields onto it:
 *                                              `dlqedAt`   ms-since-epoch
 *                                              `dlqReason` short string
 *   sabflow:dlq:{name}               CHAN  — PUBSUB; Rust PUBLISH'es a
 *                                            `DlqNotice` JSON blob here.
 * ```
 *
 * ## What lives here
 *
 *  - `listDlq()`        — admin paginator over the DLQ list.
 *  - `requeueFromDlq()` — pull a job back to the wait list and clear the
 *                         DLQ annotations.
 *  - `purgeDlq()`       — bulk-delete entries older than a wall-clock cutoff.
 *  - `startDlqAlertDispatcher()` — SUBSCRIBE to `sabflow:dlq:*` and on
 *                         message fan-out to in-app + admin email when the
 *                         workspace's daily DLQ count crosses the threshold.
 *
 * Server-only — wires through `ioredis`, `mongodb`, and `nodemailer`.
 */

import 'server-only';
import IORedis, { type Redis } from 'ioredis';

/* ══════════════════════════════════════════════════════════
   Constants — must mirror dlq.rs
   ══════════════════════════════════════════════════════════ */

/** Daily DLQ alert threshold per workspace. Above this we page admins. */
export const DLQ_DAILY_ALERT_THRESHOLD = 10;

/** Mirror of `DLQ_MAX_ENTRIES` in `dlq.rs`. Used by `purgeDlq` sanity-checks. */
export const DLQ_MAX_ENTRIES = 10_000;

/** Default admin-email cooldown so a flood of DLQs doesn't paper over the inbox. */
const ADMIN_EMAIL_COOLDOWN_MS = 15 * 60 * 1000;

/* ══════════════════════════════════════════════════════════
   Key helpers — `dlq_list_key` / `dlq_channel` from dlq.rs
   ══════════════════════════════════════════════════════════ */

export function dlqListKey(queueName: string): string {
  return `sabflow:queue:${queueName}:dlq`;
}

export function dlqChannel(queueName: string): string {
  return `sabflow:dlq:${queueName}`;
}

/** BullMQ job-hash key. Matches `dlq.rs::job_hash_key`. */
export function jobHashKey(queueName: string, jobId: string): string {
  return `bull:${queueName}:${jobId}`;
}

/** BullMQ wait-list key for requeue. */
function waitKey(queueName: string): string {
  return `bull:${queueName}:wait`;
}

/* ══════════════════════════════════════════════════════════
   Types — wire-compatible with dlq.rs::DlqNotice
   ══════════════════════════════════════════════════════════ */

export interface DlqNotice {
  queue: string;
  jobId: string;
  reason: string;
  dlqedAtMs: number;
}

export interface DlqEntry {
  /** BullMQ job id (string on the wire, even when numeric). */
  jobId: string;
  /** When the dispatcher moved it here (ms since epoch). Null if HSET raced a cleanup. */
  dlqedAtMs: number | null;
  /** Short taxonomy: `max-retries` / `poison-payload` / `stalled-cap` / … */
  dlqReason: string | null;
  /** Attempts the job made before being moved (from BullMQ's own field). */
  attemptsMade: number | null;
  /** Last failure message BullMQ recorded. */
  failedReason: string | null;
  /** Workspace / tenant id read off the job's `data` JSON. */
  workspaceId: string | null;
  /** Raw `name` BullMQ stored — useful for filtering in the admin UI. */
  name: string | null;
  /** Raw `data` blob — parsed from JSON when readable, else the string. */
  data: unknown;
}

/* ══════════════════════════════════════════════════════════
   Hot-reload-safe singleton Redis connections
   ══════════════════════════════════════════════════════════ */

declare global {
  // eslint-disable-next-line no-var
  var __sabflowDlqRedis: Redis | undefined;
  // eslint-disable-next-line no-var
  var __sabflowDlqSub: Redis | undefined;
  // eslint-disable-next-line no-var
  var __sabflowDlqDispatcherStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __sabflowDlqLastAdminEmail: Map<string, number> | undefined;
}

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (globalThis.__sabflowDlqRedis) return globalThis.__sabflowDlqRedis;
  const r = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });
  r.on('error', (err) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[sabflow-dlq] redis error:', err.message);
    }
  });
  globalThis.__sabflowDlqRedis = r;
  return r;
}

/* ══════════════════════════════════════════════════════════
   Admin read: listDlq
   ══════════════════════════════════════════════════════════ */

/**
 * Page through the DLQ for a queue. Returns at most `opts.limit` entries
 * (default 50, max 500) starting at `opts.cursor` (default 0).
 *
 * Reads a window of job ids off the DLQ list via LRANGE, then HMGET's each
 * job hash in parallel to materialise the structured fields. Best-effort:
 * missing hashes (Bull cleaned them up out from under us) are returned with
 * `dlqedAtMs = null` so the admin UI can still show the bare id.
 */
export async function listDlq(
  queueName: string,
  opts?: { limit?: number; cursor?: number },
): Promise<DlqEntry[]> {
  const redis = getRedis();
  if (!redis) return [];

  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 500);
  const cursor = Math.max(opts?.cursor ?? 0, 0);
  const stop = cursor + limit - 1;

  const ids = await redis.lrange(dlqListKey(queueName), cursor, stop);
  if (ids.length === 0) return [];

  // Parallel HMGET — one round trip per job hash. For 50-entry pages this
  // is fine; for larger windows the caller bumps `limit` knowing the cost.
  const entries = await Promise.all(
    ids.map(async (jobId): Promise<DlqEntry> => {
      const fields = await redis
        .hmget(
          jobHashKey(queueName, jobId),
          'dlqedAt',
          'dlqReason',
          'attemptsMade',
          'failedReason',
          'name',
          'data',
        )
        .catch(() => [null, null, null, null, null, null]);

      const [dlqedAtRaw, dlqReason, attemptsRaw, failedReason, name, dataRaw] =
        fields;

      let workspaceId: string | null = null;
      let data: unknown = dataRaw;
      if (typeof dataRaw === 'string' && dataRaw.length > 0) {
        try {
          const parsed = JSON.parse(dataRaw);
          data = parsed;
          if (parsed && typeof parsed === 'object') {
            const obj = parsed as Record<string, unknown>;
            const wid = obj.workspaceId ?? obj.tenantId ?? obj.projectId;
            workspaceId = typeof wid === 'string' ? wid : null;
          }
        } catch {
          /* leave data as the raw string */
        }
      }

      return {
        jobId,
        dlqedAtMs: dlqedAtRaw ? Number.parseInt(dlqedAtRaw, 10) || null : null,
        dlqReason: dlqReason ?? null,
        attemptsMade: attemptsRaw
          ? Number.parseInt(attemptsRaw, 10) || null
          : null,
        failedReason: failedReason ?? null,
        workspaceId,
        name: name ?? null,
        data,
      };
    }),
  );

  return entries;
}

/* ══════════════════════════════════════════════════════════
   Admin mutate: requeueFromDlq
   ══════════════════════════════════════════════════════════ */

/**
 * Move a job back from the DLQ to the BullMQ `wait` list. Clears the DLQ
 * annotations (`dlqedAt`, `dlqReason`) and resets `attemptsMade` to 0 so
 * the dispatcher's retry budget is reset.
 *
 * Returns `{ ok: false }` if the job wasn't on the DLQ list — this is a
 * common race when an admin clicks "requeue" twice. The caller surfaces
 * the boolean to the UI without a separate error code.
 */
export async function requeueFromDlq(
  queueName: string,
  jobId: string,
): Promise<{ ok: boolean }> {
  const redis = getRedis();
  if (!redis) return { ok: false };

  // LREM with count=0 nukes every instance of `jobId` from the list (there
  // should only ever be one, but we don't want a stale dup to keep a job
  // pinned in the DLQ view after a successful requeue).
  const removed = await redis.lrem(dlqListKey(queueName), 0, jobId);
  if (removed === 0) return { ok: false };

  const hash = jobHashKey(queueName, jobId);

  // Clear DLQ annotations + reset attempt counter, then LPUSH back onto
  // `wait` so a worker picks it up immediately. Pipeline so the whole
  // thing is one round trip.
  const pipe = redis.pipeline();
  pipe.hdel(hash, 'dlqedAt', 'dlqReason');
  pipe.hset(hash, 'attemptsMade', '0');
  pipe.lpush(waitKey(queueName), jobId);
  await pipe.exec();

  return { ok: true };
}

/* ══════════════════════════════════════════════════════════
   Admin mutate: purgeDlq
   ══════════════════════════════════════════════════════════ */

/**
 * Bulk-delete DLQ entries whose `dlqedAt` is older than `olderThanMs`
 * milliseconds in the past. Returns the count of entries removed.
 *
 * Implementation: paginate the DLQ list, HMGET `dlqedAt` for each id,
 * collect the stale ones, then LREM + DEL them. Caps work at
 * `DLQ_MAX_ENTRIES` per call so a runaway purge can't tie up Redis.
 */
export async function purgeDlq(
  queueName: string,
  olderThanMs: number,
): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  if (olderThanMs <= 0) return 0;

  const cutoff = Date.now() - olderThanMs;
  const listKey = dlqListKey(queueName);

  const ids = await redis.lrange(listKey, 0, DLQ_MAX_ENTRIES - 1);
  if (ids.length === 0) return 0;

  // Read `dlqedAt` for every entry. Missing hashes (already cleaned up)
  // also qualify for purge — the list entry is the only thing pinning
  // them in the admin UI.
  const stamps = await Promise.all(
    ids.map((id) =>
      redis.hget(jobHashKey(queueName, id), 'dlqedAt').catch(() => null),
    ),
  );

  const stale: string[] = [];
  ids.forEach((id, idx) => {
    const raw = stamps[idx];
    if (raw == null) {
      stale.push(id); // orphan list entry — purge unconditionally
      return;
    }
    const ts = Number.parseInt(raw, 10);
    if (Number.isFinite(ts) && ts < cutoff) stale.push(id);
  });

  if (stale.length === 0) return 0;

  // Pipeline the LREM + DEL. LREM count=0 removes every match (defensive);
  // DEL on the hash drops the BullMQ record entirely — by the time we
  // purge it has been "done" for at least `olderThanMs` and no Bull
  // consumer should still hold a reference.
  const pipe = redis.pipeline();
  for (const id of stale) {
    pipe.lrem(listKey, 0, id);
    pipe.del(jobHashKey(queueName, id));
  }
  await pipe.exec();

  return stale.length;
}

/* ══════════════════════════════════════════════════════════
   Alert dispatcher — SUBSCRIBE sabflow:dlq:*
   ══════════════════════════════════════════════════════════ */

/**
 * In-memory daily counter keyed by `${workspaceId}:${yyyymmdd}`. Used to
 * gate the alert at >10 entries/day. Persists for the lifetime of the
 * Node process — admins on long-running PM2 workers get accurate counts;
 * Vercel's Fluid Compute cold-starts reset to zero per invocation, so the
 * canonical counter on Vercel comes from Mongo (see TODO below).
 */
const dailyCounter: Map<string, number> = new Map();

function dailyKey(workspaceId: string): string {
  const now = new Date();
  const ymd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `${workspaceId}:${ymd}`;
}

/**
 * Start the PSUBSCRIBE listener for `sabflow:dlq:*`. Idempotent — safe to
 * call from multiple module-import sites; the singleton flag dedupes.
 *
 * On each message:
 *   1. Parse the `DlqNotice` payload.
 *   2. Look up the workspace owner via `data.workspaceId` (best-effort).
 *   3. Bump the daily counter. If >`DLQ_DAILY_ALERT_THRESHOLD`, fire:
 *      - In-app notification via the `notify()` action (reused from
 *        `src/app/actions/worksuite/chat.actions.ts`).
 *      - Admin email via nodemailer (mirrors `failureAlert.ts` plumbing).
 */
export function startDlqAlertDispatcher(): void {
  if (globalThis.__sabflowDlqDispatcherStarted) return;
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn(
      '[sabflow-dlq] REDIS_URL not set — alert dispatcher disabled',
    );
    return;
  }

  const sub = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  sub.on('error', (err) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[sabflow-dlq] subscriber error:', err.message);
    }
  });

  // PSUBSCRIBE so a single listener covers every queue (`executions`,
  // `cron`, future Phase-2 queues) without needing to redeploy on add.
  sub.psubscribe('sabflow:dlq:*').catch((err) => {
    console.warn('[sabflow-dlq] psubscribe failed:', err);
  });

  sub.on('pmessage', (_pattern, _channel, raw) => {
    void handleNotice(raw).catch((err) => {
      console.warn('[sabflow-dlq] alert handler crashed:', err);
    });
  });

  globalThis.__sabflowDlqSub = sub;
  globalThis.__sabflowDlqDispatcherStarted = true;
}

async function handleNotice(raw: string): Promise<void> {
  let notice: DlqNotice;
  try {
    notice = JSON.parse(raw) as DlqNotice;
  } catch {
    return; // malformed — drop
  }
  if (!notice?.queue || !notice?.jobId) return;

  // Pull workspaceId off the original job hash. The Rust DlqNotice payload
  // intentionally keeps the wire shape small; this lookup is the price.
  const redis = getRedis();
  if (!redis) return;
  const dataRaw = await redis
    .hget(jobHashKey(notice.queue, notice.jobId), 'data')
    .catch(() => null);

  let workspaceId: string | null = null;
  if (dataRaw) {
    try {
      const parsed = JSON.parse(dataRaw) as Record<string, unknown>;
      const wid = parsed.workspaceId ?? parsed.tenantId ?? parsed.projectId;
      if (typeof wid === 'string') workspaceId = wid;
    } catch {
      /* ignore */
    }
  }
  if (!workspaceId) return; // can't address an alert without a tenant

  // Daily-rate gate. The counter is in-process; on Vercel Fluid Compute
  // we lose state across cold starts, which is fine for the >10 threshold
  // — a burst of 10 in one invocation still alerts. The TODO below tracks
  // moving the counter into Mongo for cross-instance accuracy.
  const key = dailyKey(workspaceId);
  const next = (dailyCounter.get(key) ?? 0) + 1;
  dailyCounter.set(key, next);
  if (next <= DLQ_DAILY_ALERT_THRESHOLD) return;

  await dispatchAlert(workspaceId, notice, next);
}

async function dispatchAlert(
  workspaceId: string,
  notice: DlqNotice,
  countToday: number,
): Promise<void> {
  // ── In-app notification ─────────────────────────────────────────────
  // Reuses the existing `notify()` action in chat.actions.ts. We can't
  // import it directly here without pulling in `requireSession` (which
  // assumes a request context); instead we write to the notification
  // collection directly via the same shape `notify()` produces.
  try {
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    const now = new Date();

    // Address every workspace admin. `sabflow_workspace_members` carries
    // role; admins + owners get the in-app alert.
    const admins = await db
      .collection('sabflow_workspace_members')
      .find({ workspaceId, role: { $in: ['owner', 'admin'] } })
      .project({ userId: 1 })
      .toArray();

    if (admins.length === 0) {
      console.warn(
        `[sabflow-dlq] no admins found for workspace ${workspaceId} — skipping in-app alert`,
      );
    } else {
      const docs = admins.map((a) => ({
        recipient_user_id: String(a.userId),
        type: 'sabflow_dlq_threshold',
        title: `SabFlow DLQ threshold exceeded`,
        body: `Queue "${notice.queue}" has dead-lettered ${countToday} jobs today (>${DLQ_DAILY_ALERT_THRESHOLD}). Latest reason: ${notice.reason}.`,
        resource_type: 'sabflow_dlq',
        resource_id: `${notice.queue}:${notice.jobId}`,
        read_at: null,
        createdAt: now,
        updatedAt: now,
      }));
      await db.collection('notifications').insertMany(docs);
    }
  } catch (err) {
    console.warn('[sabflow-dlq] in-app alert failed:', err);
  }

  // ── Admin email ─────────────────────────────────────────────────────
  // Throttled per workspace to avoid mail-bombing on bursty failures.
  const lastSent = globalThis.__sabflowDlqLastAdminEmail ?? new Map<string, number>();
  globalThis.__sabflowDlqLastAdminEmail = lastSent;
  const cooldown = lastSent.get(workspaceId) ?? 0;
  if (Date.now() - cooldown < ADMIN_EMAIL_COOLDOWN_MS) return;
  lastSent.set(workspaceId, Date.now());

  try {
    await sendAdminEmail(workspaceId, notice, countToday);
  } catch (err) {
    console.warn('[sabflow-dlq] admin email failed:', err);
  }
}

async function sendAdminEmail(
  workspaceId: string,
  notice: DlqNotice,
  countToday: number,
): Promise<void> {
  // Mirrors the nodemailer setup in `src/lib/sabflow/alerting/failureAlert.ts`.
  // If SMTP env is missing we degrade silently — the in-app notification
  // is already in place.
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    // TODO(Track B Phase 2 sub-task #7 — observability): when the
    // platform-wide alerting plumbing lands (PagerDuty / Vercel-native
    // log drains), wire it here instead of the SMTP fallback.  The
    // exact integration point is this branch: replace the early return
    // with a call to the new alerting client.
    console.warn(
      '[sabflow-dlq] SMTP credentials missing — admin email skipped',
    );
    return;
  }

  // Look up admin email addresses through the same path the in-app
  // notification uses.
  const { connectToDatabase } = await import('@/lib/mongodb');
  const { ObjectId } = await import('mongodb');
  const { db } = await connectToDatabase();

  const admins = await db
    .collection('sabflow_workspace_members')
    .find({ workspaceId, role: { $in: ['owner', 'admin'] } })
    .project({ userId: 1 })
    .toArray();

  const userIds = admins
    .map((a) => a.userId)
    .filter((u): u is string => typeof u === 'string');
  if (userIds.length === 0) return;

  const userObjIds = userIds
    .filter((u) => /^[0-9a-fA-F]{24}$/.test(u))
    .map((u) => new ObjectId(u));
  const users = await db
    .collection('users')
    .find({ _id: { $in: userObjIds } })
    .project({ email: 1 })
    .toArray();
  const recipients = users
    .map((u) => u.email)
    .filter((e): e is string => typeof e === 'string' && e.length > 0);
  if (recipients.length === 0) return;

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: user,
    to: recipients.join(','),
    subject: `[SabFlow] DLQ threshold exceeded — ${notice.queue}`,
    text:
      `Workspace:   ${workspaceId}\n` +
      `Queue:       ${notice.queue}\n` +
      `DLQ'd today: ${countToday} (threshold ${DLQ_DAILY_ALERT_THRESHOLD})\n` +
      `Latest job:  ${notice.jobId}\n` +
      `Reason:      ${notice.reason}\n` +
      `Time:        ${new Date(notice.dlqedAtMs).toISOString()}\n` +
      `\nReview at /dashboard/sabflow/admin/dlq?queue=${encodeURIComponent(notice.queue)}\n`,
  });
}

/* ══════════════════════════════════════════════════════════
   Test-only helpers
   ══════════════════════════════════════════════════════════ */

/** Reset in-memory state. Tests only. */
export function _resetDlqStateForTests(): void {
  dailyCounter.clear();
  globalThis.__sabflowDlqLastAdminEmail?.clear();
}
