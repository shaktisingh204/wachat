import 'server-only';

import type { Db } from 'mongodb';

import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail unified message store — the FOUNDATION (Phase B).
 *
 * The transport-agnostic persisted shape every provider adapter (IMAP today,
 * Gmail / Microsoft Graph next) converges on. The IMAP sync worker today
 * caches a thinner `CachedMessageDoc` keyed by `{workspaceId, accountId, path,
 * uid}` for fast list rendering; this richer doc is the convergence target the
 * worker's TODO("real sync engine") points to — keyed by a STABLE,
 * transport-portable `providerMessageId` instead of an IMAP-only UID.
 *
 * Both shapes live in `SABMAIL_COLLECTIONS.messages` (`sabmail_messages`).
 * Their stable keys differ (the worker uses the IMAP path+uid tuple; this store
 * uses provider+providerMessageId), so the upserts here never collide with the
 * worker's envelope upserts. The full sync engine is expected to migrate onto
 * THIS key as it lands.
 *
 * Pure helpers: the caller supplies the `Db` (the worker owns its own client;
 * `@/lib/mongodb` is `server-only` and crashes under the tsx runtime). No
 * global state, no logging of message bodies.
 * ──────────────────────────────────────────────────────────────────── */

/**
 * A fully-persisted message document — the unified, transport-agnostic shape
 * shared across IMAP / Gmail / Graph adapters.
 *
 * `providerMessageId` is the adapter's STABLE message identifier:
 *   - IMAP  → the UID rendered as a string (paired with `folder`)
 *   - Gmail → the Gmail message id
 *   - Graph → the Microsoft Graph message id
 * `messageId` is the RFC 5322 `Message-ID` header (for cross-transport thread
 * stitching), which may be `null` when the header is absent.
 */
export interface PersistedMessageDoc {
  /** The `kind:'mail'` project `_id` string (tenant scope). */
  workspaceId: string;
  /** The mailbox account `_id` as a string. */
  accountId: string;
  /** Transport family that produced this doc. */
  provider: 'imap' | 'gmail' | 'graph';
  /** Folder/label path the message lives in (IMAP path or Gmail/Graph label id). */
  folder: string;
  /** Stable provider message id (IMAP UID string / Gmail id / Graph id). */
  providerMessageId: string;
  /** RFC `Message-ID` header for thread stitching; null when absent. */
  messageId: string | null;
  /** Stitched conversation/thread id; null until threading resolves it. */
  threadId: string | null;
  subject: string;
  fromName: string;
  fromEmail: string;
  /** Recipient addresses (display string or bare address per the parser). */
  to: string[];
  /** Sent/received date; null when unparseable. */
  date: Date | null;
  /** Short preview text for list rendering. */
  snippet: string;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  /** Sanitized HTML body (optional — set when the full body has been fetched). */
  html?: string | null;
  /** Plain-text body (optional — set when the full body has been fetched). */
  text?: string | null;
  /** Attachment metadata (no content bytes stored here). */
  attachments?: Array<{ filename: string; contentType: string; size: number }>;
  /** When this doc was last synced/upserted. */
  syncedAt: Date;
}

/** The stable upsert key for a persisted message (transport-portable). */
type PersistedMessageKey = Pick<
  PersistedMessageDoc,
  'workspaceId' | 'accountId' | 'provider' | 'providerMessageId'
>;

/**
 * Upsert a persisted message by its stable
 * `{ workspaceId, accountId, provider, providerMessageId }` key. `$set`s the
 * full doc (so a later, richer fetch — e.g. body/attachments — overlays an
 * earlier envelope-only upsert). Idempotent and safe to call repeatedly.
 *
 * The caller supplies the `Db` (see the file header — the worker owns its own
 * Mongo client).
 */
export async function upsertPersistedMessage(
  db: Db,
  doc: PersistedMessageDoc,
): Promise<void> {
  if (!db) throw new Error('upsertPersistedMessage: db is required.');
  if (!doc?.workspaceId || !doc?.accountId || !doc?.providerMessageId) {
    throw new Error(
      'upsertPersistedMessage: workspaceId, accountId and providerMessageId are required.',
    );
  }
  const key: PersistedMessageKey = {
    workspaceId: doc.workspaceId,
    accountId: doc.accountId,
    provider: doc.provider,
    providerMessageId: doc.providerMessageId,
  };
  await db
    .collection<PersistedMessageDoc>(SABMAIL_COLLECTIONS.messages)
    .updateOne(key, { $set: doc }, { upsert: true });
}

/**
 * Best-effort: ensure the indexes the persisted message store relies on.
 *   - UNIQUE { workspaceId, accountId, provider, providerMessageId } — backs
 *     the idempotent upsert key and guards against duplicates.
 *   - { workspaceId, accountId, folder, date: -1 } — backs the newest-first
 *     per-folder list query.
 *
 * Never throws (index creation can race or be denied under reduced perms);
 * failures are swallowed so a sync pass is not blocked by index maintenance.
 */
export async function ensureMessageStoreIndexes(db: Db): Promise<void> {
  if (!db) return;
  const col = db.collection<PersistedMessageDoc>(SABMAIL_COLLECTIONS.messages);
  try {
    await col.createIndex(
      { workspaceId: 1, accountId: 1, provider: 1, providerMessageId: 1 },
      { unique: true, name: 'sabmail_msg_provider_id_uq' },
    );
  } catch {
    /* best-effort — a concurrent create or a pre-existing equivalent index */
  }
  try {
    await col.createIndex(
      { workspaceId: 1, accountId: 1, folder: 1, date: -1 },
      { name: 'sabmail_msg_folder_date' },
    );
  } catch {
    /* best-effort — non-essential read-path index */
  }
}
