/**
 * Google Calendar sync — pushes/removes events on the user's primary
 * calendar via the Google Calendar v3 REST API.
 *
 * OAuth tokens live in `crm_google_calendar_settings` per tenant. The
 * existing settings page at `/dashboard/crm/settings/integrations/google-calendar`
 * holds the workspace OAuth app credentials; we read & refresh per-user
 * tokens from the same collection (keyed by `userId`). Failures NEVER
 * bubble — callers can record `syncFailed: true` if they care.
 */
import { ObjectId, type Db } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export interface CalendarEvent {
  summary: string;
  description?: string;
  /** ISO-8601 datetime, or YYYY-MM-DD for all-day events. */
  start: string;
  /** ISO-8601 datetime, or YYYY-MM-DD for all-day events. */
  end: string;
  location?: string;
  timeZone?: string;
  /** All-day single-day events use `date` (not `dateTime`) on Google's side. */
  allDay?: boolean;
}

export interface PushResult {
  ok: boolean;
  googleEventId?: string;
  error?: string;
}

interface GoogleCalendarSettingDoc {
  _id: ObjectId;
  userId: ObjectId;
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  enabled?: boolean;
  /** Per-user OAuth tokens populated by the connect flow. */
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;
}

async function logEvent(
  db: Db,
  userId: ObjectId,
  kind: 'delivery' | 'failure',
  status: 'success' | 'failure',
  message: string,
): Promise<void> {
  try {
    await db.collection('integration_events').insertOne({
      userId,
      integration: 'google-calendar',
      kind,
      status,
      message,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[google-calendar] failed to log event:', err);
  }
}

interface TokenRefreshResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

async function refreshAccessToken(
  setting: GoogleCalendarSettingDoc,
  db: Db,
): Promise<string | null> {
  if (!setting.refresh_token || !setting.client_id || !setting.client_secret) {
    return null;
  }
  try {
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
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[google-calendar] refresh failed ${res.status}: ${errBody.slice(0, 200)}`);
      return null;
    }
    const json = (await res.json()) as TokenRefreshResponse;
    if (!json.access_token) return null;
    const expiresAt = new Date(Date.now() + (json.expires_in - 60) * 1000);
    await db.collection('crm_google_calendar_settings').updateOne(
      { _id: setting._id },
      {
        $set: {
          access_token: json.access_token,
          token_expires_at: expiresAt,
          updatedAt: new Date(),
        },
      },
    );
    return json.access_token;
  } catch (err) {
    console.error('[google-calendar] refresh exception:', err);
    return null;
  }
}

async function getValidAccessToken(
  userId: ObjectId,
  db: Db,
): Promise<{ token: string; setting: GoogleCalendarSettingDoc } | null> {
  const setting = (await db
    .collection<GoogleCalendarSettingDoc>('crm_google_calendar_settings')
    .findOne({ userId })) as GoogleCalendarSettingDoc | null;
  if (!setting) return null;
  if (setting.enabled === false) return null;
  if (!setting.access_token) {
    const refreshed = await refreshAccessToken(setting, db);
    if (!refreshed) return null;
    return { token: refreshed, setting };
  }
  // Refresh if the token is within 60s of expiry.
  const exp = setting.token_expires_at;
  if (exp instanceof Date && exp.getTime() <= Date.now() + 60_000) {
    const refreshed = await refreshAccessToken(setting, db);
    if (refreshed) return { token: refreshed, setting };
  }
  return { token: setting.access_token, setting };
}

function buildEventBody(event: CalendarEvent): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: event.summary,
  };
  if (event.description) body.description = event.description;
  if (event.location) body.location = event.location;
  if (event.allDay) {
    body.start = { date: event.start.slice(0, 10) };
    body.end = { date: event.end.slice(0, 10) };
  } else {
    body.start = { dateTime: event.start, timeZone: event.timeZone || 'UTC' };
    body.end = { dateTime: event.end, timeZone: event.timeZone || 'UTC' };
  }
  return body;
}

/**
 * Push an event to the user's primary Google Calendar. Returns the
 * created Google event id (caller can store this for later removal).
 */
export async function pushToCalendar(
  userId: string,
  event: CalendarEvent,
): Promise<PushResult> {
  try {
    if (!ObjectId.isValid(userId)) {
      return { ok: false, error: 'invalid-user-id' };
    }
    const uOid = new ObjectId(userId);
    const { db } = await connectToDatabase();
    const creds = await getValidAccessToken(uOid, db);
    if (!creds) {
      return { ok: false, error: 'not-connected' };
    }

    const res = await fetch(CALENDAR_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildEventBody(event)),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const msg = `Google Calendar insert ${res.status}: ${body.slice(0, 240)}`;
      console.error('[google-calendar]', msg);
      await logEvent(db, uOid, 'failure', 'failure', msg);
      return { ok: false, error: msg };
    }

    const json = (await res.json()) as { id?: string };
    await logEvent(db, uOid, 'delivery', 'success', `Pushed: ${event.summary}`);
    return { ok: true, googleEventId: json.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[google-calendar] push exception:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Delete a previously-pushed event. Best-effort — caller can ignore the
 * return value.
 */
export async function removeFromCalendar(
  userId: string,
  googleEventId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!ObjectId.isValid(userId) || !googleEventId) {
      return { ok: false, error: 'invalid-args' };
    }
    const uOid = new ObjectId(userId);
    const { db } = await connectToDatabase();
    const creds = await getValidAccessToken(uOid, db);
    if (!creds) return { ok: false, error: 'not-connected' };

    const res = await fetch(
      `${CALENDAR_BASE}/${encodeURIComponent(googleEventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${creds.token}` },
      },
    );

    // 404/410 → already gone; treat as success.
    if (res.ok || res.status === 404 || res.status === 410) {
      await logEvent(db, uOid, 'delivery', 'success', `Removed: ${googleEventId}`);
      return { ok: true };
    }
    const body = await res.text().catch(() => '');
    const msg = `Google Calendar delete ${res.status}: ${body.slice(0, 240)}`;
    console.error('[google-calendar]', msg);
    await logEvent(db, uOid, 'failure', 'failure', msg);
    return { ok: false, error: msg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[google-calendar] delete exception:', msg);
    return { ok: false, error: msg };
  }
}
