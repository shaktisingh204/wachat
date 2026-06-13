/**
 * SabMail push-sync worker.
 *
 * Run via PM2: pm2 start ... ; not a Next route.
 *   e.g. pm2 start npx --name sabmail-push-sync -- tsx src/workers/sabmail-push-sync.ts
 *   (or compile + `pm2 start dist/workers/sabmail-push-sync.js --name sabmail-push-sync`)
 *
 * A standalone, long-lived Node process — NOT a serverless function and NOT a
 * Next.js route.
 *
 * What it does
 * ────────────
 * Gmail (Cloud Pub/Sub) and Microsoft Graph deliver push notifications to
 * `/api/push/gmail` + `/api/push/outlook`, which persist lightweight RESYNC
 * MARKERS into `sabmail_events` (`{ event:'gmail_push' | 'graph_push',
 * status:'pending', ... }`). Those webhooks intentionally do NO fetching — they
 * ACK fast and leave the hydration to an async worker. This is that worker.
 *
 * On a poll loop (every {@link POLL_INTERVAL_MS}) it claims unconsumed markers
 * and, for each, POSTs `{ markerId }` to the thin internal Next route
 * `/api/sabmail/internal/push-sync`, which does the actual server-side provider
 * hydration (it CAN import the `server-only` adapters + message store +
 * `buildProviderContext`). On a 2xx `{ ok:true }` the worker stamps the marker
 * `consumedAt` (best-effort) so it isn't reprocessed; on a non-ok / failed POST
 * it leaves the marker pending for the next pass.
 *
 * Runtime constraints (mirrors `src/workers/sabmail-sync.ts` EXACTLY):
 *   - Runs under `tsx`; it owns its OWN Mongo client and does NOT import
 *     `@/lib/mongodb` (that module is `server-only` and crashes under tsx).
 *   - It does NOT import the provider adapters / message store / credential
 *     decryptor (all `server-only`). Like `sabmail-sync.ts` delegates inbound
 *     binding to an internal Next route, this worker delegates ALL hydration to
 *     the internal route above — so it pulls in zero `server-only` code.
 *   - No top-level await; everything boots from `main()`.
 *   - No app URL configured → it logs once and idles (the on-demand inbox read
 *     still shows the mail).
 *
 * Env: MONGODB_URI, MONGODB_DB, SABMAIL_APP_URL (or NEXT_PUBLIC_APP_URL /
 *      APP_URL), CRON_SECRET.
 */

import 'dotenv/config';
import { MongoClient, type Db, ObjectId } from 'mongodb';

// NOTE: do NOT import '@/lib/sabmail/db/collections' here — it begins with
// `import 'server-only'` (+ @/lib/mongodb) and would crash under the tsx
// runtime. This worker only needs the events collection name, so inline it.
const SABMAIL_EVENTS_COLLECTION = 'sabmail_events';

/* ── config ──────────────────────────────────────────────────────────────── */

/** How often to scan for unconsumed push markers. */
const POLL_INTERVAL_MS = 15 * 1000;
/** Max markers claimed per poll (bounds a backlog burst). */
const BATCH_SIZE = 50;
/** Per-POST timeout to the internal route (don't hang the loop on a slow box). */
const POST_TIMEOUT_MS = 30 * 1000;
/** The marker event names this worker consumes. */
const MARKER_EVENTS = ['gmail_push', 'graph_push'] as const;

/* ── Mongo (own client; @/lib/mongodb is server-only) ──────────────────────── */

let _client: MongoClient | null = null;

async function getDb(): Promise<Db> {
  if (!_client) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('[sabmail-push-sync] MONGODB_URI is not set');
    _client = new MongoClient(uri);
    await _client.connect();
  }
  return _client.db(process.env.MONGODB_DB || undefined);
}

/* ── internal hydration route (delegate; we hold no server-only code) ───────── */

/**
 * The worker runs under `tsx` and must NOT import the `server-only` provider
 * adapters / message store, so it POSTs each pending marker id to the Next
 * internal route, which runs the actual provider hydration. No app URL
 * configured → hydration is skipped (the on-demand inbox read still works).
 */
function syncEndpoint(): string | null {
  const base = (
    process.env.SABMAIL_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ''
  ).replace(/\/+$/, '');
  return base ? `${base}/api/sabmail/internal/push-sync` : null;
}

/**
 * POST one marker id to the internal route. Returns true only on a 2xx
 * response carrying `{ ok:true }` — anything else (transport error, non-2xx,
 * `{ ok:false }`) returns false so the caller leaves the marker pending.
 */
async function postMarker(url: string, markerId: string): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ markerId }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[sabmail-push-sync] marker ${markerId}: HTTP ${res.status}`);
      return false;
    }
    let payload: { ok?: boolean; hydrated?: number; error?: string } = {};
    try {
      payload = (await res.json()) as typeof payload;
    } catch {
      /* non-JSON 2xx — treat as not-ok so we retry */
    }
    if (payload.ok) {
      console.log(
        `[sabmail-push-sync] marker ${markerId}: hydrated ${payload.hydrated ?? 0}`,
      );
      return true;
    }
    console.warn(
      `[sabmail-push-sync] marker ${markerId}: not ok — ${payload.error ?? 'unknown error'}`,
    );
    return false;
  } catch (err) {
    console.warn(`[sabmail-push-sync] marker ${markerId}: POST failed — ${errMsg(err)}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/* ── small helpers ─────────────────────────────────────────────────────────── */

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Marker doc subset we read (full shape lives in the push routes / internal route). */
interface PendingMarker {
  _id: ObjectId;
  event?: string;
}

/* ── poll loop ─────────────────────────────────────────────────────────────── */

let polling = false;
let stopping = false;
let idleLogged = false;

/**
 * One poll pass: find unconsumed push markers, POST each to the internal route,
 * and on success stamp `consumedAt` (best-effort) so it isn't reprocessed.
 */
async function poll(): Promise<void> {
  if (polling || stopping) return; // never overlap passes
  polling = true;
  try {
    const url = syncEndpoint();
    if (!url) {
      if (!idleLogged) {
        console.warn(
          '[sabmail-push-sync] no SABMAIL_APP_URL / NEXT_PUBLIC_APP_URL / APP_URL set — ' +
            'push hydration disabled (idling)',
        );
        idleLogged = true;
      }
      return;
    }

    const db = await getDb();
    const events = db.collection<PendingMarker>(SABMAIL_EVENTS_COLLECTION);

    const pending = (await events
      .find({ event: { $in: MARKER_EVENTS as unknown as string[] }, consumedAt: { $exists: false } })
      .sort({ ts: 1 })
      .limit(BATCH_SIZE)
      .toArray()) as PendingMarker[];

    if (pending.length === 0) return;

    for (const marker of pending) {
      if (stopping) break;
      const markerId = String(marker._id);
      const ok = await postMarker(url, markerId);
      if (!ok) continue; // leave pending for the next pass

      // Best-effort: stamp consumedAt so this marker isn't reprocessed.
      try {
        await events.updateOne(
          { _id: marker._id },
          { $set: { consumedAt: new Date(), status: 'synced' } },
        );
      } catch (err) {
        console.warn(
          `[sabmail-push-sync] marker ${markerId}: consume stamp failed — ${errMsg(err)}`,
        );
      }
    }
  } catch (err) {
    console.error('[sabmail-push-sync] poll pass failed:', errMsg(err));
  } finally {
    polling = false;
  }
}

/* ── graceful shutdown ─────────────────────────────────────────────────────── */

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`[sabmail-push-sync] ${signal} received, shutting down`);
  try {
    await _client?.close();
  } catch {
    /* best-effort */
  }
  process.exit(0);
}

/* ── entrypoint ────────────────────────────────────────────────────────────── */

export async function main(): Promise<void> {
  console.log('[sabmail-push-sync] starting push-sync worker');

  if (!process.env.MONGODB_URI) {
    console.error('[sabmail-push-sync] MONGODB_URI is not set — cannot run');
    process.exit(1);
    return;
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await poll();
  setInterval(() => void poll(), POLL_INTERVAL_MS);
}

// Run only when executed directly (not when imported, e.g. for tests/tooling).
// Loose `require`/`module` access keeps this compiling under tsc (no @types/node
// `require` typing assumptions) without a top-level await.
const isDirect = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = (globalThis as any).require;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = (globalThis as any).module;
    return !!req && !!mod && req.main === mod;
  } catch {
    return false;
  }
})();

if (isDirect) {
  main().catch((err) => {
    console.error('[sabmail-push-sync] fatal:', err);
    process.exit(1);
  });
}
