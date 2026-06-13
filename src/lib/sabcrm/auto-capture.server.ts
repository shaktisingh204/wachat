import 'server-only';

/**
 * SabCRM — activity auto-capture runtime (server-only).
 *
 * Automatically logs inbound email + calendar events as CRM activities on the
 * matching person/lead record, killing the manual-logging tax. The pure
 * shaping + matching live in `./auto-capture.ts` (re-exported here); this layer
 * does the I/O:
 *
 *  - {@link captureInboundEmail} — matches a message's sender against record
 *    EMAIL / EMAILS fields (via the Rust path — two-store gotcha) and creates
 *    one EMAIL activity per matched record.
 *  - {@link captureCalendarEvents} — pulls recent events from the user's
 *    primary Google Calendar (same `crm_google_calendar_settings` store +
 *    refresh dance as `@/lib/integrations/google-calendar`) and creates a
 *    MEETING activity per matched attendee record.
 *
 * Both are **idempotent** and **best-effort**: every captured activity is
 * stamped with `externalSource` + `externalId` (Message-Id / Google event id)
 * and a `(projectId, externalSource, externalId)` lookup guards re-delivery and
 * repeated cron pulls. Nothing here throws — failures degrade to a `{ … }`
 * report so the inbound webhook / cron tick stays healthy.
 *
 * Config (the on/off toggle + last-run) lives in `sabcrm_autocapture_config`
 * (projectId-scoped, the native config pattern of `./formula.server.ts`). A
 * config doc MAY bump its own `updatedAt`; the activity inserts go to
 * `sabcrm_activities` (which the Rust activities engine fronts) — they are not
 * `data.*` record scalars, so the no-`updatedAt`-bump records rule does not
 * apply to them.
 */

import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { rustFetchAs } from '@/lib/rust-client/fetcher';
import type { ObjectMetadata } from '@/lib/sabcrm/types';
import {
  matchRecordByEmail,
  buildActivityFromEmail,
  buildActivityFromCalendarEvent,
  normalizeEmail,
  type AutoCaptureEmail,
  type AutoCaptureSource,
  type ActivityDraft,
  type MatchCandidate,
  type AutoCaptureCalendarEvent,
} from './auto-capture';

export {
  matchRecordByEmail,
  buildActivityFromEmail,
  buildActivityFromCalendarEvent,
  normalizeEmail,
  htmlToText,
  type AutoCaptureEmail,
  type AutoCaptureCalendarEvent,
  type AutoCaptureSource,
  type ActivityDraft,
  type MatchCandidate,
  type MatchResult,
  type AutoCaptureActivityType,
} from './auto-capture';

const CONFIG_COLL = 'sabcrm_autocapture_config';
const ACTIVITIES_COLL = 'sabcrm_activities';
const CAL_SETTINGS_COLL = 'crm_google_calendar_settings';

/** Per-object record-match cap (mirrors `email-inbound.ts`). */
const PER_OBJECT_LIMIT = 5;
/** Hard cap on activities per single inbound message / event. */
const MAX_ACTIVITIES = 10;
/** Calendar pull window + page size. */
const CAL_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
const CAL_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;
const CAL_MAX_EVENTS = 50;

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/* -------------------------------------------------------------------------- */
/* Config (toggle + last-run)                                                  */
/* -------------------------------------------------------------------------- */

/** Persisted auto-capture config for one project. */
export interface AutoCaptureConfig {
  projectId: string;
  /** Master switch. Absent doc ⇒ disabled (opt-in). */
  enabled: boolean;
  /** Capture inbound email onto records. */
  captureEmail: boolean;
  /** Capture Google Calendar events onto records. */
  captureCalendar: boolean;
  /** ISO of the last successful calendar pull (null until first run). */
  lastCalendarRunAt: string | null;
  /** Activities created on the last calendar pull. */
  lastCalendarCaptured: number;
  /** ISO of the last inbound-email capture attempt. */
  lastEmailRunAt: string | null;
  updatedAt: string;
}

export interface AutoCaptureConfigInput {
  enabled?: boolean;
  captureEmail?: boolean;
  captureCalendar?: boolean;
}

interface ConfigDoc {
  _id?: ObjectId | string;
  projectId: string;
  enabled?: boolean;
  captureEmail?: boolean;
  captureCalendar?: boolean;
  lastCalendarRunAt?: string | null;
  lastCalendarCaptured?: number;
  lastEmailRunAt?: string | null;
  updatedAt?: string;
}

function toConfig(doc: ConfigDoc | null, projectId: string): AutoCaptureConfig {
  return {
    projectId,
    enabled: doc?.enabled === true,
    captureEmail: doc?.captureEmail !== false,
    captureCalendar: doc?.captureCalendar !== false,
    lastCalendarRunAt: doc?.lastCalendarRunAt ?? null,
    lastCalendarCaptured: doc?.lastCalendarCaptured ?? 0,
    lastEmailRunAt: doc?.lastEmailRunAt ?? null,
    updatedAt: doc?.updatedAt ?? '',
  };
}

/** Read the project's config (defaults applied; never throws). */
export async function getAutoCaptureConfig(
  projectId: string,
): Promise<AutoCaptureConfig> {
  if (!projectId) return toConfig(null, projectId);
  try {
    const { db } = await connectToDatabase();
    const doc = (await db
      .collection(CONFIG_COLL)
      .findOne({ projectId })) as ConfigDoc | null;
    return toConfig(doc, projectId);
  } catch {
    return toConfig(null, projectId);
  }
}

/** Upsert the project's toggle config (config collection MAY bump updatedAt). */
export async function saveAutoCaptureConfig(
  projectId: string,
  input: AutoCaptureConfigInput,
): Promise<AutoCaptureConfig> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updatedAt: now };
  if (input.enabled !== undefined) set.enabled = input.enabled;
  if (input.captureEmail !== undefined) set.captureEmail = input.captureEmail;
  if (input.captureCalendar !== undefined) {
    set.captureCalendar = input.captureCalendar;
  }
  await db
    .collection(CONFIG_COLL)
    .updateOne(
      { projectId },
      { $set: set, $setOnInsert: { projectId } },
      { upsert: true },
    );
  return getAutoCaptureConfig(projectId);
}

/** Projects with auto-capture enabled (used by the cron sweep). */
export async function listProjectsWithAutoCapture(db: Db): Promise<string[]> {
  try {
    const ids = (await db
      .collection(CONFIG_COLL)
      .distinct('projectId', { enabled: true })) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Shared: candidate resolution + idempotent activity insert                   */
/* -------------------------------------------------------------------------- */

interface ObjectsEnvelope {
  objects: ObjectMetadata[];
}
interface RecordsEnvelope {
  records: Array<{ _id?: string; id?: string }>;
  total?: number;
}

/** Object slug → email-bearing field keys, via the Rust object surface. */
async function emailBearingObjects(
  userId: string,
  projectId: string,
): Promise<Array<{ slug: string; keys: string[] }>> {
  const { objects } = await rustFetchAs<ObjectsEnvelope>(
    userId,
    `/v1/sabcrm/objects?projectId=${encodeURIComponent(projectId)}`,
  );
  return (objects ?? [])
    .map((o) => ({
      slug: o.slug,
      keys: (o.fields ?? [])
        .filter((f) => f.type === 'EMAIL' || f.type === 'EMAILS')
        .map((f) => f.key),
    }))
    .filter((o) => o.keys.length > 0);
}

/**
 * Resolve the candidate records that hold `email` (across every email-bearing
 * object), as {@link MatchCandidate}s the pure matcher confirms. Reads go
 * through the Rust records path (two-store gotcha) using a `contains` OR over
 * each object's email keys + the EMAILS `primaryEmail` sub-path.
 */
async function resolveCandidates(
  userId: string,
  projectId: string,
  objects: Array<{ slug: string; keys: string[] }>,
  email: string,
): Promise<MatchCandidate[]> {
  const addr = normalizeEmail(email);
  if (!addr) return [];
  const out: MatchCandidate[] = [];
  for (const obj of objects) {
    if (out.length >= MAX_ACTIVITIES) break;
    const conditions = obj.keys.flatMap((k) => [
      { field: k, operator: 'contains', value: addr },
      { field: `${k}.primaryEmail`, operator: 'contains', value: addr },
    ]);
    const filters = { op: 'or', conditions };
    try {
      const res = await rustFetchAs<RecordsEnvelope>(
        userId,
        `/v1/sabcrm/records/${encodeURIComponent(obj.slug)}?projectId=${encodeURIComponent(
          projectId,
        )}&limit=${PER_OBJECT_LIMIT}&filters=${encodeURIComponent(
          JSON.stringify(filters),
        )}`,
      );
      for (const r of res.records ?? []) {
        const id = String(r._id ?? r.id ?? '');
        // The engine `contains`-matched the address; the pure matcher treats
        // these records as carrying `addr` (the only address we queried for).
        if (id) out.push({ object: obj.slug, recordId: id, emails: [addr] });
      }
    } catch {
      /* one object failing must not sink the rest */
    }
  }
  return out;
}

/**
 * Idempotently persist a draft onto every matched record. Dedup key is
 * `(projectId, externalSource, externalId)`; a draft with an empty
 * `externalId` is skipped (cannot dedup safely). Direct `sabcrm_activities`
 * insert (so we can stamp the external-id provenance the Rust DTO ignores) —
 * the activities engine reads these rows unchanged. Returns activities created.
 */
async function persistDraft(
  projectId: string,
  authorId: string,
  draft: ActivityDraft,
  matches: Array<{ object: string; recordId: string }>,
): Promise<number> {
  if (!draft.externalId || matches.length === 0) return 0;
  let created = 0;
  try {
    const { db } = await connectToDatabase();
    const coll = db.collection(ACTIVITIES_COLL);
    const now = new Date();
    for (const m of matches.slice(0, MAX_ACTIVITIES)) {
      try {
        const existing = await coll.findOne({
          projectId,
          targetObject: m.object,
          targetRecordId: m.recordId,
          externalSource: draft.externalSource,
          externalId: draft.externalId,
        });
        if (existing) continue;
        await coll.insertOne({
          projectId,
          type: draft.type,
          title: draft.title,
          body: draft.body,
          targetObject: m.object,
          targetRecordId: m.recordId,
          authorId,
          // Provenance — dedup key + audit; ignored by the activities DTO.
          externalSource: draft.externalSource,
          externalId: draft.externalId,
          autoCaptured: true,
          occurredAt: draft.occurredAt ?? null,
          createdAt: now,
          updatedAt: now,
        });
        created += 1;
      } catch {
        /* non-fatal per record */
      }
    }
  } catch {
    /* best-effort */
  }
  return created;
}

/* -------------------------------------------------------------------------- */
/* Inbound email                                                               */
/* -------------------------------------------------------------------------- */

export interface CaptureEmailResult {
  captured: boolean;
  matchedRecords: number;
  activitiesLogged: number;
  reason?: string;
}

/**
 * Capture one inbound email onto its matching person/lead record(s).
 * Idempotent on the Message-Id. Best-effort — never throws.
 *
 * Wire this into the inbound-email path additively (see the route snippet in
 * the vertical's registry). Skips silently when the project hasn't enabled
 * email capture.
 */
export async function captureInboundEmail(
  projectId: string,
  msg: AutoCaptureEmail,
  identity?: { userId?: string },
): Promise<CaptureEmailResult> {
  const none = (reason: string): CaptureEmailResult => ({
    captured: false,
    matchedRecords: 0,
    activitiesLogged: 0,
    reason,
  });
  try {
    if (!projectId) return none('no-project');
    const draft = buildActivityFromEmail(msg);
    if (!draft.externalId) return none('no-message-id');
    if (draft.matchEmails.length === 0) return none('invalid-from');

    const cfg = await getAutoCaptureConfig(projectId);
    if (!cfg.enabled || !cfg.captureEmail) return none('disabled');

    const userId = identity?.userId ?? (await resolveProjectOwner(projectId));
    if (!userId) return none('no-owner');

    const objects = await emailBearingObjects(userId, projectId);
    if (objects.length === 0) return none('no-email-objects');

    const from = draft.matchEmails[0];
    const candidates = await resolveCandidates(userId, projectId, objects, from);
    const matches = matchRecordByEmail(from, candidates);
    if (matches.length === 0) return none('no-match');

    const logged = await persistDraft(projectId, userId, draft, matches);
    await markEmailRun(projectId);
    return {
      captured: logged > 0,
      matchedRecords: matches.length,
      activitiesLogged: logged,
      reason: logged > 0 ? undefined : 'already-captured',
    };
  } catch (e) {
    return none(e instanceof Error ? e.message : 'capture-failed');
  }
}

/* -------------------------------------------------------------------------- */
/* Calendar                                                                    */
/* -------------------------------------------------------------------------- */

interface CalSettingsDoc {
  _id: ObjectId;
  userId: ObjectId;
  client_id?: string;
  client_secret?: string;
  enabled?: boolean;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;
}

interface GoogleEventsList {
  items?: AutoCaptureCalendarEvent[];
}

/** Refresh + return a usable access token for `userId`'s calendar, or null. */
async function getCalendarToken(
  db: Db,
  userId: string,
): Promise<string | null> {
  if (!ObjectId.isValid(userId)) return null;
  const setting = (await db
    .collection<CalSettingsDoc>(CAL_SETTINGS_COLL)
    .findOne({ userId: new ObjectId(userId) })) as CalSettingsDoc | null;
  if (!setting || setting.enabled === false) return null;

  const fresh =
    setting.token_expires_at instanceof Date &&
    setting.token_expires_at.getTime() > Date.now() + 60_000;
  if (setting.access_token && fresh) return setting.access_token;

  if (!setting.refresh_token || !setting.client_id || !setting.client_secret) {
    return setting.access_token ?? null;
  }
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: setting.client_id,
        client_secret: setting.client_secret,
        refresh_token: setting.refresh_token,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!res.ok) return setting.access_token ?? null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return setting.access_token ?? null;
    const expiresAt = new Date(Date.now() + ((json.expires_in ?? 3600) - 60) * 1000);
    await db
      .collection(CAL_SETTINGS_COLL)
      .updateOne(
        { _id: setting._id },
        { $set: { access_token: json.access_token, token_expires_at: expiresAt, updatedAt: new Date() } },
      );
    return json.access_token;
  } catch {
    return setting.access_token ?? null;
  }
}

/** Pull recent + imminent events from `userId`'s primary calendar. */
async function fetchRecentEvents(
  token: string,
): Promise<AutoCaptureCalendarEvent[]> {
  const now = Date.now();
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(CAL_MAX_EVENTS),
    timeMin: new Date(now - CAL_LOOKBACK_MS).toISOString(),
    timeMax: new Date(now + CAL_LOOKAHEAD_MS).toISOString(),
  });
  try {
    const res = await fetch(`${CAL_EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as GoogleEventsList;
    return (json.items ?? []).filter((e) => e?.id && e.status !== 'cancelled');
  } catch {
    return [];
  }
}

export interface CaptureCalendarResult {
  captured: boolean;
  eventsScanned: number;
  activitiesLogged: number;
  reason?: string;
}

/**
 * Pull recent Google Calendar events for `userId` and log a MEETING activity
 * per matched attendee record. Idempotent on the Google event id; best-effort.
 * `userId` owns the calendar connection; `projectId` scopes the records +
 * config. Skips when calendar capture is disabled for the project.
 */
export async function captureCalendarEvents(
  projectId: string,
  userId: string,
): Promise<CaptureCalendarResult> {
  const none = (reason: string): CaptureCalendarResult => ({
    captured: false,
    eventsScanned: 0,
    activitiesLogged: 0,
    reason,
  });
  try {
    if (!projectId || !userId) return none('bad-args');
    const cfg = await getAutoCaptureConfig(projectId);
    if (!cfg.enabled || !cfg.captureCalendar) return none('disabled');

    const { db } = await connectToDatabase();
    const token = await getCalendarToken(db, userId);
    if (!token) return none('not-connected');

    const events = await fetchRecentEvents(token);
    if (events.length === 0) {
      await markCalendarRun(projectId, 0);
      return { captured: false, eventsScanned: 0, activitiesLogged: 0, reason: 'no-events' };
    }

    const objects = await emailBearingObjects(userId, projectId);
    if (objects.length === 0) {
      await markCalendarRun(projectId, 0);
      return none('no-email-objects');
    }

    let logged = 0;
    for (const evt of events) {
      const draft = buildActivityFromCalendarEvent(evt);
      if (!draft.externalId || draft.matchEmails.length === 0) continue;
      // Resolve candidates across every counterpart address. Each resolved
      // candidate is already a confirmed match (the engine `contains`-matched
      // the address it was queried for, and the pure matcher re-confirms per
      // address inside resolveCandidates' query). Dedup the union by record.
      const allCandidates: MatchCandidate[] = [];
      for (const addr of draft.matchEmails) {
        const resolved = await resolveCandidates(userId, projectId, objects, addr);
        for (const c of resolved) {
          // Confirm via the pure matcher against this candidate's address.
          if (matchRecordByEmail(addr, [c]).length > 0) allCandidates.push(c);
        }
      }
      const matches = dedupMatches(allCandidates);
      logged += await persistDraft(projectId, userId, draft, matches);
    }
    await markCalendarRun(projectId, logged);
    return {
      captured: logged > 0,
      eventsScanned: events.length,
      activitiesLogged: logged,
      reason: logged > 0 ? undefined : 'no-match',
    };
  } catch (e) {
    return none(e instanceof Error ? e.message : 'capture-failed');
  }
}

/** Distinct `(object, recordId)` from a candidate list. */
function dedupMatches(
  candidates: MatchCandidate[],
): Array<{ object: string; recordId: string }> {
  const seen = new Set<string>();
  const out: Array<{ object: string; recordId: string }> = [];
  for (const c of candidates) {
    const key = `${c.object}::${c.recordId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ object: c.object, recordId: c.recordId });
  }
  return out;
}

/**
 * Sweep every auto-capture-enabled project's calendar (cron entrypoint). For
 * each project, resolves the owning user (the calendar-connection holder) and
 * pulls their events. Best-effort; returns a per-project report.
 */
export async function captureCalendarForAllProjects(): Promise<
  Array<{ projectId: string; activitiesLogged: number; reason?: string }>
> {
  const out: Array<{ projectId: string; activitiesLogged: number; reason?: string }> = [];
  try {
    const { db } = await connectToDatabase();
    const projectIds = await listProjectsWithAutoCapture(db);
    for (const projectId of projectIds) {
      const userId = await resolveProjectOwner(projectId);
      if (!userId) {
        out.push({ projectId, activitiesLogged: 0, reason: 'no-owner' });
        continue;
      }
      const res = await captureCalendarEvents(projectId, userId);
      out.push({ projectId, activitiesLogged: res.activitiesLogged, reason: res.reason });
    }
  } catch {
    /* best-effort */
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** The owning user id of a project (the default actor for captured rows). */
async function resolveProjectOwner(projectId: string): Promise<string | null> {
  try {
    if (!ObjectId.isValid(projectId)) return null;
    const { db } = await connectToDatabase();
    const project = await db
      .collection('projects')
      .findOne({ _id: new ObjectId(projectId) }, { projection: { userId: 1 } });
    return project?.userId ? String(project.userId) : null;
  } catch {
    return null;
  }
}

async function markCalendarRun(projectId: string, captured: number): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    await db
      .collection(CONFIG_COLL)
      .updateOne(
        { projectId },
        {
          $set: {
            lastCalendarRunAt: new Date().toISOString(),
            lastCalendarCaptured: captured,
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: { projectId },
        },
        { upsert: true },
      );
  } catch {
    /* best-effort */
  }
}

async function markEmailRun(projectId: string): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    await db
      .collection(CONFIG_COLL)
      .updateOne(
        { projectId },
        {
          $set: { lastEmailRunAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          $setOnInsert: { projectId },
        },
        { upsert: true },
      );
  } catch {
    /* best-effort */
  }
}
