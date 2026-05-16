/**
 * Forge block: GoToWebinar
 *
 * Source: n8n-master/packages/nodes-base/nodes/GoToWebinar/GoToWebinar.node.ts
 *
 * Auth: Bearer accessToken plus an organizerKey on the path.
 *
 * Operations covered:
 *   - webinar.list        GET /organizers/{key}/webinars
 *   - webinar.create      POST /organizers/{key}/webinars
 *   - attendee.list       GET /organizers/{key}/webinars/{webinarKey}/attendees
 *   - session.list        GET /organizers/{key}/webinars/{webinarKey}/sessions
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.getgo.com/G2W/rest/v2';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('GoToWebinar: accessToken is required');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

function organizerKey(ctx: ForgeActionContext): string {
  const key = asString(ctx.options.organizerKey);
  if (!key) throw new Error('GoToWebinar: organizerKey is required');
  return key;
}

async function webinarList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const from = asString(ctx.options.fromTime);
  const to = asString(ctx.options.toTime);
  const params = new URLSearchParams();
  if (from) params.set('fromTime', from);
  if (to) params.set('toTime', to);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'GoToWebinar',
    method: 'GET',
    url: `${API}/organizers/${encodeURIComponent(organizerKey(ctx))}/webinars${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { webinars: res.data }, logs: ['GoToWebinar webinar list'] };
}

async function webinarCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subject = asString(ctx.options.subject);
  const startTime = asString(ctx.options.startTime);
  const endTime = asString(ctx.options.endTime);
  const timeZone = asString(ctx.options.timeZone) || 'UTC';
  if (!subject || !startTime || !endTime) {
    throw new Error('GoToWebinar: subject, startTime and endTime are required');
  }
  const body = {
    subject,
    times: [{ startTime, endTime }],
    timeZone,
    description: asString(ctx.options.description) || undefined,
  };
  const res = await apiRequest({
    service: 'GoToWebinar',
    method: 'POST',
    url: `${API}/organizers/${encodeURIComponent(organizerKey(ctx))}/webinars`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { webinar: res.data }, logs: [`GoToWebinar webinar create → ${subject}`] };
}

async function attendeeList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webinarKey = asString(ctx.options.webinarKey);
  if (!webinarKey) throw new Error('GoToWebinar: webinarKey is required');
  const res = await apiRequest({
    service: 'GoToWebinar',
    method: 'GET',
    url: `${API}/organizers/${encodeURIComponent(organizerKey(ctx))}/webinars/${encodeURIComponent(webinarKey)}/attendees`,
    headers: authHeaders(ctx),
  });
  return { outputs: { attendees: res.data }, logs: [`GoToWebinar attendee list → ${webinarKey}`] };
}

async function sessionList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webinarKey = asString(ctx.options.webinarKey);
  if (!webinarKey) throw new Error('GoToWebinar: webinarKey is required');
  const res = await apiRequest({
    service: 'GoToWebinar',
    method: 'GET',
    url: `${API}/organizers/${encodeURIComponent(organizerKey(ctx))}/webinars/${encodeURIComponent(webinarKey)}/sessions`,
    headers: authHeaders(ctx),
  });
  return { outputs: { sessions: res.data }, logs: [`GoToWebinar session list → ${webinarKey}`] };
}

const block: ForgeBlock = {
  id: 'forge_gotowebinar',
  name: 'GoToWebinar',
  description: 'Schedule webinars and fetch attendees via GoToWebinar.',
  iconName: 'LuVideo',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'webinar_list',
      label: 'List webinars',
      description: 'Fetch webinars for an organizer with optional date window.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'organizerKey', label: 'Organizer key', type: 'text', required: true },
        { id: 'fromTime', label: 'From (ISO 8601)', type: 'text' },
        { id: 'toTime', label: 'To (ISO 8601)', type: 'text' },
      ],
      run: webinarList,
    },
    {
      id: 'webinar_create',
      label: 'Create webinar',
      description: 'Schedule a new webinar.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'organizerKey', label: 'Organizer key', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'startTime', label: 'Start time (ISO 8601)', type: 'text', required: true },
        { id: 'endTime', label: 'End time (ISO 8601)', type: 'text', required: true },
        { id: 'timeZone', label: 'Time zone', type: 'text', defaultValue: 'UTC' },
        { id: 'description', label: 'Description', type: 'text' },
      ],
      run: webinarCreate,
    },
    {
      id: 'attendee_list',
      label: 'List attendees',
      description: 'Fetch attendees of a webinar.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'organizerKey', label: 'Organizer key', type: 'text', required: true },
        { id: 'webinarKey', label: 'Webinar key', type: 'text', required: true },
      ],
      run: attendeeList,
    },
    {
      id: 'session_list',
      label: 'List sessions',
      description: 'Fetch sessions of a webinar.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'organizerKey', label: 'Organizer key', type: 'text', required: true },
        { id: 'webinarKey', label: 'Webinar key', type: 'text', required: true },
      ],
      run: sessionList,
    },
  ],
};

registerForgeBlock(block);
export default block;
