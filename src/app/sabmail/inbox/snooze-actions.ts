'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — Snooze (hide a message from the inbox until a resurface time).
 *
 * The SabMail inbox reads live IMAP, so there's no per-message DB row to
 * mutate. We model a snooze as its own record in `SABMAIL_COLLECTIONS.snoozes`
 * keyed on {workspaceId, accountId, folder, uid}, with a `snoozedUntil`
 * timestamp. The inbox list action filters out any uid that has an ACTIVE
 * snooze (snoozedUntil > now) for the account+folder being viewed.
 *
 * A cron route (`/api/cron/sabmail-snooze`) sweeps expired snoozes across
 * ALL workspaces and deletes them — the message naturally reappears in the
 * inbox on the next list (nothing about the real mailbox ever changed).
 *
 * Every action is tenant-scoped by the active SabMail `workspaceId`.
 * ──────────────────────────────────────────────────────────────────── */

/** The stored shape of a snooze (one Mongo doc). */
export interface SabmailSnoozeDoc {
  workspaceId: string;
  accountId: string;
  folder: string;
  uid: number;
  messageId?: string;
  subject?: string;
  snoozedUntil: Date;
  createdAt: Date;
}

/** Safe (serialisable) projection sent to the client. */
export interface SabmailSnoozeRow {
  id: string;
  accountId: string;
  folder: string;
  uid: number;
  messageId: string | null;
  subject: string | null;
  snoozedUntil: string;
  createdAt: string;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

export interface SnoozeSabmailMessageInput {
  accountId: string;
  folder: string;
  uid: number;
  /** ISO-8601 timestamp for when the message should resurface in the inbox. */
  untilISO: string;
  subject?: string;
  /** Optional RFC Message-ID — carried for cross-folder identity / display. */
  messageId?: string;
}

function toRow(doc: WithId<SabmailSnoozeDoc>): SabmailSnoozeRow {
  return {
    id: String(doc._id),
    accountId: doc.accountId,
    folder: doc.folder,
    uid: doc.uid,
    messageId: doc.messageId ?? null,
    subject: doc.subject ?? null,
    snoozedUntil:
      doc.snoozedUntil instanceof Date
        ? doc.snoozedUntil.toISOString()
        : new Date(doc.snoozedUntil).toISOString(),
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : new Date(doc.createdAt).toISOString(),
  };
}

/* ── actions ─────────────────────────────────────────────────────────── */

/**
 * Snooze a message until `untilISO`. Upserts on
 * {workspaceId, accountId, folder, uid} so re-snoozing the same message just
 * moves its resurface time (no duplicate records).
 */
export async function snoozeSabmailMessage(
  input: SnoozeSabmailMessageInput,
): Promise<Result<{ id: string }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    const accountId = input.accountId?.trim();
    if (!accountId || !ObjectId.isValid(accountId)) {
      return { ok: false, error: 'Invalid account id.' };
    }

    const folder = input.folder?.trim();
    if (!folder) return { ok: false, error: 'Pick a folder.' };

    const uid = Number(input.uid);
    if (!Number.isFinite(uid) || uid <= 0) {
      return { ok: false, error: 'Invalid message id.' };
    }

    const snoozedUntil = new Date(input.untilISO);
    if (Number.isNaN(snoozedUntil.getTime())) {
      return { ok: false, error: 'Pick a valid resurface time.' };
    }

    const now = new Date();
    const subject = input.subject?.trim();
    const messageId = input.messageId?.trim();

    const setOnInsert: Partial<SabmailSnoozeDoc> = { createdAt: now };
    const set: Partial<SabmailSnoozeDoc> = { snoozedUntil };
    if (subject) set.subject = subject;
    if (messageId) set.messageId = messageId;

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailSnoozeDoc>(SABMAIL_COLLECTIONS.snoozes)
      .findOneAndUpdate(
        { workspaceId, accountId, folder, uid },
        { $set: set, $setOnInsert: setOnInsert },
        { upsert: true, returnDocument: 'after' },
      );

    const id = res?._id ? String(res._id) : '';
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/**
 * Un-snooze a message (delete the record so it reappears in the inbox). Accepts
 * either the snooze record `id` (string) or the natural key
 * {accountId, folder, uid}.
 */
export async function unsnoozeSabmailMessage(
  selector: string | { accountId: string; folder: string; uid: number },
): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<SabmailSnoozeDoc>(SABMAIL_COLLECTIONS.snoozes);

    if (typeof selector === 'string') {
      if (!selector || !ObjectId.isValid(selector)) {
        return { ok: false, error: 'Invalid snooze id.' };
      }
      const res = await col.deleteOne({
        _id: new ObjectId(selector),
        workspaceId,
      } as never);
      if (res.deletedCount === 0) {
        return { ok: false, error: 'This message is no longer snoozed.' };
      }
      return { ok: true };
    }

    const accountId = selector.accountId?.trim();
    const folder = selector.folder?.trim();
    const uid = Number(selector.uid);
    if (!accountId || !ObjectId.isValid(accountId)) {
      return { ok: false, error: 'Invalid account id.' };
    }
    if (!folder) return { ok: false, error: 'Pick a folder.' };
    if (!Number.isFinite(uid) || uid <= 0) {
      return { ok: false, error: 'Invalid message id.' };
    }

    const res = await col.deleteOne({ workspaceId, accountId, folder, uid });
    if (res.deletedCount === 0) {
      return { ok: false, error: 'This message is no longer snoozed.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/**
 * List ACTIVE snoozes (snoozedUntil > now) for the active workspace — newest
 * resurface time first — as serialisable rows for the UI.
 */
export async function listSabmailSnoozed(): Promise<SabmailSnoozeRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];

    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailSnoozeDoc>(SABMAIL_COLLECTIONS.snoozes)
      .find({ workspaceId, snoozedUntil: { $gt: new Date() } })
      .sort({ snoozedUntil: -1 })
      .limit(200)
      .toArray();

    return docs.map((d) => toRow(d as WithId<SabmailSnoozeDoc>));
  } catch (err) {
    console.error('[sabmail] listSabmailSnoozed failed:', err);
    return [];
  }
}

/**
 * Helper for the inbox list action: the uids that are CURRENTLY snoozed
 * (snoozedUntil > now) for an EXPLICIT workspace + account + folder. The list
 * action subtracts these from the IMAP page so snoozed messages stay hidden
 * until they resurface.
 *
 * Exported as an async server action (a 'use server' file may only export async
 * functions) so `inbox/actions.ts` — another module — can call it directly.
 * Best-effort: returns `[]` on any error so snooze never breaks inbox loading.
 */
export async function getActiveSnoozedUids(
  workspaceId: string,
  accountId: string,
  folder: string,
): Promise<number[]> {
  if (!workspaceId || !accountId || !folder) return [];
  try {
    const { db } = await connectToDatabase();
    const docs = (await db
      .collection<SabmailSnoozeDoc>(SABMAIL_COLLECTIONS.snoozes)
      .find(
        { workspaceId, accountId, folder, snoozedUntil: { $gt: new Date() } },
        { projection: { uid: 1 } },
      )
      .toArray()) as Array<{ uid?: number }>;
    return docs
      .map((d) => Number(d.uid))
      .filter((n) => Number.isFinite(n));
  } catch (err) {
    console.error('[sabmail] getActiveSnoozedUids failed:', err);
    return [];
  }
}
