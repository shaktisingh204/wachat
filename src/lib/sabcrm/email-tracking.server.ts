import 'server-only';

/**
 * SabCRM — email open + click tracking runtime (server-only).
 *
 * Persists one tracking doc per outbound tracked email in
 * `sabcrm_email_events` (projectId-scoped, the native-Mongo config pattern of
 * `./scoring.server.ts`) and records open / click hits coming from the public
 * pixel + redirect routes. The pure HMAC + HTML-rewrite math lives in
 * `./email-tracking.ts` and is re-exported here so callers only import this
 * file.
 *
 * ## Flow
 *
 *   1. {@link createTrackedMessage} — the CRM email send path (`./email-core.ts`)
 *      calls this BEFORE handing the HTML to the transport. It inserts a
 *      `sabcrm_email_events` doc (status `sent`, empty `events[]`), signs a
 *      per-message token, and returns the tracking-instrumented HTML
 *      ({@link injectTracking}).
 *
 *   2. {@link recordOpen} / {@link recordClick} — the pixel route + click route
 *      call these with the token from the URL. They verify the HMAC, append an
 *      `open` / `click` event to the doc (de-duped opens within a short window),
 *      flip `status`, and best-effort log a CRM timeline activity on the source
 *      record so the open/click shows in the record's feed.
 *
 * ## Write-back envelope (mirrors `./scoring.server.ts`)
 *
 * On the FIRST open/click we also stamp a compact scalar summary onto the
 * source `sabcrm_records` doc — `data.emailLastEvent` (a short string like
 * `"opened 2026-06-13"`) and the reserved `data.__emailtrack` meta — via dotted
 * `$set` paths only, WITHOUT bumping the record's top-level `updatedAt`. Both
 * stores point at the same `sabcrm_records` collection, so this scalar is served
 * by the Rust read path with zero crate change (same two-store contract the
 * AI-fields / scoring features rely on).
 *
 * Everything is best-effort: a downed DB or a forged token must never throw out
 * of an HTTP route — the pixel must always return a GIF, the click must always
 * redirect.
 */

import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { createActivity } from './activities.server';
import {
  injectTracking,
  signToken,
  verifyToken,
  EMAIL_LAST_EVENT_FIELD,
  EMAIL_TRACK_META,
  TRACK_SECRET_ENV,
  type TrackingToken,
} from './email-tracking';

export {
  injectTracking,
  signToken,
  verifyToken,
  openUrl,
  clickUrl,
  pixelTag,
  rewriteLinks,
  CLICK_URL_PARAM,
  EMAIL_LAST_EVENT_FIELD,
  EMAIL_TRACK_META,
  TRACK_SECRET_ENV,
  type TrackingToken,
} from './email-tracking';

const EVENTS_COLL = 'sabcrm_email_events';
const RECORDS_COLL = 'sabcrm_records';

/** Collapse repeat opens within this window (ms) into a single event. */
const OPEN_DEDUPE_WINDOW_MS = 30_000;

/** Author id stamped on tracking-generated timeline activities. */
const SYSTEM_AUTHOR = 'system:email-tracking';

/* -------------------------------------------------------------------------- */
/* Secret resolution                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The HMAC secret for signing/verifying tracking tokens. Primary env is
 * `SABCRM_TRACK_SECRET`; falls back to the platform `AUTH_SECRET` /
 * `NEXTAUTH_SECRET` already provisioned for the app so tracking still works
 * (signed, just not with a dedicated key) when the dedicated one is unset.
 * Returns `''` when nothing is configured — callers treat that as "tracking
 * disabled" and never instrument or count.
 */
export function trackSecret(): string {
  return (
    process.env[TRACK_SECRET_ENV] ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ''
  );
}

/** App base URL the open/click absolute URLs are built from. */
function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  );
}

/* -------------------------------------------------------------------------- */
/* Doc shapes                                                                  */
/* -------------------------------------------------------------------------- */

/** A single open/click hit on a tracked message. */
export interface EmailTrackEvent {
  type: 'open' | 'click';
  at: string;
  /** Original destination (click events only). */
  url?: string;
  /** Truncated UA string, when the route forwarded one. */
  ua?: string;
}

export type EmailTrackStatus = 'sent' | 'opened' | 'clicked';

/** The persisted tracking doc for one outbound email. */
export interface EmailTrackDoc {
  _id: ObjectId | string;
  projectId: string;
  /** Source CRM record this email was sent from. */
  objectSlug: string;
  recordId: string;
  /** Recipient address (snapshot, for the events view). */
  to?: string;
  subject?: string;
  status: EmailTrackStatus;
  events: EmailTrackEvent[];
  openCount: number;
  clickCount: number;
  createdAt: string;
  /** Last open/click timestamp, for sorting the recent-events view. */
  lastEventAt?: string;
}

/** The serialisable API view of an {@link EmailTrackDoc}. */
export interface EmailTrackMessage extends Omit<EmailTrackDoc, '_id'> {
  id: string;
}

/** Result of {@link createTrackedMessage}. */
export interface CreateTrackedMessageResult {
  /** Tracking message id (the `sabcrm_email_events` doc id). */
  id: string;
  /** The tracking-instrumented HTML to hand to the transport. */
  html: string;
  /** False when tracking is disabled (no secret / inputs) — html is unchanged. */
  tracked: boolean;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toMessage(doc: EmailTrackDoc): EmailTrackMessage {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    objectSlug: doc.objectSlug,
    recordId: doc.recordId,
    to: doc.to,
    subject: doc.subject,
    status: doc.status,
    events: Array.isArray(doc.events) ? doc.events : [],
    openCount: doc.openCount ?? 0,
    clickCount: doc.clickCount ?? 0,
    createdAt: doc.createdAt,
    lastEventAt: doc.lastEventAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Create                                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateTrackedMessageInput {
  projectId: string;
  objectSlug: string;
  recordId: string;
  html: string;
  to?: string;
  subject?: string;
}

/**
 * Insert a tracking doc for an outbound email and return the instrumented HTML.
 *
 * Best-effort: if tracking is unconfigured (no secret), the inputs are
 * incomplete, or the DB write fails, the ORIGINAL html is returned with
 * `tracked: false` so the send always proceeds. Never throws.
 */
export async function createTrackedMessage(
  input: CreateTrackedMessageInput,
): Promise<CreateTrackedMessageResult> {
  const html = typeof input.html === 'string' ? input.html : '';
  const fallback: CreateTrackedMessageResult = { id: '', html, tracked: false };
  try {
    const secret = trackSecret();
    if (!secret) return fallback;
    if (!input.projectId || !input.objectSlug || !input.recordId) return fallback;
    if (html.trim() === '') return fallback;

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    const doc: Omit<EmailTrackDoc, '_id'> = {
      projectId: input.projectId,
      objectSlug: input.objectSlug,
      recordId: input.recordId,
      to: input.to?.trim() || undefined,
      subject: input.subject?.trim() || undefined,
      status: 'sent',
      events: [],
      openCount: 0,
      clickCount: 0,
      createdAt: now,
    };
    const res = await db.collection(EVENTS_COLL).insertOne(doc);
    const id = idHex(res.insertedId);

    const token = signToken(
      { mid: id, pid: input.projectId, iat: Date.now() } as TrackingToken,
      secret,
    );
    const instrumented = injectTracking(html, token, appBaseUrl());
    return { id, html: instrumented, tracked: true };
  } catch {
    return fallback; // best-effort — never block a send
  }
}

/* -------------------------------------------------------------------------- */
/* Record (open / click)                                                       */
/* -------------------------------------------------------------------------- */

/** Verify a token + load its (tenant-scoped) doc. Null on any mismatch. */
async function resolveTokenDoc(
  db: Db,
  token: string,
): Promise<{ payload: TrackingToken; doc: EmailTrackDoc } | null> {
  const secret = trackSecret();
  if (!secret) return null;
  const payload = verifyToken(token, secret);
  if (!payload) return null;
  if (!ObjectId.isValid(payload.mid)) return null;
  const doc = (await db.collection(EVENTS_COLL).findOne({
    _id: new ObjectId(payload.mid),
    projectId: payload.pid, // token-bound tenant guard
  })) as EmailTrackDoc | null;
  if (!doc) return null;
  return { payload, doc };
}

/**
 * Best-effort: stamp a compact scalar summary onto the source record using
 * dotted `$set` paths only (no `updatedAt` bump) — the AI-fields / scoring
 * scalar envelope. Visible to both stores. Swallows all errors.
 */
async function stampRecordSummary(
  db: Db,
  doc: EmailTrackDoc,
  kind: 'open' | 'click',
  at: string,
): Promise<void> {
  try {
    if (!ObjectId.isValid(doc.recordId)) return;
    const day = at.slice(0, 10);
    const summary = kind === 'click' ? `clicked ${day}` : `opened ${day}`;
    await db.collection(RECORDS_COLL).updateOne(
      { _id: new ObjectId(doc.recordId), projectId: doc.projectId },
      {
        $set: {
          [`data.${EMAIL_LAST_EVENT_FIELD}`]: summary,
          [`data.${EMAIL_TRACK_META}`]: {
            lastEvent: kind,
            lastEventAt: at,
            messageId: idHex(doc._id),
          },
        },
      },
    );
  } catch {
    /* best-effort */
  }
}

/** Best-effort CRM timeline activity for an open/click. Swallows all errors. */
async function logTrackingActivity(
  doc: EmailTrackDoc,
  kind: 'open' | 'click',
  url?: string,
): Promise<void> {
  try {
    const subject = doc.subject ? `"${doc.subject}"` : 'an email';
    const title =
      kind === 'click'
        ? `Recipient clicked a link in ${subject}`
        : `Recipient opened ${subject}`;
    const body =
      kind === 'click' && url
        ? `Clicked: ${url}${doc.to ? `\nRecipient: ${doc.to}` : ''}`
        : doc.to
          ? `Recipient: ${doc.to}`
          : '';
    await createActivity({
      projectId: doc.projectId,
      type: 'EMAIL',
      title,
      body,
      targetObject: doc.objectSlug,
      targetRecordId: doc.recordId,
      authorId: SYSTEM_AUTHOR,
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Record an open hit for a signed token (called by the pixel route). De-dupes
 * repeat opens fired within {@link OPEN_DEDUPE_WINDOW_MS} of the last open.
 * Best-effort — returns false (never throws) on any failure so the route can
 * still return its GIF.
 */
export async function recordOpen(token: string, ua?: string): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    const resolved = await resolveTokenDoc(db, token);
    if (!resolved) return false;
    const { doc } = resolved;

    const now = new Date().toISOString();
    const last = [...(doc.events ?? [])]
      .reverse()
      .find((e) => e.type === 'open');
    if (
      last &&
      Date.now() - new Date(last.at).getTime() < OPEN_DEDUPE_WINDOW_MS
    ) {
      return true; // collapse rapid re-fetches (mail-client prefetch, etc.)
    }

    const event: EmailTrackEvent = { type: 'open', at: now };
    if (ua) event.ua = ua.slice(0, 256);

    const wasFirst = (doc.openCount ?? 0) === 0;
    await db.collection<EmailTrackDoc>(EVENTS_COLL).updateOne(
      { _id: new ObjectId(idHex(doc._id)), projectId: doc.projectId },
      {
        $push: { events: event },
        $inc: { openCount: 1 },
        $set: {
          lastEventAt: now,
          // 'opened' must not clobber a stronger 'clicked' status.
          ...(doc.status === 'clicked' ? {} : { status: 'opened' as const }),
        },
      },
    );

    if (wasFirst) {
      await stampRecordSummary(db, doc, 'open', now);
      await logTrackingActivity(doc, 'open');
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Record a click hit for a signed token (called by the click route, before the
 * redirect). Best-effort — returns false (never throws) so the route can still
 * redirect to the original URL.
 */
export async function recordClick(
  token: string,
  url: string,
  ua?: string,
): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    const resolved = await resolveTokenDoc(db, token);
    if (!resolved) return false;
    const { doc } = resolved;

    const now = new Date().toISOString();
    const event: EmailTrackEvent = { type: 'click', at: now };
    if (url) event.url = url.slice(0, 2048);
    if (ua) event.ua = ua.slice(0, 256);

    const wasFirstClick = (doc.clickCount ?? 0) === 0;
    await db.collection<EmailTrackDoc>(EVENTS_COLL).updateOne(
      { _id: new ObjectId(idHex(doc._id)), projectId: doc.projectId },
      {
        $push: { events: event },
        $inc: { clickCount: 1 },
        $set: { status: 'clicked' as const, lastEventAt: now },
      },
    );

    if (wasFirstClick) {
      await stampRecordSummary(db, doc, 'click', now);
      await logTrackingActivity(doc, 'click', url);
    }
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Read (settings view)                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The most recent tracked messages for a project (newest event first, then
 * newest created). Powers the settings "Recent activity" view.
 */
export async function listRecentTrackedMessages(
  projectId: string,
  limit = 50,
): Promise<EmailTrackMessage[]> {
  if (!projectId) return [];
  try {
    const { db } = await connectToDatabase();
    const docs = (await db
      .collection(EVENTS_COLL)
      .find({ projectId })
      .sort({ lastEventAt: -1, createdAt: -1 })
      .limit(Math.min(Math.max(1, limit), 200))
      .toArray()) as unknown as EmailTrackDoc[];
    return docs.map(toMessage);
  } catch {
    return [];
  }
}

/** Open/click totals for a project's tracked mail (settings header). */
export async function trackingStats(projectId: string): Promise<{
  messages: number;
  opened: number;
  clicked: number;
}> {
  const empty = { messages: 0, opened: 0, clicked: 0 };
  if (!projectId) return empty;
  try {
    const { db } = await connectToDatabase();
    const col = db.collection(EVENTS_COLL);
    const [messages, opened, clicked] = await Promise.all([
      col.countDocuments({ projectId }),
      col.countDocuments({ projectId, openCount: { $gt: 0 } }),
      col.countDocuments({ projectId, clickCount: { $gt: 0 } }),
    ]);
    return { messages, opened, clicked };
  } catch {
    return empty;
  }
}
