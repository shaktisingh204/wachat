import 'server-only';

import { ObjectId, type Filter, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail segments — audience resolution.
 *
 * A segment is a saved, named rule over the workspace's contacts. The rule
 * is a small declarative shape ({tagsAny?, domain?, emailContains?}); this
 * lib compiles it into a Mongo filter and returns the matching contact
 * emails. It is a PLAIN server lib (no 'use server') so it can be called
 * from server actions, route handlers, and cron sweeps alike — every entry
 * point passes an EXPLICIT `workspaceId` (no session/cookie read here), so
 * the same code path works for both the dashboard (cookie-scoped) and any
 * future cron/journey driver (doc-scoped).
 *
 * Contacts live in SABMAIL_COLLECTIONS.contacts as
 *   { workspaceId, email, name?, tags?: string[], createdAt }.
 * ──────────────────────────────────────────────────────────────────── */

/** The declarative audience rule stored on a segment doc. */
export interface SabmailSegmentRule {
  /** Match contacts carrying ANY of these tags. */
  tagsAny?: string[];
  /** Match contacts whose email ends with `@<domain>` (case-insensitive). */
  domain?: string;
  /** Match contacts whose email contains this substring (case-insensitive). */
  emailContains?: string;
}

/** The stored shape of a segment (one Mongo doc). */
export interface SabmailSegmentDoc {
  workspaceId: string;
  name: string;
  rule: SabmailSegmentRule;
  createdAt: Date;
}

/** A contact row as far as segment resolution is concerned. */
interface SabmailContactLite {
  workspaceId: string;
  email: string;
  name?: string;
  tags?: string[];
}

/** Escape a string for safe inclusion in a RegExp. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalize the rule, stripping empties so an "empty" rule matches all. */
function normalizeRule(raw: unknown): SabmailSegmentRule {
  const rule = (raw && typeof raw === 'object' ? raw : {}) as SabmailSegmentRule;
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

/**
 * Compile a normalized rule into a Mongo filter over the contacts collection,
 * always scoped by `workspaceId`. An empty rule resolves to the whole
 * workspace audience.
 */
function buildContactFilter(
  workspaceId: string,
  rule: SabmailSegmentRule,
): Filter<SabmailContactLite> {
  const and: Filter<SabmailContactLite>[] = [];

  if (rule.tagsAny && rule.tagsAny.length) {
    and.push({ tags: { $in: rule.tagsAny } } as Filter<SabmailContactLite>);
  }

  if (rule.domain) {
    and.push({
      email: { $regex: `@${escapeRegex(rule.domain)}$`, $options: 'i' },
    } as Filter<SabmailContactLite>);
  }

  if (rule.emailContains) {
    and.push({
      email: { $regex: escapeRegex(rule.emailContains), $options: 'i' },
    } as Filter<SabmailContactLite>);
  }

  const filter: Filter<SabmailContactLite> = { workspaceId };
  if (and.length) filter.$and = and;
  return filter;
}

/** Run a compiled rule against the contacts collection → unique, sorted emails. */
async function resolveEmails(
  workspaceId: string,
  rule: SabmailSegmentRule,
): Promise<string[]> {
  const { db } = await connectToDatabase();
  const docs = await db
    .collection<SabmailContactLite>(SABMAIL_COLLECTIONS.contacts)
    .find(buildContactFilter(workspaceId, rule), {
      projection: { email: 1, _id: 0 },
    })
    .limit(100_000)
    .toArray();

  const seen = new Set<string>();
  for (const doc of docs) {
    const email = String(doc.email ?? '').trim().toLowerCase();
    if (email) seen.add(email);
  }
  return Array.from(seen).sort();
}

/**
 * Resolve a SAVED segment (by id) to its matching contact emails.
 * Returns an empty array when the segment is missing or the id is invalid —
 * resolution never throws so callers (sends, previews) can degrade gracefully.
 */
export async function resolveSegmentEmails(
  workspaceId: string,
  segmentId: string,
): Promise<string[]> {
  if (!workspaceId) return [];
  if (!segmentId || !ObjectId.isValid(segmentId)) return [];

  const { db } = await connectToDatabase();
  const seg = (await db
    .collection<SabmailSegmentDoc>(SABMAIL_COLLECTIONS.segments)
    .findOne({ _id: new ObjectId(segmentId), workspaceId })) as
    | WithId<SabmailSegmentDoc>
    | null;
  if (!seg) return [];

  return resolveSegmentRuleEmails(workspaceId, seg.rule);
}

/**
 * Resolve an AD-HOC rule (not yet saved) to its matching contact emails —
 * powers the live "Preview" in the create dialog and any inline audience
 * targeting.
 */
export async function resolveSegmentRuleEmails(
  workspaceId: string,
  rule: SabmailSegmentRule,
): Promise<string[]> {
  if (!workspaceId) return [];
  return resolveEmails(workspaceId, normalizeRule(rule));
}
