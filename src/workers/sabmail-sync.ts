/**
 * SabMail real-time IMAP sync worker.
 *
 * Run via PM2: pm2 start ... ; not a Next route.
 *   e.g. pm2 start npx --name sabmail-sync -- tsx src/workers/sabmail-sync.ts
 *   (or compile + `pm2 start dist/workers/sabmail-sync.js --name sabmail-sync`)
 *
 * A standalone, long-lived Node process — NOT a serverless function and NOT a
 * Next.js route. Serverless functions cannot hold an IDLE socket open; this
 * needs a persistent process (PM2 / a dedicated worker).
 *
 * What it does
 * ────────────
 * For every active `sabmail_accounts` doc with `provider:'imap'` (across ALL
 * workspaces — there is no session/cookie here), it opens one `imapflow`
 * client on INBOX and runs an IDLE loop. On a new-mail `exists` event it
 * fetches the new envelopes by UID, upserts them into the
 * `sabmail_messages` cache, and publishes a lightweight notification to the
 * per-workspace Redis channel `sabmail:${workspaceId}` so connected clients
 * refresh in real time.
 *
 * Resilience (the killer gotchas — see the R&D note):
 *   - imapflow does NOT auto-reconnect; we own the connect loop and rebuild a
 *     FRESH ImapFlow instance every time (never reuse a dead client).
 *   - IDLE can die silently (no `error`/`close`); we attach both handlers and
 *     let `maxIdleTime` re-issue IDLE well under the RFC-2177 29-minute cap.
 *   - `exists` carries counts only — we track `uidNext` and fetch the gap.
 *   - `uidValidity` change ⇒ stored UIDs are invalid ⇒ full resync of folder.
 *
 * This file is a `.ts` under `src/` and MUST compile under `tsc`:
 *   - imapflow is typed loosely (`as any`) — no strict d.ts is bundled.
 *   - it owns its own Mongo client (does NOT import `@/lib/mongodb`, which is
 *     `server-only` and crashes under the tsx runtime).
 *   - no top-level await; everything boots from `main()`.
 *
 * Env: MONGODB_URI, MONGODB_DB, REDIS_URL (or REDIS_HOST/REDIS_PORT/
 *      REDIS_PASSWORD), SABMAIL_CREDS_KEY (or SABSMS_CREDS_KEY).
 */

import 'dotenv/config';
import { MongoClient, type Db, type Collection } from 'mongodb';
import IORedis, { type Redis } from 'ioredis';

import { decryptMailboxCreds } from '@/lib/sabmail/credentials';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';

/* ── config ──────────────────────────────────────────────────────────────── */

/** Re-issue IDLE well under the RFC-2177 29-minute cap. */
const MAX_IDLE_MS = 5 * 60 * 1000;
/** How often to rescan the accounts collection for added/removed mailboxes. */
const RESCAN_INTERVAL_MS = 60 * 1000;
/** Reconnect backoff bounds (per account). */
const BACKOFF_MIN_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;

/* ── lightweight local shapes (kept loose; this worker owns its own types) ── */

interface ImapEndpoint {
  host: string;
  port: number;
  secure: boolean;
}

interface ImapAccountDoc {
  _id: unknown;
  workspaceId: string;
  provider: string;
  email: string;
  status: string;
  imap?: ImapEndpoint;
  credentialsCipher?: string;
}

/** Cached message doc (subset — enough for list rendering; full body fetched on demand). */
interface CachedMessageDoc {
  workspaceId: string;
  accountId: string;
  path: string;
  uid: number;
  uidValidity: number | null;
  messageId: string | null;
  subject: string;
  fromName: string;
  fromEmail: string;
  date: Date | null;
  seen: boolean;
  flagged: boolean;
  syncedAt: Date;
}

/* ── Mongo (own client; @/lib/mongodb is server-only) ──────────────────────── */

let _client: MongoClient | null = null;

async function getDb(): Promise<Db> {
  if (!_client) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('[sabmail-sync] MONGODB_URI is not set');
    _client = new MongoClient(uri);
    await _client.connect();
  }
  return _client.db(process.env.MONGODB_DB || undefined);
}

/* ── Redis publisher (best-effort; degrade silently when unset) ────────────── */

let _pub: Redis | null = null;
let _pubTried = false;

function getPublisher(): Redis | null {
  if (_pubTried) return _pub;
  _pubTried = true;
  try {
    const url = process.env.REDIS_URL;
    if (url) {
      _pub = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
    } else if (process.env.REDIS_HOST) {
      _pub = new IORedis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT || 6379),
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    } else {
      console.warn('[sabmail-sync] no REDIS_URL / REDIS_HOST set — real-time publish disabled');
      return null;
    }
    _pub.on('error', (err) => {
      console.warn('[sabmail-sync] redis publisher error:', err.message);
    });
  } catch (err) {
    console.warn('[sabmail-sync] redis publisher init failed:', errMsg(err));
    _pub = null;
  }
  return _pub;
}

async function publishNewMail(
  workspaceId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const pub = getPublisher();
  if (!pub) return;
  try {
    await pub.publish(`sabmail:${workspaceId}`, JSON.stringify({ type: 'new_mail', ...payload }));
  } catch (err) {
    console.warn('[sabmail-sync] publish failed:', errMsg(err));
  }
}

/* ── inbound binding (delegate to the Next internal route) ─────────────────── */

/**
 * This worker runs under `tsx` and must NOT import the `server-only` binder, so
 * it POSTs newly-seen mail to the Next internal route, which runs the shared
 * `bindInboundMessage` (conversation + screener + rules + `inbound_email`
 * journey trigger). No app URL configured → binding is skipped (the on-demand
 * inbox read still shows the mail).
 */
function bindEndpoint(): string | null {
  const base = (
    process.env.SABMAIL_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ''
  ).replace(/\/+$/, '');
  return base ? `${base}/api/sabmail/internal/bind-inbound` : null;
}

async function bindInbound(payload: {
  workspaceId: string;
  from: string;
  fromName?: string;
  subject?: string;
  messageId?: string;
  /** IMAP coordinates so the binder can apply matched-rule / screener-deny. */
  accountId?: string;
  folder?: string;
  uid?: number;
}): Promise<void> {
  const url = bindEndpoint();
  if (!url || !payload.from) return;
  try {
    const secret = process.env.CRON_SECRET;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[sabmail-sync] inbound bind failed:', errMsg(err));
  }
}

/* ── small helpers ─────────────────────────────────────────────────────────── */

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter, clamped to [MIN, MAX]. */
function backoffFor(attempt: number): number {
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * (base / 2));
  return base + jitter;
}

function firstEnvelopeAddr(field: unknown): { name: string; email: string } {
  const arr = Array.isArray(field) ? field : [];
  const first = arr[0] as { name?: string; address?: string } | undefined;
  return { name: first?.name ?? '', email: (first?.address ?? '').toLowerCase() };
}

/* ── per-account runner ────────────────────────────────────────────────────── */

interface RunningAccount {
  stop(): void;
}

/**
 * Drive one IMAP mailbox: connect → open INBOX → IDLE → fetch new on `exists`.
 * Owns its reconnect loop. Rebuilds a fresh client every iteration.
 */
function runMailbox(account: ImapAccountDoc): RunningAccount {
  let stopped = false;
  let attempt = 0;
  // imapflow client is held loosely so we can close it from stop().
  let client: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

  let savedUidNext = 1;
  let savedUidValidity: number | null = null;

  const workspaceId = account.workspaceId;
  const accountId = String(account._id);
  const imap = account.imap;

  const connectLoop = async (): Promise<void> => {
    // imapflow is dynamically imported + typed loosely (no bundled strict d.ts).
    const mod = (await import('imapflow')) as unknown as {
      ImapFlow: new (opts: unknown) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
    };

    while (!stopped) {
      if (!imap?.host) {
        console.warn(`[sabmail-sync] ${account.email}: no IMAP endpoint — skipping`);
        return;
      }

      let creds: { user: string; pass: string } | null = null;
      try {
        const decoded = decryptMailboxCreds(workspaceId, account.credentialsCipher ?? '');
        const user = String(decoded.imapUser ?? '');
        const pass = String(decoded.imapPass ?? '');
        if (user && pass) creds = { user, pass };
      } catch (err) {
        console.warn(`[sabmail-sync] ${account.email}: cannot read creds — ${errMsg(err)}`);
      }
      if (!creds) {
        // Nothing we can do without creds; back off and retry (they may be re-keyed).
        await sleep(backoffFor(++attempt));
        continue;
      }

      client = new mod.ImapFlow({
        host: imap.host,
        port: imap.port || 993,
        secure: imap.secure !== false,
        auth: { user: creds.user, pass: creds.pass },
        logger: false,
        // imapflow re-issues IDLE internally under this cap; keep well below 29 min.
        maxIdleTime: MAX_IDLE_MS,
      });

      // CRITICAL: long-lived clients MUST handle these or the process can hang/crash.
      client.on('error', (err: unknown) => {
        console.warn(`[sabmail-sync] ${account.email}: client error — ${errMsg(err)}`);
        try {
          client?.close();
        } catch {
          /* already closed */
        }
      });
      client.on('close', () => {
        // The connect loop's keep-alive promise resolves on close → reconnect.
      });

      // New-mail handler. `exists` carries counts only — fetch the UID gap.
      client.on('exists', async () => {
        try {
          await fetchNew();
        } catch (err) {
          console.warn(`[sabmail-sync] ${account.email}: fetch-new failed — ${errMsg(err)}`);
          // Let the reconnect path recover if the connection actually died.
        }
      });

      // Flag changes (read/star) — best-effort cache update.
      client.on('flags', (d: { uid?: number; flags?: Set<string> }) => {
        if (typeof d?.uid !== 'number' || !d.flags) return;
        void updateFlags(d.uid, d.flags);
      });

      try {
        await client.connect();
        const box = await client.mailboxOpen('INBOX', { readOnly: true });

        // uidValidity guard: stored UIDs are only valid while uidValidity is stable.
        const boxUidValidity = Number(box?.uidValidity ?? 0) || null;
        if (savedUidValidity && boxUidValidity && boxUidValidity !== savedUidValidity) {
          savedUidNext = 1; // full resync of this folder
        }
        savedUidValidity = boxUidValidity;

        // Catch mail that arrived while we were offline: fetch from where we left
        // off up to the server's current uidNext, then advance the cursor.
        const boxUidNext = Number(box?.uidNext ?? 1) || 1;
        await fetchNew(boxUidNext);
        savedUidNext = Math.max(savedUidNext, boxUidNext);

        attempt = 0; // healthy connection — reset backoff
        console.log(`[sabmail-sync] ${account.email}: IDLE on INBOX (uidNext=${savedUidNext})`);

        // imapflow auto-IDLEs after connect+open; keep alive until close/error.
        await new Promise<void>((resolve) => {
          client.once('close', resolve);
          client.once('error', resolve);
        });
      } catch (err) {
        console.warn(`[sabmail-sync] ${account.email}: connect/open failed — ${errMsg(err)}`);
      }

      // Always rebuild a fresh client next iteration (never reuse a dead one).
      try {
        client?.removeAllListeners();
        client?.close();
      } catch {
        /* already closed */
      }
      client = null;
      if (stopped) break;
      await sleep(backoffFor(++attempt));
    }
  };

  /**
   * Fetch new messages by UID (`savedUidNext:*`) and upsert into the cache.
   * `boxUidNext`, when given, is the server's current uidNext for a clean
   * upper bound (used right after open).
   */
  const fetchNew = async (boxUidNext?: number): Promise<void> => {
    if (!client) return;
    const db = await getDb();
    const messages = db.collection<CachedMessageDoc>(SABMAIL_COLLECTIONS.messages);

    const lock = await client.getMailboxLock('INBOX');
    let highestUid = savedUidNext;
    let inserted = 0;
    const arrived: Array<{ from: string; fromName: string; subject: string; messageId: string; uid: number }> = [];
    try {
      // Range is UID-based: from our cursor to the end of the mailbox.
      for await (const msg of client.fetch(
        `${savedUidNext}:*`,
        { uid: true, envelope: true, flags: true },
        { uid: true },
      )) {
        const uid: number = Number(msg.uid);
        if (!Number.isFinite(uid) || uid < savedUidNext) continue;

        const env = msg.envelope ?? {};
        const from = firstEnvelopeAddr(env.from);
        const flags: Set<string> | undefined = msg.flags;

        const doc: CachedMessageDoc = {
          workspaceId,
          accountId,
          path: 'INBOX',
          uid,
          uidValidity: savedUidValidity,
          messageId: env.messageId ?? null,
          subject: env.subject || '(no subject)',
          fromName: from.name,
          fromEmail: from.email,
          date: env.date ? new Date(env.date) : null,
          seen: !!flags?.has?.('\\Seen'),
          flagged: !!flags?.has?.('\\Flagged'),
          syncedAt: new Date(),
        };

        await upsertMessage(messages, doc);
        inserted += 1;
        if (from.email) {
          arrived.push({
            from: from.email,
            fromName: from.name,
            subject: doc.subject,
            messageId: doc.messageId ?? '',
            uid,
          });
        }
        if (uid + 1 > highestUid) highestUid = uid + 1;
      }
    } finally {
      lock.release();
    }

    // Bind each newly-arrived message (conversation + screener + rules +
    // journey trigger) via the Next internal route — fire-and-forget.
    for (const a of arrived) {
      void bindInbound({
        workspaceId,
        from: a.from,
        fromName: a.fromName,
        subject: a.subject,
        messageId: a.messageId,
        accountId,
        folder: 'INBOX',
        uid: a.uid,
      });
    }

    // Advance the cursor past the newest UID we saw (and never below the box's).
    savedUidNext = Math.max(savedUidNext, highestUid, boxUidNext ?? 0);

    if (inserted > 0) {
      await publishNewMail(workspaceId, {
        accountId,
        email: account.email,
        path: 'INBOX',
        count: inserted,
        ts: Date.now(),
      });

      // TODO(real sync engine): this worker only caches ENVELOPES for fast list
      // rendering + the realtime ping. The full message store (body/html/text,
      // attachments, thread stitching via References, label/flag reconciliation,
      // expunge handling) plugs in here — hand each new UID to the shared
      // sync engine (the same one the Gmail historyId / Graph delta workers
      // drive) so all three transports converge on one message store.
    }
  };

  const updateFlags = async (uid: number, flags: Set<string>): Promise<void> => {
    try {
      const db = await getDb();
      const messages = db.collection<CachedMessageDoc>(SABMAIL_COLLECTIONS.messages);
      await messages.updateOne(
        { workspaceId, accountId, path: 'INBOX', uid },
        {
          $set: {
            seen: !!flags.has('\\Seen'),
            flagged: !!flags.has('\\Flagged'),
            syncedAt: new Date(),
          },
        },
      );
    } catch (err) {
      console.warn(`[sabmail-sync] ${account.email}: flag update failed — ${errMsg(err)}`);
    }
  };

  // Kick off the loop (fire-and-forget; errors are handled inside).
  void connectLoop();

  return {
    stop() {
      stopped = true;
      try {
        client?.close();
      } catch {
        /* already closed */
      }
    },
  };
}

/** Upsert a cached envelope by its stable (workspace, account, path, uid) key. */
async function upsertMessage(
  col: Collection<CachedMessageDoc>,
  doc: CachedMessageDoc,
): Promise<void> {
  await col.updateOne(
    { workspaceId: doc.workspaceId, accountId: doc.accountId, path: doc.path, uid: doc.uid },
    { $set: doc },
    { upsert: true },
  );
}

/* ── supervisor: track running mailboxes, rescan the accounts collection ────── */

const running = new Map<string, RunningAccount>();
let stopping = false;

async function rescan(): Promise<void> {
  if (stopping) return;
  let active: ImapAccountDoc[] = [];
  try {
    const db = await getDb();
    const accounts = db.collection<ImapAccountDoc>(SABMAIL_COLLECTIONS.accounts);
    active = (await accounts
      .find({ provider: 'imap', status: 'active' })
      .toArray()) as ImapAccountDoc[];
  } catch (err) {
    console.error('[sabmail-sync] rescan query failed:', errMsg(err));
    return;
  }

  const activeIds = new Set(active.map((a) => String(a._id)));

  // Start newly-active mailboxes.
  for (const account of active) {
    const id = String(account._id);
    if (running.has(id)) continue;
    if (!account.imap?.host || !account.credentialsCipher) continue;
    console.log(`[sabmail-sync] starting mailbox ${account.email} (${id})`);
    running.set(id, runMailbox(account));
  }

  // Stop mailboxes that disappeared / went inactive.
  for (const [id, handle] of running) {
    if (!activeIds.has(id)) {
      console.log(`[sabmail-sync] stopping mailbox ${id} (no longer active)`);
      handle.stop();
      running.delete(id);
    }
  }
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`[sabmail-sync] ${signal} received, shutting down (${running.size} mailboxes)`);
  for (const handle of running.values()) {
    try {
      handle.stop();
    } catch {
      /* best-effort */
    }
  }
  running.clear();
  try {
    await _pub?.quit();
  } catch {
    /* best-effort */
  }
  try {
    await _client?.close();
  } catch {
    /* best-effort */
  }
  process.exit(0);
}

/* ── entrypoint ────────────────────────────────────────────────────────────── */

export async function main(): Promise<void> {
  console.log('[sabmail-sync] starting IMAP IDLE sync worker');

  if (!process.env.MONGODB_URI) {
    console.error('[sabmail-sync] MONGODB_URI is not set — cannot run');
    process.exit(1);
    return;
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await rescan();
  setInterval(() => void rescan(), RESCAN_INTERVAL_MS);
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
    console.error('[sabmail-sync] fatal:', err);
    process.exit(1);
  });
}
