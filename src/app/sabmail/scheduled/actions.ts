'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — Send-later (scheduled sends).
 *
 * Store a future send as a `pending` doc in `SABMAIL_COLLECTIONS.scheduled`;
 * a cron route (`/api/cron/sabmail-scheduled`) sweeps due items across all
 * workspaces and drives them through the existing send action.
 *
 * Every action is tenant-scoped by the active SabMail `workspaceId`. The
 * collection is the SabMail roadmap's reserved `scheduled` name — no schema
 * change to the shared collections module.
 * ──────────────────────────────────────────────────────────────────── */

export type SabmailScheduledStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

/** The stored shape of a scheduled send (one Mongo doc). */
export interface SabmailScheduledDoc {
  workspaceId: string;
  kind: 'send';
  accountId: string;
  payload: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html?: string;
  };
  sendAt: Date;
  status: SabmailScheduledStatus;
  createdAt: Date;
  sentAt?: Date;
  error?: string;
}

/** Safe (serialisable) projection sent to the client. */
export interface SabmailScheduledRow {
  id: string;
  accountId: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  hasBody: boolean;
  sendAt: string;
  status: SabmailScheduledStatus;
  createdAt: string;
  sentAt: string | null;
  error: string | null;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

export interface ScheduleSabmailSendInput {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  /** ISO-8601 timestamp for when the message should be sent. */
  sendAtISO: string;
}

function cleanList(value: string[] | undefined): string[] {
  return (value ?? []).map((s) => s.trim()).filter(Boolean);
}

function toRow(doc: WithId<SabmailScheduledDoc>): SabmailScheduledRow {
  return {
    id: String(doc._id),
    accountId: doc.accountId,
    to: Array.isArray(doc.payload?.to) ? doc.payload.to : [],
    cc: Array.isArray(doc.payload?.cc) ? doc.payload.cc : [],
    bcc: Array.isArray(doc.payload?.bcc) ? doc.payload.bcc : [],
    subject: doc.payload?.subject || '(no subject)',
    hasBody: !!doc.payload?.html?.trim(),
    sendAt: doc.sendAt instanceof Date ? doc.sendAt.toISOString() : new Date(doc.sendAt).toISOString(),
    status: doc.status,
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString(),
    sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
    error: doc.error ?? null,
  };
}

/* ── actions ─────────────────────────────────────────────────────────── */

/** Queue a future send for the active workspace (stored `pending`). */
export async function scheduleSabmailSend(
  input: ScheduleSabmailSendInput,
): Promise<Result<{ id: string }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    const accountId = input.accountId?.trim();
    if (!accountId || !ObjectId.isValid(accountId)) {
      return { ok: false, error: 'Pick a mailbox to send from.' };
    }

    const to = cleanList(input.to);
    if (to.length === 0) return { ok: false, error: 'Add at least one recipient.' };

    const sendAt = new Date(input.sendAtISO);
    if (Number.isNaN(sendAt.getTime())) {
      return { ok: false, error: 'Pick a valid send time.' };
    }

    const subject = input.subject?.trim() || '(no subject)';
    const html = input.html?.trim() ? input.html : undefined;

    const payload: SabmailScheduledDoc['payload'] = { to, subject };
    const cc = cleanList(input.cc);
    if (cc.length) payload.cc = cc;
    const bcc = cleanList(input.bcc);
    if (bcc.length) payload.bcc = bcc;
    if (html) payload.html = html;

    const now = new Date();
    const doc: SabmailScheduledDoc = {
      workspaceId,
      kind: 'send',
      accountId,
      payload,
      sendAt,
      status: 'pending',
      createdAt: now,
    };

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailScheduledDoc>(SABMAIL_COLLECTIONS.scheduled)
      .insertOne(doc as never);

    return { ok: true, id: String(res.insertedId) };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** List scheduled sends for the active workspace (newest send-time first). */
export async function listSabmailScheduled(): Promise<SabmailScheduledRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];

    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailScheduledDoc>(SABMAIL_COLLECTIONS.scheduled)
      .find({ workspaceId })
      .sort({ sendAt: -1 })
      .limit(200)
      .toArray();

    return docs.map((d) => toRow(d as WithId<SabmailScheduledDoc>));
  } catch (err) {
    console.error('[sabmail] listSabmailScheduled failed:', err);
    return [];
  }
}

/** Cancel a pending scheduled send (no-op if it already ran). */
export async function cancelSabmailScheduled(id: string): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    if (!id || !ObjectId.isValid(id)) {
      return { ok: false, error: 'Invalid scheduled send id.' };
    }

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailScheduledDoc>(SABMAIL_COLLECTIONS.scheduled)
      .updateOne(
        { _id: new ObjectId(id), workspaceId, status: 'pending' },
        { $set: { status: 'cancelled' } },
      );

    if (res.matchedCount === 0) {
      return { ok: false, error: 'This send is no longer pending.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
