'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { getErrorMessage } from '@/lib/utils';
import { sendSabmailMessage } from '@/app/sabmail/inbox/actions';
import { scheduleSabmailSend } from '@/app/sabmail/scheduled/actions';
import { resolveSegmentEmails } from '@/lib/sabmail/segments';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — Campaigns (broadcast) surface.
 *
 * A campaign is a one-shot broadcast of an HTML email to a flat list of
 * recipient addresses, sent through a connected mailbox's SMTP. Stats are
 * tallied per-send. Scoped per workspace like every SabMail collection.
 *
 * TODO: move bulk send to a background worker (Phase infra) — this sends
 * synchronously in-request, fine for small lists.
 * ──────────────────────────────────────────────────────────────────── */

/** Hard cap on recipients processed per send (synchronous, in-request). */
const MAX_RECIPIENTS_PER_SEND = 200;

export type SabmailCampaignStatus =
  | 'draft'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'scheduled';

/** When to send a campaign — immediately, or batched for the next morning. */
export type SabmailCampaignSendWindow = 'now' | 'next-morning';

/** Which A/B variant leads on deliveries (null = no test / tie). */
export type SabmailCampaignWinner = 'A' | 'B' | null;

export interface SabmailCampaignStats {
  total: number;
  sent: number;
  failed: number;
  /** Variant-A tallies (only meaningful when an A/B test ran). */
  aSent?: number;
  aFailed?: number;
  /** Variant-B tallies (only meaningful when an A/B test ran). */
  bSent?: number;
  bFailed?: number;
}

/** Stored shape (Mongo). */
interface SabmailCampaignDoc {
  _id: ObjectId;
  workspaceId: string;
  name: string;
  accountId: string;
  subject: string;
  bodyHtml: string;
  /** Optional A/B variant — alternate subject. */
  subjectB?: string;
  /** Optional A/B variant — alternate body HTML. */
  bodyHtmlB?: string;
  /** Percentage of recipients assigned to variant A (0–100, default 50). */
  abSplitPct?: number;
  /** Send timing for this campaign (defaults to immediate). */
  sendWindow?: SabmailCampaignSendWindow;
  recipients: string[];
  status: SabmailCampaignStatus;
  stats: SabmailCampaignStats;
  createdAt: Date;
  sentAt?: Date;
}

/** Safe, serialisable projection sent to the client. */
export interface SabmailCampaignRow {
  id: string;
  name: string;
  accountId: string;
  subject: string;
  bodyHtml: string;
  subjectB: string | null;
  bodyHtmlB: string | null;
  abSplitPct: number;
  /** True when this campaign carries an A/B variant. */
  isAbTest: boolean;
  sendWindow: SabmailCampaignSendWindow;
  recipients: string[];
  status: SabmailCampaignStatus;
  stats: SabmailCampaignStats;
  /** Leading variant by deliveries (null when no test / tie). */
  winner: SabmailCampaignWinner;
  createdAt: string;
  sentAt: string | null;
}

export interface SabmailRecipientOption {
  email: string;
  name: string | null;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

/**
 * Compute the leading A/B variant from a stats tally. Returns `'A'`/`'B'`
 * for the variant with more *deliveries*, or `null` when there's no A/B test
 * recorded or the two variants are tied.
 */
function leadingVariant(stats: SabmailCampaignStats | undefined): SabmailCampaignWinner {
  if (!stats) return null;
  const aSent = stats.aSent ?? 0;
  const bSent = stats.bSent ?? 0;
  // No A/B activity recorded at all → not a test.
  if (aSent === 0 && bSent === 0 && (stats.aFailed ?? 0) === 0 && (stats.bFailed ?? 0) === 0) {
    return null;
  }
  if (aSent === bSent) return null;
  return aSent > bSent ? 'A' : 'B';
}

/** Clamp an A/B split percentage into [1, 99]; falls back to 50. */
function clampSplitPct(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 50;
  return Math.min(99, Math.max(1, Math.round(n)));
}

/**
 * Compute the next ~09:00 local-ish ISO timestamp from `from`. If it's already
 * past 9am, roll to tomorrow morning. Lightweight (no TZ library) — the
 * server's local clock stands in for "the next morning".
 */
function nextMorningISO(from: Date = new Date()): string {
  const target = new Date(from);
  target.setHours(9, 0, 0, 0);
  if (target.getTime() <= from.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.toISOString();
}

function toRow(doc: WithId<SabmailCampaignDoc>): SabmailCampaignRow {
  const subjectB = typeof doc.subjectB === 'string' && doc.subjectB.trim() ? doc.subjectB : null;
  const bodyHtmlB =
    typeof doc.bodyHtmlB === 'string' && doc.bodyHtmlB.trim() ? doc.bodyHtmlB : null;
  const stats: SabmailCampaignStats = {
    total: doc.stats?.total ?? 0,
    sent: doc.stats?.sent ?? 0,
    failed: doc.stats?.failed ?? 0,
    aSent: doc.stats?.aSent ?? 0,
    aFailed: doc.stats?.aFailed ?? 0,
    bSent: doc.stats?.bSent ?? 0,
    bFailed: doc.stats?.bFailed ?? 0,
  };
  return {
    id: String(doc._id),
    name: doc.name,
    accountId: doc.accountId,
    subject: doc.subject,
    bodyHtml: doc.bodyHtml,
    subjectB,
    bodyHtmlB,
    abSplitPct: clampSplitPct(doc.abSplitPct),
    isAbTest: Boolean(subjectB || bodyHtmlB),
    sendWindow: doc.sendWindow === 'next-morning' ? 'next-morning' : 'now',
    recipients: Array.isArray(doc.recipients) ? doc.recipients : [],
    status: doc.status,
    stats,
    winner: leadingVariant(stats),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date(0).toISOString(),
    sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
  };
}

/** De-dup + normalise a raw recipient list into valid lowercase emails. */
function normaliseRecipients(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const email = String(entry ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/* ── list ─────────────────────────────────────────────────────────────── */

export async function listSabmailCampaigns(): Promise<SabmailCampaignRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];
    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailCampaignDoc>(SABMAIL_COLLECTIONS.campaigns)
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return docs.map((d) => toRow(d as WithId<SabmailCampaignDoc>));
  } catch (err) {
    console.error('[sabmail] listSabmailCampaigns failed:', err);
    return [];
  }
}

/* ── recipient options (from contacts) ────────────────────────────────── */

/** Workspace contacts' emails — to bulk-load a recipient list. */
export async function listRecipientOptions(): Promise<SabmailRecipientOption[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];
    const { db } = await connectToDatabase();
    const docs = await db
      .collection<{ email?: unknown; name?: unknown; displayName?: unknown }>(
        SABMAIL_COLLECTIONS.contacts,
      )
      .find({ workspaceId } as never, { projection: { email: 1, name: 1, displayName: 1 } })
      .limit(2000)
      .toArray();

    const seen = new Set<string>();
    const out: SabmailRecipientOption[] = [];
    for (const doc of docs) {
      const email = String(doc.email ?? '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
      seen.add(email);
      const rawName = doc.name ?? doc.displayName;
      out.push({ email, name: rawName ? String(rawName) : null });
    }
    return out;
  } catch (err) {
    console.error('[sabmail] listRecipientOptions failed:', err);
    return [];
  }
}

/* ── create ───────────────────────────────────────────────────────────── */

export async function createSabmailCampaign(input: {
  name: string;
  accountId: string;
  subject: string;
  bodyHtml: string;
  recipients: string[];
  /** Optional A/B variant — alternate subject. */
  subjectB?: string;
  /** Optional A/B variant — alternate body HTML. */
  bodyHtmlB?: string;
  /** Percentage of recipients assigned to variant A (default 50). */
  abSplitPct?: number;
  /** Send timing — immediate ('now', default) or batched ('next-morning'). */
  sendWindow?: SabmailCampaignSendWindow;
}): Promise<Result<{ campaign: SabmailCampaignRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

    const name = input.name?.trim();
    if (!name) return { ok: false, error: 'Campaign name is required.' };
    if (name.length > 160) return { ok: false, error: 'Campaign name is too long (max 160 chars).' };

    const accountId = input.accountId?.trim();
    if (!accountId || !ObjectId.isValid(accountId)) {
      return { ok: false, error: 'Pick a sending mailbox.' };
    }

    const subject = input.subject?.trim();
    if (!subject) return { ok: false, error: 'Subject is required.' };

    const bodyHtml = input.bodyHtml ?? '';
    if (!bodyHtml.trim()) return { ok: false, error: 'Add an email body.' };

    const recipients = normaliseRecipients(input.recipients ?? []);
    if (recipients.length === 0) {
      return { ok: false, error: 'Add at least one valid recipient email.' };
    }

    // Verify the chosen mailbox belongs to this workspace before saving.
    const { db } = await connectToDatabase();
    const account = await db
      .collection(SABMAIL_COLLECTIONS.accounts)
      .findOne({ _id: new ObjectId(accountId), workspaceId }, { projection: { _id: 1 } });
    if (!account) return { ok: false, error: 'Sending mailbox not found in this workspace.' };

    // Optional A/B variant — only persisted when at least one half differs.
    const subjectB = input.subjectB?.trim();
    const bodyHtmlB = typeof input.bodyHtmlB === 'string' ? input.bodyHtmlB.trim() : '';
    const hasVariant = Boolean(subjectB) || Boolean(bodyHtmlB);
    const sendWindow: SabmailCampaignSendWindow =
      input.sendWindow === 'next-morning' ? 'next-morning' : 'now';

    const now = new Date();
    const doc: Omit<SabmailCampaignDoc, '_id'> = {
      workspaceId,
      name,
      accountId,
      subject,
      bodyHtml,
      recipients,
      status: 'draft',
      stats: { total: recipients.length, sent: 0, failed: 0 },
      createdAt: now,
    };
    if (hasVariant) {
      if (subjectB) doc.subjectB = subjectB;
      if (bodyHtmlB) doc.bodyHtmlB = bodyHtmlB;
      doc.abSplitPct = clampSplitPct(input.abSplitPct);
    }
    if (sendWindow !== 'now') doc.sendWindow = sendWindow;
    const ins = await db
      .collection<SabmailCampaignDoc>(SABMAIL_COLLECTIONS.campaigns)
      .insertOne(doc as never);

    return {
      ok: true,
      campaign: toRow({ ...doc, _id: ins.insertedId } as WithId<SabmailCampaignDoc>),
    };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── delete ───────────────────────────────────────────────────────────── */

export async function deleteSabmailCampaign(id: string): Promise<VoidResult> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid campaign id.' };

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailCampaignDoc>(SABMAIL_COLLECTIONS.campaigns)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Campaign not found.' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── send ─────────────────────────────────────────────────────────────── */

/**
 * Send a draft campaign to its recipients.
 *
 * Loads the (workspace-scoped) campaign, then either:
 *  • sendWindow 'next-morning' → queues one scheduled send per recipient for
 *    the next ~09:00 via `scheduleSabmailSend` and flips status → 'scheduled';
 *  • sendWindow 'now' (default) → flips status → 'sending' and sends one
 *    message per recipient through the connected mailbox's SMTP via the shared
 *    inbox `sendSabmailMessage` action.
 *
 * When the campaign carries an A/B variant (subjectB / bodyHtmlB), recipients
 * are split ~`abSplitPct` into variant A vs B and the matching subject/body is
 * used; per-variant tallies (aSent/aFailed/bSent/bFailed) are recorded
 * alongside the overall sent/failed.
 *
 * On immediate send, status finalises to 'sent' (≥1 delivered) or 'failed'
 * (all failed) with `sentAt`.
 *
 * TODO: move bulk send to a background worker (Phase infra) — this sends
 * synchronously in-request, fine for small lists.
 */
export async function sendSabmailCampaign(
  id: string,
): Promise<Result<{ campaign: SabmailCampaignRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid campaign id.' };

    const { db } = await connectToDatabase();
    const col = db.collection<SabmailCampaignDoc>(SABMAIL_COLLECTIONS.campaigns);
    const _id = new ObjectId(id);

    const campaign = (await col.findOne({ _id, workspaceId })) as WithId<SabmailCampaignDoc> | null;
    if (!campaign) return { ok: false, error: 'Campaign not found.' };
    if (campaign.status === 'sending') {
      return { ok: false, error: 'This campaign is already sending.' };
    }
    if (campaign.status === 'sent') {
      return { ok: false, error: 'This campaign has already been sent.' };
    }
    if (campaign.status === 'scheduled') {
      return { ok: false, error: 'This campaign is already scheduled.' };
    }

    let recipients = normaliseRecipients(campaign.recipients ?? []);
    if (recipients.length === 0) {
      return { ok: false, error: 'This campaign has no valid recipients.' };
    }
    if (recipients.length > MAX_RECIPIENTS_PER_SEND) {
      console.warn(
        `[sabmail] campaign ${id} has ${recipients.length} recipients — capping at ${MAX_RECIPIENTS_PER_SEND} for this synchronous in-request send. TODO: move bulk send to a background worker.`,
      );
      recipients = recipients.slice(0, MAX_RECIPIENTS_PER_SEND);
    }

    // Resolve the A/B variant (only active when at least one half is present).
    const subjectB =
      typeof campaign.subjectB === 'string' && campaign.subjectB.trim()
        ? campaign.subjectB.trim()
        : null;
    const bodyHtmlB =
      typeof campaign.bodyHtmlB === 'string' && campaign.bodyHtmlB.trim()
        ? campaign.bodyHtmlB
        : null;
    const isAbTest = Boolean(subjectB || bodyHtmlB);
    const splitPct = clampSplitPct(campaign.abSplitPct);

    // Partition recipients into variant A / B. With no test, everyone is A.
    const total = recipients.length;
    const aCount = isAbTest ? Math.max(0, Math.min(total, Math.round((total * splitPct) / 100))) : total;
    const variantA = recipients.slice(0, aCount);
    const variantB = isAbTest ? recipients.slice(aCount) : [];

    // Per-variant subject/body — fall back to the A copy when a half is absent.
    const subjectForB = subjectB ?? campaign.subject;
    const bodyForB = bodyHtmlB ?? campaign.bodyHtml;

    /* ── Send-time optimization: schedule for the next morning ─────────── */
    const sendWindow: SabmailCampaignSendWindow =
      campaign.sendWindow === 'next-morning' ? 'next-morning' : 'now';

    if (sendWindow === 'next-morning') {
      const sendAtISO = nextMorningISO();
      let queued = 0;
      let queueFailed = 0;
      const queueOne = async (to: string, subject: string, html: string) => {
        try {
          const res = await scheduleSabmailSend({
            accountId: campaign.accountId,
            to: [to],
            subject,
            html,
            sendAtISO,
            unsubscribe: { email: to, campaignId: String(_id) },
          });
          if (res.ok) queued += 1;
          else queueFailed += 1;
        } catch {
          queueFailed += 1;
        }
      };
      for (const recipient of variantA) {
        await queueOne(recipient, campaign.subject, campaign.bodyHtml);
      }
      for (const recipient of variantB) {
        await queueOne(recipient, subjectForB, bodyForB);
      }

      if (queued === 0) {
        return { ok: false, error: 'Could not schedule any sends for the next morning.' };
      }

      await col.updateOne(
        { _id, workspaceId },
        {
          $set: {
            status: 'scheduled',
            stats: { total, sent: 0, failed: 0, aSent: 0, aFailed: 0, bSent: 0, bFailed: 0 },
          },
        },
      );

      const scheduledDoc = (await col.findOne({ _id, workspaceId })) as
        | WithId<SabmailCampaignDoc>
        | null;
      if (!scheduledDoc) return { ok: false, error: 'Campaign disappeared during scheduling.' };
      return { ok: true, campaign: toRow(scheduledDoc) };
    }

    /* ── Immediate send ───────────────────────────────────────────────── */
    // Flip to sending so concurrent triggers see it in-flight.
    await col.updateOne(
      { _id, workspaceId },
      {
        $set: {
          status: 'sending',
          stats: { total, sent: 0, failed: 0, aSent: 0, aFailed: 0, bSent: 0, bFailed: 0 },
        },
      },
    );

    let aSent = 0;
    let aFailed = 0;
    let bSent = 0;
    let bFailed = 0;

    const campaignId = String(campaign._id);
    const sendOne = async (recipient: string, subject: string, html: string): Promise<boolean> => {
      try {
        const res = await sendSabmailMessage({
          accountId: campaign.accountId,
          to: [recipient],
          subject,
          html,
          // Bulk send → attach one-click List-Unsubscribe + Feedback-ID.
          unsubscribe: { email: recipient, campaignId },
        });
        return res.ok;
      } catch {
        return false;
      }
    };

    for (const recipient of variantA) {
      if (await sendOne(recipient, campaign.subject, campaign.bodyHtml)) aSent += 1;
      else aFailed += 1;
    }
    for (const recipient of variantB) {
      if (await sendOne(recipient, subjectForB, bodyForB)) bSent += 1;
      else bFailed += 1;
    }

    const sent = aSent + bSent;
    const failed = aFailed + bFailed;
    const finalStatus: SabmailCampaignStatus = sent > 0 ? 'sent' : 'failed';
    const sentAt = new Date();
    await col.updateOne(
      { _id, workspaceId },
      {
        $set: {
          status: finalStatus,
          stats: { total, sent, failed, aSent, aFailed, bSent, bFailed },
          sentAt,
        },
      },
    );

    const updated = (await col.findOne({ _id, workspaceId })) as WithId<SabmailCampaignDoc> | null;
    if (!updated) return { ok: false, error: 'Campaign disappeared during send.' };
    return { ok: true, campaign: toRow(updated) };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── segment targeting ──────────────────────────────────────────────────── */

/** A segment option for the New-campaign dialog's "Load from segment" picker. */
export interface SabmailCampaignSegmentOption {
  id: string;
  name: string;
}

/** Stored shape of a segment doc (local, untyped read). */
interface SabmailSegmentDocLite {
  _id: ObjectId;
  workspaceId: string;
  name?: unknown;
  createdAt?: unknown;
}

/**
 * List the workspace's saved segments (id + name) for the campaign dialog's
 * "Load from segment" picker. Reads `SABMAIL_COLLECTIONS.segments` scoped by
 * the active workspace.
 */
export async function listCampaignSegments(): Promise<SabmailCampaignSegmentOption[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];
    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailSegmentDocLite>(SABMAIL_COLLECTIONS.segments)
      .find({ workspaceId } as never, { projection: { name: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    const out: SabmailCampaignSegmentOption[] = [];
    for (const doc of docs) {
      const name = String(doc.name ?? '').trim();
      if (!name) continue;
      out.push({ id: String(doc._id), name });
    }
    return out;
  } catch (err) {
    console.error('[sabmail] listCampaignSegments failed:', err);
    return [];
  }
}

/**
 * Resolve a saved segment to its matching contact emails for the campaign
 * dialog. Delegates to the shared `resolveSegmentEmails` lib (workspace passed
 * explicitly) and returns the de-duped, lowercased email list.
 */
export async function loadCampaignSegmentEmails(segmentId: string): Promise<Result<{ emails: string[] }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!segmentId || !ObjectId.isValid(segmentId)) {
      return { ok: false, error: 'Pick a valid segment.' };
    }
    const emails = await resolveSegmentEmails(workspaceId, segmentId);
    return { ok: true, emails };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}
