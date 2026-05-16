/**
 * Forge block: Google Calendar
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Calendar/GoogleCalendar.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline
 *   per action. Access token refreshed per call and cached via _shared/oauth.ts.
 *
 * Operations covered:
 *   - event.create   POST   /calendar/v3/calendars/{calendarId}/events
 *   - event.list     GET    /calendar/v3/calendars/{calendarId}/events
 *   - event.get      GET    /calendar/v3/calendars/{calendarId}/events/{eventId}
 *   - event.delete   DELETE /calendar/v3/calendars/{calendarId}/events/{eventId}
 *   - calendar.list  GET    /calendar/v3/users/me/calendarList
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';

const SERVICE = 'Google Calendar';
const CACHE = 'google_calendar';

type OAuthCred = { clientId: string; clientSecret: string; refreshToken: string };

function readCred(ctx: ForgeActionContext): OAuthCred {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function getOrRefreshAccessToken(cred: OAuthCred): Promise<string> {
  const key = cacheKeyFor(CACHE, cred.refreshToken);
  const cached = getCachedToken(key);
  if (cached) return cached;
  const { accessToken, expiresIn } = await refreshAccessToken({
    service: SERVICE,
    tokenUrl: 'https://oauth2.googleapis.com/token',
    refreshToken: cred.refreshToken,
    clientId: cred.clientId,
    clientSecret: cred.clientSecret,
  });
  setCachedToken(key, accessToken, expiresIn);
  return accessToken;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

function calendarPath(ctx: ForgeActionContext): string {
  const id = asString(ctx.options.calendarId) || 'primary';
  return encodeURIComponent(id);
}

// ── Actions ────────────────────────────────────────────────────────────────

async function eventCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const summary = asString(ctx.options.summary);
  const start = asString(ctx.options.start);
  const end = asString(ctx.options.end);
  if (!summary) throw new Error(`${SERVICE}: summary is required`);
  if (!start) throw new Error(`${SERVICE}: start is required`);
  if (!end) throw new Error(`${SERVICE}: end is required`);
  const body: Record<string, unknown> = {
    summary,
    start: { dateTime: start },
    end: { dateTime: end },
  };
  const description = asString(ctx.options.description);
  const location = asString(ctx.options.location);
  const attendees = asString(ctx.options.attendees);
  if (description) body.description = description;
  if (location) body.location = location;
  if (attendees) {
    body.attendees = attendees.split(',').map((s) => s.trim()).filter(Boolean).map((email) => ({ email }));
  }
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: `https://www.googleapis.com/calendar/v3/calendars/${calendarPath(ctx)}/events`,
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Calendar event create → ${summary}`] };
}

async function eventList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const params = new URLSearchParams();
  const timeMin = asString(ctx.options.timeMin);
  const timeMax = asString(ctx.options.timeMax);
  const q = asString(ctx.options.q);
  const maxResults = asString(ctx.options.maxResults);
  const singleEvents = asString(ctx.options.singleEvents);
  if (timeMin) params.set('timeMin', timeMin);
  if (timeMax) params.set('timeMax', timeMax);
  if (q) params.set('q', q);
  if (maxResults) params.set('maxResults', maxResults);
  if (singleEvents) params.set('singleEvents', singleEvents);
  const qs = params.toString();
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://www.googleapis.com/calendar/v3/calendars/${calendarPath(ctx)}/events${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: ['Calendar event list'] };
}

async function eventGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const eventId = asString(ctx.options.eventId);
  if (!eventId) throw new Error(`${SERVICE}: eventId is required`);
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://www.googleapis.com/calendar/v3/calendars/${calendarPath(ctx)}/events/${encodeURIComponent(eventId)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: [`Calendar event get → ${eventId}`] };
}

async function eventDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const eventId = asString(ctx.options.eventId);
  if (!eventId) throw new Error(`${SERVICE}: eventId is required`);
  await apiRequest({
    service: SERVICE,
    method: 'DELETE',
    url: `https://www.googleapis.com/calendar/v3/calendars/${calendarPath(ctx)}/events/${encodeURIComponent(eventId)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { eventId }, logs: [`Calendar event delete → ${eventId}`] };
}

async function calendarList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: ['Calendar list'] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_google_calendar',
  name: 'Google Calendar',
  description: 'Create, list, get and delete events; list calendars.',
  iconName: 'LuCalendar',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'event_create',
      label: 'Create event',
      description: 'Create a new calendar event.',
      fields: [
        ...authFields,
        { id: 'calendarId', label: 'Calendar ID', type: 'text', defaultValue: 'primary' },
        { id: 'summary', label: 'Summary', type: 'text', required: true },
        { id: 'start', label: 'Start (RFC3339)', type: 'text', required: true, placeholder: '2026-01-01T09:00:00-08:00' },
        { id: 'end', label: 'End (RFC3339)', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'location', label: 'Location', type: 'text' },
        { id: 'attendees', label: 'Attendees (comma-separated emails)', type: 'text' },
      ],
      run: eventCreate,
    },
    {
      id: 'event_list',
      label: 'List events',
      description: 'List events on a calendar.',
      fields: [
        ...authFields,
        { id: 'calendarId', label: 'Calendar ID', type: 'text', defaultValue: 'primary' },
        { id: 'timeMin', label: 'Time min (RFC3339)', type: 'text' },
        { id: 'timeMax', label: 'Time max (RFC3339)', type: 'text' },
        { id: 'q', label: 'Query', type: 'text' },
        { id: 'maxResults', label: 'Max results', type: 'number' },
        { id: 'singleEvents', label: 'Single events (true/false)', type: 'text' },
      ],
      run: eventList,
    },
    {
      id: 'event_get',
      label: 'Get event',
      description: 'Fetch a calendar event by id.',
      fields: [
        ...authFields,
        { id: 'calendarId', label: 'Calendar ID', type: 'text', defaultValue: 'primary' },
        { id: 'eventId', label: 'Event ID', type: 'text', required: true },
      ],
      run: eventGet,
    },
    {
      id: 'event_delete',
      label: 'Delete event',
      description: 'Delete a calendar event by id.',
      fields: [
        ...authFields,
        { id: 'calendarId', label: 'Calendar ID', type: 'text', defaultValue: 'primary' },
        { id: 'eventId', label: 'Event ID', type: 'text', required: true },
      ],
      run: eventDelete,
    },
    {
      id: 'calendar_list',
      label: 'List calendars',
      description: 'List all calendars on the authenticated account.',
      fields: [...authFields],
      run: calendarList,
    },
  ],
};

registerForgeBlock(block);
export default block;
