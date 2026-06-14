/**
 * SabCRM shared inbox — PURE message→row mapping + record-match selection.
 *
 * The shared inbox surface (`/sabcrm/inbox`) shows recent SabMail messages with
 * the CRM record each one maps to (by from/to address). The I/O — reading
 * SabMail accounts + messages and resolving record matches through the Rust
 * engine — lives in `./crm-inbox.server.ts` (a `'server-only'` aggregator).
 *
 * This module is intentionally I/O-FREE and side-effect-FREE: it only knows how
 * to FLATTEN a SabMail message into an inbox row and PICK the best record match
 * for that row from a set of candidate matches. Keeping it pure means it can be
 * unit-tested with `npx tsx --test` and reused on either side of the wire
 * without dragging `server-only` into a client bundle.
 *
 * No `'server-only'` guard: pure logic, unit-tested in `./crm-inbox.test.ts`.
 */

import type { MailMessageDoc } from '@/lib/rust-client/mail-messages';

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

/** A resolved CRM record a message maps to. */
export interface CrmInboxMatch {
  /** Object slug, e.g. `people`. */
  object: string;
  /** Record id. */
  recordId: string;
  /** Human label for the chip, derived from the record's name-ish fields. */
  label: string;
}

/** One row of the shared CRM inbox. */
export interface CrmInboxRow {
  /** Stable row id (mail `_id` / `messageId`, prefixed). */
  messageId: string;
  /** Sender address (lowercased), the address used for matching. */
  from: string;
  /** Sender display name when present. */
  fromName?: string;
  /** Subject, never blank (falls back to `(no subject)`). */
  subject: string;
  /** Short preview text. */
  snippet: string;
  /** ISO timestamp the message arrived / was created, or null. */
  receivedAt: string | null;
  /** Whether the underlying mailbox row is unread. */
  unread: boolean;
  /** The single best CRM record this row maps to, or null when unmatched. */
  match: CrmInboxMatch | null;
}

/** A candidate match for a row, before best-match selection. */
export interface CrmInboxMatchCandidate extends CrmInboxMatch {
  /**
   * Lower sorts FIRST. Lets the aggregator express object priority (e.g.
   * People/Companies before custom objects) without this module knowing the
   * object catalog. Ties break on insertion order (stable).
   */
  rank?: number;
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

/** Loose-but-practical email shape check (mirrors `email-core.ts`). */
export function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Normalise an address for comparison: trimmed + lowercased. */
export function normaliseAddress(s: string | undefined | null): string {
  return (s ?? '').trim().toLowerCase();
}

/** Best plain-text preview from a SabMail row. */
function rowSnippet(doc: MailMessageDoc): string {
  const s = (doc.snippet ?? '').replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Derive a human label for a matched record from its `data.*` map. Tries the
 * common name-ish keys in priority order, then a `firstName lastName` join,
 * then the first email, finally a `Record <id>` fallback. Pure — the same
 * shapes the 20ui field renderers parse (see `email-core.ts#emailFromValue`).
 */
export function deriveRecordLabel(
  data: Record<string, unknown> | undefined | null,
  recordId: string,
): string {
  const d = data ?? {};
  // Only scalars become labels here; an object value (e.g. a composite `name`)
  // is handled by the dedicated branch below, never stringified to
  // `[object Object]`.
  const str = (v: unknown): string => {
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '';
  };

  for (const key of ['name', 'fullName', 'title', 'label', 'companyName', 'subject']) {
    const v = str(d[key]);
    if (v) return v;
  }

  const first = str(d.firstName);
  const last = str(d.lastName);
  const joined = [first, last].filter(Boolean).join(' ').trim();
  if (joined) return joined;

  // Composite name object (`{ firstName, lastName }`).
  const nameObj = d.name;
  if (nameObj && typeof nameObj === 'object' && !Array.isArray(nameObj)) {
    const n = nameObj as Record<string, unknown>;
    const c = [str(n.firstName), str(n.lastName)].filter(Boolean).join(' ').trim();
    if (c) return c;
  }

  for (const key of ['email', 'primaryEmail']) {
    const v = str(d[key]);
    if (v && looksLikeEmail(v)) return v;
  }

  return `Record ${recordId.slice(-6)}`;
}

/* ------------------------------------------------------------------------ */
/* Record-match selection                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Pick the SINGLE best CRM record for an inbox row from a candidate set.
 *
 * Selection order:
 *   1. lowest `rank` (object priority supplied by the aggregator);
 *   2. stable — earlier candidates win on a `rank` tie.
 *
 * Duplicate candidates (same object+recordId) collapse to the first seen.
 * Returns `null` for an empty / undefined candidate set, so an unmatched
 * message degrades to `match: null` rather than throwing.
 */
export function matchInboxRowToRecord(
  candidates: CrmInboxMatchCandidate[] | undefined | null,
): CrmInboxMatch | null {
  if (!candidates || candidates.length === 0) return null;

  const seen = new Set<string>();
  let best: CrmInboxMatchCandidate | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  let bestIndex = Number.POSITIVE_INFINITY;

  candidates.forEach((c, index) => {
    if (!c?.object || !c?.recordId) return;
    const dedupeKey = `${c.object}:${c.recordId}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const rank = Number.isFinite(c.rank) ? (c.rank as number) : 0;
    if (rank < bestRank || (rank === bestRank && index < bestIndex)) {
      best = c;
      bestRank = rank;
      bestIndex = index;
    }
  });

  if (!best) return null;
  const chosen = best as CrmInboxMatchCandidate;
  return { object: chosen.object, recordId: chosen.recordId, label: chosen.label };
}

/**
 * Flatten a SabMail message + its resolved match into a serialisable inbox row.
 * Pure: the caller has already resolved `match` (via {@link matchInboxRowToRecord}).
 * The address used for matching is the message's FROM address (lowercased).
 */
export function mailDocToInboxRow(
  doc: MailMessageDoc,
  match: CrmInboxMatch | null,
): CrmInboxRow {
  const from = normaliseAddress(doc.fromAddr?.email);
  const receivedAt = doc.receivedAt ?? doc.sentAt ?? doc.createdAt ?? null;
  const id = doc._id ?? doc.messageId ?? `${from}|${receivedAt ?? ''}`;
  return {
    messageId: `mail-${id}`,
    from,
    fromName: doc.fromAddr?.name?.trim() || undefined,
    subject: doc.subject?.trim() || '(no subject)',
    snippet: rowSnippet(doc),
    receivedAt,
    unread: !!doc.unread,
    match,
  };
}
