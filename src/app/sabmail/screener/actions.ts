'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail Screener — a HEY-style consent gate for first-time senders.
 *
 * The first time a brand-new sender reaches the workspace, they land in the
 * Screener as `pending`. A human decides once — `approved` lets their mail
 * through; `denied` keeps it out. The decision is durable per
 * {workspaceId, email} so it never has to be made twice.
 *
 * Stored in `SABMAIL_COLLECTIONS.screener`, scoped by `workspaceId` (the
 * `kind:'mail'` project `_id` string). Identity is the {workspaceId, email}
 * pair: every write upserts on that pair, so re-adds are idempotent without
 * requiring a unique index to exist up front.
 *
 * Decisions are recorded today and gate live inbound mail later, once the
 * sync engine binds to a connected mailbox.
 * ──────────────────────────────────────────────────────────────────── */

export type SabmailScreenerDecision = 'pending' | 'approved' | 'denied';

/** The stored shape of a screener sender (one Mongo doc). */
export interface SabmailScreenerDoc {
  workspaceId: string;
  email: string;
  name?: string;
  decision: SabmailScreenerDecision;
  firstSeenAt: Date;
  decidedAt?: Date;
}

/** Safe, serializable projection sent to the client. */
export interface SabmailScreenerRow {
  id: string;
  email: string;
  name: string | null;
  decision: SabmailScreenerDecision;
  firstSeenAt: string;
  decidedAt: string | null;
  /** True for senders surfaced from inbound events (not yet a stored doc). */
  suggested?: boolean;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DECISIONS: SabmailScreenerDecision[] = ['pending', 'approved', 'denied'];

function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return null;
  return email;
}

function toRow(doc: WithId<SabmailScreenerDoc>): SabmailScreenerRow {
  return {
    id: String(doc._id),
    email: doc.email,
    name: doc.name?.trim() ? doc.name.trim() : null,
    decision: DECISIONS.includes(doc.decision) ? doc.decision : 'pending',
    firstSeenAt: doc.firstSeenAt
      ? new Date(doc.firstSeenAt).toISOString()
      : new Date(0).toISOString(),
    decidedAt: doc.decidedAt ? new Date(doc.decidedAt).toISOString() : null,
  };
}

/* ──────────────────────────────────────────────────────────────────────
 * Inbound discovery (best-effort, optional).
 *
 * On a `pending` read, surface distinct senders from recent inbound events
 * that haven't been decided yet. These are upserted as real `pending`
 * screener docs so they persist and can be approved/denied like any other.
 * Failures here never break the list — the screener still shows stored docs.
 * ──────────────────────────────────────────────────────────────────── */

interface SabmailInboundEventShape {
  from?: unknown;
  ts?: unknown;
}

/**
 * Pull distinct, undecided inbound senders for `workspaceId` and upsert each
 * as a `pending` screener doc. Best-effort: any error is swallowed.
 */
async function surfaceInboundSenders(workspaceId: string): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    const events = (await db
      .collection(SABMAIL_COLLECTIONS.events)
      .find({ workspaceId, event: 'inbound' })
      .sort({ ts: -1 })
      .limit(500)
      .toArray()) as unknown as SabmailInboundEventShape[];

    if (!events.length) return;

    // Distinct, valid sender emails (newest-first order preserved).
    const seen = new Set<string>();
    const emails: string[] = [];
    for (const ev of events) {
      const email = normalizeEmail(ev.from);
      if (!email || seen.has(email)) continue;
      seen.add(email);
      emails.push(email);
    }
    if (!emails.length) return;

    const col = db.collection(SABMAIL_COLLECTIONS.screener);

    // Only upsert senders we haven't recorded yet.
    const existing = (await col
      .find({ workspaceId, email: { $in: emails } }, { projection: { email: 1 } })
      .toArray()) as unknown as Array<{ email?: unknown }>;
    const known = new Set(existing.map((d) => String(d.email ?? '').toLowerCase()));

    const fresh = emails.filter((e) => !known.has(e));
    if (!fresh.length) return;

    const now = new Date();
    const ops = fresh.map((email) => ({
      updateOne: {
        filter: { workspaceId, email },
        update: {
          $setOnInsert: {
            workspaceId,
            email,
            decision: 'pending' as SabmailScreenerDecision,
            firstSeenAt: now,
          },
        },
        upsert: true,
      },
    }));
    await col.bulkWrite(ops as never, { ordered: false });
  } catch {
    /* inbound discovery is best-effort — never break the list */
  }
}

/* ── list ─────────────────────────────────────────────────────────────── */

/**
 * List screener senders for the active workspace, optionally filtered by
 * decision. On a `pending` (or unfiltered) read, best-effort surfaces any
 * fresh inbound senders first so they appear in the queue.
 */
export async function listSabmailScreener(
  filter?: SabmailScreenerDecision,
): Promise<SabmailScreenerRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];

    // Surface inbound senders when viewing the pending queue (or no filter).
    if (!filter || filter === 'pending') {
      await surfaceInboundSenders(workspaceId);
    }

    const query: Record<string, unknown> = { workspaceId };
    if (filter && DECISIONS.includes(filter)) query.decision = filter;

    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailScreenerDoc>(SABMAIL_COLLECTIONS.screener)
      .find(query as never)
      .sort({ firstSeenAt: -1 })
      .limit(1000)
      .toArray();

    return docs.map((d) => toRow(d as WithId<SabmailScreenerDoc>));
  } catch (err) {
    console.error('[sabmail] listSabmailScreener failed:', err);
    return [];
  }
}

/* ── add (upsert pending on {workspaceId, email}) ─────────────────────── */

/** Manually add a sender to the screener as `pending` (idempotent on email). */
export async function addScreenerSender(input: {
  email: string;
  name?: string;
}): Promise<Result<{ sender: SabmailScreenerRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

    const email = normalizeEmail(input.email);
    if (!email) return { ok: false, error: 'Enter a valid email address.' };

    const name = input.name?.trim();
    const now = new Date();

    const set: Record<string, unknown> = {};
    if (name) set.name = name;

    const { db } = await connectToDatabase();
    const col = db.collection<SabmailScreenerDoc>(SABMAIL_COLLECTIONS.screener);

    await col.updateOne(
      { workspaceId, email },
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        $setOnInsert: {
          workspaceId,
          email,
          decision: 'pending',
          firstSeenAt: now,
        },
      } as never,
      { upsert: true },
    );

    const doc = await col.findOne({ workspaceId, email });
    if (!doc) return { ok: false, error: 'Could not add the sender.' };
    return { ok: true, sender: toRow(doc as WithId<SabmailScreenerDoc>) };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── decide ───────────────────────────────────────────────────────────── */

/**
 * Approve or deny a screener sender (matched by email within the workspace).
 * Upserts so deciding on a freshly-surfaced sender always persists.
 */
export async function setScreenerDecision(
  email: string,
  decision: SabmailScreenerDecision,
): Promise<{ ok: true; sender: SabmailScreenerRow } | { ok: false; error: string }> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

    const normalized = normalizeEmail(email);
    if (!normalized) return { ok: false, error: 'Enter a valid email address.' };
    if (!DECISIONS.includes(decision)) {
      return { ok: false, error: 'Invalid decision.' };
    }

    const now = new Date();
    const { db } = await connectToDatabase();
    const col = db.collection<SabmailScreenerDoc>(SABMAIL_COLLECTIONS.screener);

    await col.updateOne(
      { workspaceId, email: normalized },
      {
        $set:
          decision === 'pending'
            ? { decision }
            : { decision, decidedAt: now },
        ...(decision === 'pending' ? { $unset: { decidedAt: '' } } : {}),
        $setOnInsert: { workspaceId, email: normalized, firstSeenAt: now },
      } as never,
      { upsert: true },
    );

    const doc = await col.findOne({ workspaceId, email: normalized });
    if (!doc) return { ok: false, error: 'Could not save the decision.' };
    return { ok: true, sender: toRow(doc as WithId<SabmailScreenerDoc>) };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}
