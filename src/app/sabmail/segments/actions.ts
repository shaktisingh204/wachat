'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import {
  resolveSegmentRuleEmails,
  type SabmailSegmentDoc,
  type SabmailSegmentRule,
} from '@/lib/sabmail/segments';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail segments — audience surface actions.
 *
 * A segment is a saved, named rule over the workspace's contacts. The rule
 * shape + Mongo compilation live in `@/lib/sabmail/segments` (a plain server
 * lib, callable from crons too); these actions only authorize the active
 * workspace, persist/list/delete docs, and run the lib for live previews.
 *
 * Every action is tenant-scoped by the active SabMail `workspaceId`, writing
 * into the roadmap-reserved `segments` collection — no shared-schema change.
 * ──────────────────────────────────────────────────────────────────── */

export type { SabmailSegmentRule } from '@/lib/sabmail/segments';

/** Safe, serializable projection of a segment for the client. */
export interface SabmailSegmentRow {
  id: string;
  name: string;
  rule: SabmailSegmentRule;
  createdAt: string;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

function toRow(doc: WithId<SabmailSegmentDoc>): SabmailSegmentRow {
  return {
    id: String(doc._id),
    name: doc.name,
    rule: doc.rule ?? {},
    createdAt: doc.createdAt
      ? new Date(doc.createdAt).toISOString()
      : new Date(0).toISOString(),
  };
}

/** Normalize an incoming rule to the persisted shape (drops empty parts). */
function cleanRule(raw: SabmailSegmentRule | undefined): SabmailSegmentRule {
  const rule = raw ?? {};
  const out: SabmailSegmentRule = {};

  const tagsAny = Array.isArray(rule.tagsAny)
    ? Array.from(
        new Set(
          rule.tagsAny.map((t) => String(t ?? '').trim()).filter(Boolean),
        ),
      ).slice(0, 50)
    : [];
  if (tagsAny.length) out.tagsAny = tagsAny;

  const domain = String(rule.domain ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '');
  if (domain) out.domain = domain;

  const emailContains = String(rule.emailContains ?? '').trim();
  if (emailContains) out.emailContains = emailContains;

  return out;
}

/* ── list ─────────────────────────────────────────────────────────────── */

/** List segments for the active workspace (newest first). */
export async function listSabmailSegments(): Promise<SabmailSegmentRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];

    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailSegmentDoc>(SABMAIL_COLLECTIONS.segments)
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    return docs.map((d) => toRow(d as WithId<SabmailSegmentDoc>));
  } catch (err) {
    console.error('[sabmail] listSabmailSegments failed:', err);
    return [];
  }
}

/* ── create ───────────────────────────────────────────────────────────── */

/** Save a new named segment for the active workspace. */
export async function createSabmailSegment(input: {
  name: string;
  rule: SabmailSegmentRule;
}): Promise<Result<{ segment: SabmailSegmentRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

    const name = String(input?.name ?? '').trim();
    if (!name) return { ok: false, error: 'Give the segment a name.' };

    const rule = cleanRule(input?.rule);

    const now = new Date();
    const doc: SabmailSegmentDoc = { workspaceId, name, rule, createdAt: now };

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailSegmentDoc>(SABMAIL_COLLECTIONS.segments)
      .insertOne(doc as never);

    return {
      ok: true,
      segment: toRow({ ...doc, _id: res.insertedId } as WithId<SabmailSegmentDoc>),
    };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── delete ───────────────────────────────────────────────────────────── */

/** Delete a segment owned by the active workspace. */
export async function deleteSabmailSegment(id: string): Promise<VoidResult> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) {
      return { ok: false, error: 'Invalid segment id.' };
    }

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailSegmentDoc>(SABMAIL_COLLECTIONS.segments)
      .deleteOne({ _id: new ObjectId(id), workspaceId });

    if (res.deletedCount === 0) {
      return { ok: false, error: 'Segment not found.' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── preview (live) ───────────────────────────────────────────────────── */

/**
 * Resolve an ad-hoc rule against the workspace contacts and return the match
 * count plus a small sample of emails — powers the create dialog's live
 * "Preview" without persisting anything.
 */
export async function previewSegment(
  rule: SabmailSegmentRule,
): Promise<Result<{ count: number; sample: string[] }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

    const emails = await resolveSegmentRuleEmails(workspaceId, cleanRule(rule));
    return { ok: true, count: emails.length, sample: emails.slice(0, 8) };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}
