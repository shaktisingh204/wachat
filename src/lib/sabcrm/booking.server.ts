import 'server-only';

/**
 * SabCRM — Calendly-class booking links runtime (server-only).
 *
 * Persists booking-link configs in `sabcrm_booking_links` (projectId-scoped,
 * the native-Mongo config pattern of `./scoring.server.ts`) and turns a public
 * booking into a real CRM record + a timeline ACTIVITY (and, when the link's
 * owner has connected Google Calendar, a calendar event on their primary
 * calendar). The pure slot math lives in `./booking.ts`, re-exported here so
 * callers only import from this file.
 *
 * ## Availability
 *
 * {@link getAvailability} expands the link's weekly availability over the
 * requested day range (pure `computeSlots`). When the link's owner has a
 * connected, enabled Google-Calendar integration we additionally pull their
 * BUSY intervals via the Calendar freeBusy API and exclude overlapping slots;
 * if Calendar is not connected (or unreachable) we fall back to config-only
 * availability. Reusing `src/lib/integrations/google-calendar.ts`'s token
 * storage (`crm_google_calendar_settings`, keyed by `userId`) — no new OAuth.
 *
 * ## Booking write
 *
 * {@link createBooking} re-validates the requested slot against the link's
 * live availability (defending the UNGATED public path against a forged time),
 * then:
 *   1. upserts/creates a record on the link's `objectSlug` (a Contact/Lead,
 *      with the requester's name/email/phone written to plain `data.*` keys);
 *   2. creates a MEETING timeline activity on that record (`./activities.server`);
 *   3. best-effort pushes a calendar event to the owner's primary calendar.
 *
 * Everything tenant-scoped through the owning link's stored `projectId` +
 * `ownerUserId`; the public caller can never choose a tenant. Calendar and
 * activity failures NEVER block the booking — they degrade gracefully.
 */

import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { createRecord } from './records.server';
import { createActivity } from './activities.server';
import { pushToCalendar } from '@/lib/integrations/google-calendar';
import {
  computeSlots,
  findSlot,
  defaultWeeklyAvailability,
  slugify,
  type WeeklyAvailability,
  type BusyInterval,
  type BookingSlot,
  type DateRange,
} from './booking';

export {
  computeSlots,
  findSlot,
  defaultWeeklyAvailability,
  slugify,
  type WeeklyAvailability,
  type AvailabilityWindow,
  type BusyInterval,
  type BookingSlot,
  type DateRange,
  type ComputeSlotsInput,
} from './booking';

const LINKS_COLL = 'sabcrm_booking_links';
const GCAL_COLL = 'crm_google_calendar_settings';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Hard cap on how many days a single availability query may span. */
const MAX_RANGE_DAYS = 62;

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** Persisted booking-link config (the doc shape minus the Mongo `_id`). */
export interface BookingLink {
  id: string;
  projectId: string;
  /** The CRM user whose calendar + ownership this link books against. */
  ownerUserId: string;
  /** Public URL token, unique per project. */
  slug: string;
  name: string;
  description?: string;
  enabled: boolean;
  durationMins: number;
  /** Per-weekday open windows (link-local wall-clock). */
  weeklyAvailability: WeeklyAvailability;
  /** IANA timezone the windows are expressed in. */
  tz: string;
  /** Object slug a booking creates a record on (e.g. `people`, `leads`). */
  objectSlug: string;
  /** How far ahead bookings are offered, in days. Default 30. */
  rangeDays: number;
  /** Minutes between offered slots. Defaults to `durationMins`. */
  stepMins?: number;
  /** Push a Google Calendar event on booking when the owner is connected. */
  pushCalendar: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Shape accepted by the save action (server stamps id / timestamps / project). */
export interface BookingLinkInput {
  /** Present → update; absent → insert. */
  id?: string;
  slug?: string;
  name: string;
  description?: string;
  enabled?: boolean;
  durationMins: number;
  weeklyAvailability?: WeeklyAvailability;
  tz: string;
  objectSlug: string;
  rangeDays?: number;
  stepMins?: number;
  pushCalendar?: boolean;
}

/** A sanitised view of a link safe to expose on the PUBLIC booking page. */
export interface PublicBookingLink {
  slug: string;
  name: string;
  description?: string;
  durationMins: number;
  tz: string;
}

/** Contact details a public visitor supplies when booking. */
export interface BookingContact {
  name: string;
  email: string;
  phone?: string;
  /** Optional free-form note from the booker. */
  note?: string;
}

/** Confirmation returned by {@link createBooking}. */
export interface BookingConfirmation {
  slot: BookingSlot;
  recordId: string;
  activityId: string;
  /** Set when a calendar event was created on the owner's calendar. */
  googleEventId?: string;
  /** The link name + owner timezone, for the confirmation screen. */
  linkName: string;
  tz: string;
}

interface BookingLinkDoc {
  _id: ObjectId | string;
  projectId: string;
  ownerUserId: string;
  slug: string;
  name: string;
  description?: string;
  enabled?: boolean;
  durationMins?: number;
  weeklyAvailability?: WeeklyAvailability;
  tz?: string;
  objectSlug?: string;
  rangeDays?: number;
  stepMins?: number;
  pushCalendar?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/* -------------------------------------------------------------------------- */
/* Mapping helpers                                                             */
/* -------------------------------------------------------------------------- */

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toLink(doc: BookingLinkDoc): BookingLink {
  const wa =
    doc.weeklyAvailability && typeof doc.weeklyAvailability === 'object'
      ? doc.weeklyAvailability
      : defaultWeeklyAvailability();
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    ownerUserId: doc.ownerUserId,
    slug: doc.slug,
    name: doc.name || 'Booking',
    description: doc.description || undefined,
    enabled: doc.enabled !== false,
    durationMins:
      Number.isFinite(doc.durationMins) && (doc.durationMins as number) > 0
        ? Number(doc.durationMins)
        : 30,
    weeklyAvailability: wa,
    tz: doc.tz || 'UTC',
    objectSlug: doc.objectSlug || 'people',
    rangeDays:
      Number.isFinite(doc.rangeDays) && (doc.rangeDays as number) > 0
        ? Math.min(Number(doc.rangeDays), 365)
        : 30,
    stepMins:
      Number.isFinite(doc.stepMins) && (doc.stepMins as number) > 0
        ? Number(doc.stepMins)
        : undefined,
    pushCalendar: doc.pushCalendar !== false,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/** Strip a link to the public, secret-free view. */
export function toPublicLink(link: BookingLink): PublicBookingLink {
  return {
    slug: link.slug,
    name: link.name,
    description: link.description,
    durationMins: link.durationMins,
    tz: link.tz,
  };
}

/** Today as `YYYY-MM-DD` (UTC) — the default availability range start. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` `n` days after `from`. */
function addDaysKey(from: string, n: number): string {
  const base = Date.parse(`${from}T00:00:00Z`);
  return new Date(base + n * 86_400_000).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* Config CRUD                                                                 */
/* -------------------------------------------------------------------------- */

/** All booking links for a project (newest first). */
export async function listBookingLinks(projectId: string): Promise<BookingLink[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(LINKS_COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray()) as unknown as BookingLinkDoc[];
  return docs.map(toLink);
}

/** One link by id (scoped to the project), or null. */
export async function getBookingLink(
  projectId: string,
  id: string,
): Promise<BookingLink | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(LINKS_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as BookingLinkDoc | null;
  return doc ? toLink(doc) : null;
}

/**
 * One link by its public slug — used by the UNGATED public booking surface.
 * Resolves across ALL projects (slug carries its own tenant); only ENABLED
 * links are returned so a disabled link 404s publicly. Slugs are unique per
 * project; on the rare cross-project collision we return the newest.
 */
export async function getBookingLinkBySlug(slug: string): Promise<BookingLink | null> {
  const s = slugify(slug);
  if (!s) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(LINKS_COLL)
    .find({ slug: s, enabled: { $ne: false } })
    .sort({ updatedAt: -1 })
    .limit(1)
    .next()) as BookingLinkDoc | null;
  return doc ? toLink(doc) : null;
}

/** True when `slug` is free in the project (optionally excluding `exceptId`). */
async function slugAvailable(
  db: Db,
  projectId: string,
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  const q: Record<string, unknown> = { projectId, slug };
  if (exceptId && ObjectId.isValid(exceptId)) {
    q._id = { $ne: new ObjectId(exceptId) };
  }
  const existing = await db.collection(LINKS_COLL).findOne(q);
  return !existing;
}

/**
 * Insert (no id) or update (valid id) a booking link; returns the saved shape.
 * The slug is derived from `input.slug || input.name`, slugified, and made
 * unique within the project by appending a short suffix on collision.
 */
export async function upsertBookingLink(
  projectId: string,
  ownerUserId: string,
  input: BookingLinkInput,
): Promise<BookingLink> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();

  let slug = slugify(input.slug || input.name) || `book-${Date.now().toString(36)}`;
  if (!(await slugAvailable(db, projectId, slug, input.id))) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const duration =
    Number.isFinite(input.durationMins) && input.durationMins > 0
      ? Math.min(Math.round(input.durationMins), 24 * 60)
      : 30;
  const wa =
    input.weeklyAvailability && typeof input.weeklyAvailability === 'object'
      ? input.weeklyAvailability
      : defaultWeeklyAvailability();

  const fields = {
    slug,
    name: input.name?.trim() || 'Booking',
    description: input.description?.trim() || undefined,
    enabled: input.enabled !== false,
    durationMins: duration,
    weeklyAvailability: wa,
    tz: input.tz?.trim() || 'UTC',
    objectSlug: input.objectSlug?.trim() || 'people',
    rangeDays:
      Number.isFinite(input.rangeDays) && (input.rangeDays as number) > 0
        ? Math.min(Number(input.rangeDays), 365)
        : 30,
    stepMins:
      Number.isFinite(input.stepMins) && (input.stepMins as number) > 0
        ? Number(input.stepMins)
        : undefined,
    pushCalendar: input.pushCalendar !== false,
    updatedAt: now,
  };

  if (input.id && ObjectId.isValid(input.id)) {
    await db.collection(LINKS_COLL).updateOne(
      { _id: new ObjectId(input.id), projectId },
      { $set: fields, $setOnInsert: { createdAt: now, projectId, ownerUserId } },
      { upsert: true },
    );
    const saved = await getBookingLink(projectId, input.id);
    if (saved) return saved;
  }

  const res = await db
    .collection(LINKS_COLL)
    .insertOne({ projectId, ownerUserId, createdAt: now, ...fields });
  return toLink({ _id: res.insertedId, projectId, ownerUserId, createdAt: now, ...fields });
}

/** Delete a booking link by id. Returns true when a doc was removed. */
export async function deleteBookingLink(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(LINKS_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* Google Calendar busy times (reuses the existing OAuth token storage)        */
/* -------------------------------------------------------------------------- */

interface GcalSettingDoc {
  _id: ObjectId;
  userId: ObjectId;
  client_id?: string;
  client_secret?: string;
  enabled?: boolean;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;
}

/** Refresh + return a valid access token for the owner, or null. Best-effort. */
async function ownerAccessToken(db: Db, ownerUserId: string): Promise<string | null> {
  try {
    if (!ObjectId.isValid(ownerUserId)) return null;
    const setting = (await db
      .collection(GCAL_COLL)
      .findOne({ userId: new ObjectId(ownerUserId) })) as GcalSettingDoc | null;
    if (!setting || setting.enabled === false) return null;

    const exp = setting.token_expires_at;
    const stale =
      !setting.access_token ||
      (exp instanceof Date && exp.getTime() <= Date.now() + 60_000);
    if (!stale && setting.access_token) return setting.access_token;

    if (!setting.refresh_token || !setting.client_id || !setting.client_secret) {
      return setting.access_token ?? null;
    }
    const body = new URLSearchParams({
      client_id: setting.client_id,
      client_secret: setting.client_secret,
      refresh_token: setting.refresh_token,
      grant_type: 'refresh_token',
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) return setting.access_token ?? null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return setting.access_token ?? null;
    const expiresAt = new Date(Date.now() + ((json.expires_in ?? 3600) - 60) * 1000);
    await db.collection(GCAL_COLL).updateOne(
      { _id: setting._id },
      { $set: { access_token: json.access_token, token_expires_at: expiresAt, updatedAt: new Date() } },
    );
    return json.access_token;
  } catch {
    return null;
  }
}

/**
 * Pull the owner's BUSY intervals from Google Calendar's freeBusy API for the
 * given window. Returns `[]` (config-only availability) when the owner is not
 * connected or the call fails — availability must degrade, never throw.
 */
export async function getOwnerBusy(
  ownerUserId: string,
  timeMinIso: string,
  timeMaxIso: string,
): Promise<BusyInterval[]> {
  try {
    const { db } = await connectToDatabase();
    const token = await ownerAccessToken(db, ownerUserId);
    if (!token) return [];
    const res = await fetch(FREEBUSY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: timeMinIso,
        timeMax: timeMaxIso,
        items: [{ id: 'primary' }],
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      calendars?: { primary?: { busy?: Array<{ start: string; end: string }> } };
    };
    const busy = json.calendars?.primary?.busy ?? [];
    return busy
      .filter((b) => typeof b?.start === 'string' && typeof b?.end === 'string')
      .map((b) => ({ start: b.start, end: b.end }));
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Availability                                                                */
/* -------------------------------------------------------------------------- */

/** Resolved availability for a public slug + day range. */
export interface AvailabilityResult {
  link: PublicBookingLink;
  slots: BookingSlot[];
  /** True when busy times were merged from a connected Google Calendar. */
  calendarConnected: boolean;
}

/**
 * Compute bookable slots for a public slug over `range` (clamped to the link's
 * `rangeDays` and `MAX_RANGE_DAYS`). Pulls Google-Calendar busy times when the
 * owner is connected, else config-only. Returns null when the slug is unknown
 * or disabled.
 */
export async function getAvailability(
  slug: string,
  range?: Partial<DateRange>,
): Promise<AvailabilityResult | null> {
  const link = await getBookingLinkBySlug(slug);
  if (!link) return null;

  const from = range?.from && /^\d{4}-\d{2}-\d{2}$/.test(range.from) ? range.from : todayKey();
  const requestedTo =
    range?.to && /^\d{4}-\d{2}-\d{2}$/.test(range.to)
      ? range.to
      : addDaysKey(from, link.rangeDays);
  // Clamp the span to the link's window + a hard ceiling.
  const ceiling = addDaysKey(from, Math.min(link.rangeDays, MAX_RANGE_DAYS));
  const to = requestedTo < ceiling ? requestedTo : ceiling;

  const timeMin = new Date(`${from}T00:00:00Z`).toISOString();
  const timeMax = new Date(`${to}T23:59:59Z`).toISOString();

  const busy = await getOwnerBusy(link.ownerUserId, timeMin, timeMax);

  const slots = computeSlots({
    weeklyAvailability: link.weeklyAvailability,
    durationMins: link.durationMins,
    dateRange: { from, to },
    busy,
    tz: link.tz,
    stepMins: link.stepMins,
  });

  return {
    link: toPublicLink(link),
    slots,
    calendarConnected: busy.length > 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Booking                                                                     */
/* -------------------------------------------------------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create a booking for a public slug at `slotIso` for `contact`. Re-validates
 * the slot against live availability (busy-aware), then creates a record +
 * MEETING activity (+ optional calendar event). Throws a user-facing Error on
 * validation failure; calendar/activity sub-failures are swallowed.
 */
export async function createBooking(
  slug: string,
  slotIso: string,
  contact: BookingContact,
): Promise<BookingConfirmation> {
  const link = await getBookingLinkBySlug(slug);
  if (!link) throw new Error('This booking link is not available.');

  const name = String(contact?.name ?? '').trim();
  const email = String(contact?.email ?? '').trim();
  if (!name) throw new Error('Your name is required.');
  if (!EMAIL_RE.test(email)) throw new Error('A valid email is required.');

  // Re-validate the slot is real + free (busy-aware), defending the public path.
  const slotDay = String(slotIso).slice(0, 10);
  const busy = await getOwnerBusy(
    link.ownerUserId,
    new Date(`${slotDay}T00:00:00Z`).toISOString(),
    new Date(`${slotDay}T23:59:59Z`).toISOString(),
  );
  const slot = findSlot(
    slotIso,
    {
      weeklyAvailability: link.weeklyAvailability,
      durationMins: link.durationMins,
      tz: link.tz,
      stepMins: link.stepMins,
    },
    busy,
  );
  if (!slot) throw new Error('That time is no longer available. Please pick another slot.');

  // 1. Create the CRM record (Contact / Lead) for the booker.
  const phone = String(contact?.phone ?? '').trim();
  const record = await createRecord(link.projectId, link.ownerUserId, link.objectSlug, {
    name,
    email,
    ...(phone ? { phone } : {}),
    bookingSource: link.slug,
  });

  // 2. Create a MEETING activity on the new record.
  const noteLine = contact?.note?.trim() ? `\n\nNote: ${contact.note.trim()}` : '';
  const when = new Date(slot.startIso);
  const title = `Booked: ${link.name}`;
  const body =
    `${name} (${email}${phone ? `, ${phone}` : ''}) booked “${link.name}”.\n` +
    `When: ${when.toISOString()} (${link.tz}), ${link.durationMins} min.` +
    noteLine;
  let activityId = '';
  try {
    const activity = await createActivity({
      projectId: link.projectId,
      type: 'MEETING',
      title,
      body,
      targetObject: link.objectSlug,
      targetRecordId: record._id,
      authorId: link.ownerUserId,
    });
    activityId = activity._id;
  } catch {
    // Activity is best-effort — the booking + record still stand.
  }

  // 3. Best-effort calendar event on the owner's primary calendar.
  let googleEventId: string | undefined;
  if (link.pushCalendar) {
    try {
      const push = await pushToCalendar(link.ownerUserId, {
        summary: `${link.name} — ${name}`,
        description: body,
        start: slot.startIso,
        end: slot.endIso,
        timeZone: link.tz,
      });
      if (push.ok) googleEventId = push.googleEventId;
    } catch {
      // Calendar push is best-effort.
    }
  }

  return {
    slot,
    recordId: record._id,
    activityId,
    googleEventId,
    linkName: link.name,
    tz: link.tz,
  };
}
