/**
 * SabCRM — activity auto-capture — PURE helpers.
 *
 * `'server-only'`- and I/O-free (unit-testable). Turns an inbound email or a
 * pulled calendar event into a normalised ACTIVITY DRAFT, and matches a
 * sender / attendee email address against a set of candidate records. The
 * Mongo persistence + Google Calendar pull live in `./auto-capture.server.ts`.
 *
 * ## Why a draft?
 *
 * Auto-capture writes an EMAIL / MEETING activity onto the matching record's
 * timeline so reps never hand-log. The PURE layer decides WHAT to write
 * (title / body / type / dedup id) and WHICH record it belongs to; the server
 * layer does the matching query + the idempotent insert. Keeping the shaping
 * pure makes the matching rules + draft formatting trivially testable without
 * a DB or the Google API.
 *
 * ## Idempotency
 *
 * Every draft carries a stable `externalSource` + `externalId` pair (the email
 * Message-Id, or the Google event id). The server layer dedups on
 * `(projectId, externalSource, externalId)` so re-delivered webhooks and
 * repeated cron pulls never double-log.
 */

/** Source channel a captured activity originated from (the dedup namespace). */
export type AutoCaptureSource = 'email-inbound' | 'google-calendar';

/** Activity types this vertical emits (subset of the timeline vocabulary). */
export type AutoCaptureActivityType = 'EMAIL' | 'MEETING';

/** A minimal inbound-email shape (mirrors `email-inbound.ts`'s envelope). */
export interface AutoCaptureEmail {
  /** Sender — matched against record EMAIL / EMAILS fields. */
  from: string;
  fromName?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  /** RFC822 Message-Id — the dedup key. Falls back to a content hash upstream. */
  messageId?: string;
  /** Recipient (the tenant-owned address); carried for the body context. */
  to?: string;
  receivedAt?: Date | string;
}

/** A minimal Google Calendar event shape (Calendar v3 `events.list` item). */
export interface AutoCaptureCalendarEvent {
  /** Google event id — the dedup key. */
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  organizer?: { email?: string; displayName?: string };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
    organizer?: boolean;
  }>;
  htmlLink?: string;
}

/** A normalised activity draft, ready for the server layer to persist. */
export interface ActivityDraft {
  type: AutoCaptureActivityType;
  title: string;
  body: string;
  /** Dedup namespace. */
  externalSource: AutoCaptureSource;
  /** Stable per-source id; empty string means "not idempotent / skip". */
  externalId: string;
  /**
   * Email addresses this draft should be matched against, lower-cased + deduped
   * (sender for email; the non-self attendees + organizer for a meeting). The
   * server layer runs each through {@link matchRecordByEmail}.
   */
  matchEmails: string[];
  /** When the underlying event occurred (ISO), best-effort. */
  occurredAt?: string;
}

/** A candidate record the matcher can resolve a sender/attendee against. */
export interface MatchCandidate {
  /** Object slug (e.g. `people`, `leads`). */
  object: string;
  /** Hex record id. */
  recordId: string;
  /**
   * Every email address held on this record (across EMAIL / EMAILS fields),
   * lower-cased. The matcher compares the from-address against this set.
   */
  emails: string[];
}

/** A resolved match — which record an address belongs to. */
export interface MatchResult {
  object: string;
  recordId: string;
}

const MAX_BODY = 4000;
const MAX_TITLE = 200;

/** Lower-case + trim an address; '' when not a plausible email. */
export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const v = raw.trim().toLowerCase();
  return v.includes('@') ? v : '';
}

/** Strip HTML to readable plain text (text wins over HTML), capped. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_BODY);
}

/** Best-effort plain text from an email body (text preferred over HTML). */
function emailBodyText(msg: AutoCaptureEmail): string {
  if (msg.bodyText?.trim()) return msg.bodyText.trim().slice(0, MAX_BODY);
  if (msg.bodyHtml?.trim()) return htmlToText(msg.bodyHtml);
  return '';
}

function cap(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** ISO from a `Date | string`, or undefined when unparseable. */
function toIso(v: Date | string | undefined): string | undefined {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Match a from/attendee address against candidate records.
 *
 * The rule is an EXACT, case-insensitive address match against any email held
 * on a candidate. Multiple candidates can match (the same address on a person
 * AND a lead) — all are returned so the server fan-outs the activity onto each,
 * mirroring `email-inbound.ts`. De-duplicated by `(object, recordId)`.
 *
 * Returns `[]` for an empty / malformed address or no candidates.
 */
export function matchRecordByEmail(
  fromAddr: string,
  candidates: MatchCandidate[],
): MatchResult[] {
  const addr = normalizeEmail(fromAddr);
  if (!addr || !Array.isArray(candidates) || candidates.length === 0) return [];
  const out: MatchResult[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (!c?.object || !c?.recordId) continue;
    const hit = (c.emails ?? []).some((e) => normalizeEmail(e) === addr);
    if (!hit) continue;
    const key = `${c.object}::${c.recordId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ object: c.object, recordId: c.recordId });
  }
  return out;
}

/**
 * Build an EMAIL activity draft from an inbound message. The draft's
 * `matchEmails` is the (single) sender address; `externalId` is the
 * Message-Id (empty → caller must skip, since it can't dedup safely).
 */
export function buildActivityFromEmail(msg: AutoCaptureEmail): ActivityDraft {
  const from = normalizeEmail(msg.from);
  const subject = (msg.subject ?? '').trim() || '(no subject)';
  const who = msg.fromName?.trim() || from || 'unknown sender';
  const body = emailBodyText(msg);
  return {
    type: 'EMAIL',
    title: cap(`Email from ${who}: ${subject}`, MAX_TITLE),
    body,
    externalSource: 'email-inbound',
    externalId: (msg.messageId ?? '').trim(),
    matchEmails: from ? [from] : [],
    occurredAt: toIso(msg.receivedAt),
  };
}

/**
 * Build a MEETING activity draft from a calendar event. `matchEmails` is the
 * set of external (non-self) attendee addresses plus the organizer — the
 * people the meeting was WITH, which is what we want to log it against.
 * `externalId` is the Google event id (empty → caller skips).
 *
 * Cancelled events (`status === 'cancelled'`) and events with no usable
 * counterpart address still produce a draft, but the server layer skips a
 * draft with an empty `matchEmails` (nothing to attach to) — the shaping stays
 * pure and total.
 */
export function buildActivityFromCalendarEvent(
  evt: AutoCaptureCalendarEvent,
): ActivityDraft {
  const summary = (evt.summary ?? '').trim() || '(untitled meeting)';
  const startIso = toIso(evt.start?.dateTime ?? evt.start?.date);
  const when = startIso ? new Date(startIso) : null;
  const whenLabel = when
    ? when.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
    : 'time TBD';

  const emails = new Set<string>();
  for (const a of evt.attendees ?? []) {
    if (a?.self) continue; // never match the tenant against itself
    const e = normalizeEmail(a?.email);
    if (e) emails.add(e);
  }
  const org = normalizeEmail(evt.organizer?.email);
  // The organizer counts as a counterpart unless it's the tenant (marked self
  // on the attendee list above; if absent there we still include it).
  const orgIsSelf = (evt.attendees ?? []).some(
    (a) => a?.self && normalizeEmail(a?.email) === org,
  );
  if (org && !orgIsSelf) emails.add(org);

  const bodyParts: string[] = [`When: ${whenLabel}`];
  if (evt.location?.trim()) bodyParts.push(`Where: ${evt.location.trim()}`);
  if (evt.attendees?.length) {
    const names = evt.attendees
      .map((a) => a?.displayName?.trim() || normalizeEmail(a?.email))
      .filter(Boolean);
    if (names.length) bodyParts.push(`Attendees: ${names.join(', ')}`);
  }
  if (evt.description?.trim()) {
    bodyParts.push('', htmlToText(evt.description));
  }

  return {
    type: 'MEETING',
    title: cap(`Meeting: ${summary}`, MAX_TITLE),
    body: bodyParts.join('\n').slice(0, MAX_BODY),
    externalSource: 'google-calendar',
    externalId: (evt.id ?? '').trim(),
    matchEmails: [...emails],
    occurredAt: startIso,
  };
}
