/**
 * Forge block: Acuity Scheduling
 *
 * Source: n8n-master/packages/nodes-base/nodes/AcuityScheduling
 *
 * Base URL: https://acuityscheduling.com/api/v1
 * Auth: HTTP Basic — userId:apiKey
 *
 * Operations covered:
 *   - appointment.list     GET  /appointments
 *   - appointment.get      GET  /appointments/{id}
 *   - appointment.cancel   PUT  /appointments/{id}/cancel
 *   - client.list          GET  /clients
 *   - calendar.list        GET  /calendars
 *
 * Inline credentials — `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://acuityscheduling.com/api/v1';

function b64(input: string): string {
  if (typeof btoa === 'function') return btoa(input);
  const g = globalThis as { Buffer?: { from: (s: string) => { toString: (enc: string) => string } } };
  if (g.Buffer) return g.Buffer.from(input).toString('base64');
  throw new Error('Acuity: no base64 encoder available in this runtime');
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const userId = asString(ctx.options.userId);
  const apiKey = asString(ctx.options.apiKey);
  if (!userId) throw new Error('Acuity: userId is required');
  if (!apiKey) throw new Error('Acuity: apiKey is required');
  return {
    Authorization: `Basic ${b64(`${userId}:${apiKey}`)}`,
    Accept: 'application/json',
  };
}

async function appointmentList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const minDate = asString(ctx.options.minDate);
  const maxDate = asString(ctx.options.maxDate);
  const calendarId = asString(ctx.options.calendarId);
  if (minDate) params.set('minDate', minDate);
  if (maxDate) params.set('maxDate', maxDate);
  if (calendarId) params.set('calendarID', calendarId);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Acuity',
    method: 'GET',
    url: `${API}/appointments${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  const list = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { appointments: list, count: list.length },
    logs: [`Acuity appointments list → ${list.length}`],
  };
}

async function appointmentGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.appointmentId);
  if (!id) throw new Error('Acuity: appointmentId is required');
  const res = await apiRequest({
    service: 'Acuity',
    method: 'GET',
    url: `${API}/appointments/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return {
    outputs: { appointment: res.data },
    logs: [`Acuity appointment get → ${id}`],
  };
}

async function appointmentCancel(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.appointmentId);
  if (!id) throw new Error('Acuity: appointmentId is required');
  const res = await apiRequest({
    service: 'Acuity',
    method: 'PUT',
    url: `${API}/appointments/${encodeURIComponent(id)}/cancel`,
    headers: authHeaders(ctx),
    json: { cancelNote: asString(ctx.options.cancelNote) || undefined },
  });
  return {
    outputs: { appointment: res.data, cancelled: true },
    logs: [`Acuity appointment cancel → ${id}`],
  };
}

async function clientList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const search = asString(ctx.options.search);
  if (search) params.set('search', search);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Acuity',
    method: 'GET',
    url: `${API}/clients${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  const list = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { clients: list, count: list.length },
    logs: [`Acuity clients list → ${list.length}`],
  };
}

async function calendarList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Acuity',
    method: 'GET',
    url: `${API}/calendars`,
    headers: authHeaders(ctx),
  });
  const list = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { calendars: list, count: list.length },
    logs: [`Acuity calendars → ${list.length}`],
  };
}

const inlineCreds = [
  { id: 'userId', label: 'User ID', type: 'text' as const, required: true },
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_acuity_scheduling',
  name: 'Acuity Scheduling',
  description: 'Manage appointments, clients and calendars in Acuity Scheduling.',
  iconName: 'LuCalendar',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'appointment_list',
      label: 'List appointments',
      description: 'GET /appointments — filter by date or calendar.',
      fields: [
        ...inlineCreds,
        { id: 'minDate', label: 'Min date (ISO)', type: 'text' },
        { id: 'maxDate', label: 'Max date (ISO)', type: 'text' },
        { id: 'calendarId', label: 'Calendar ID', type: 'text' },
      ],
      run: appointmentList,
    },
    {
      id: 'appointment_get',
      label: 'Get appointment',
      description: 'GET /appointments/{id}.',
      fields: [
        ...inlineCreds,
        { id: 'appointmentId', label: 'Appointment ID', type: 'text', required: true },
      ],
      run: appointmentGet,
    },
    {
      id: 'appointment_cancel',
      label: 'Cancel appointment',
      description: 'PUT /appointments/{id}/cancel.',
      fields: [
        ...inlineCreds,
        { id: 'appointmentId', label: 'Appointment ID', type: 'text', required: true },
        { id: 'cancelNote', label: 'Cancel note', type: 'textarea' },
      ],
      run: appointmentCancel,
    },
    {
      id: 'client_list',
      label: 'List clients',
      description: 'GET /clients — optional search term.',
      fields: [
        ...inlineCreds,
        { id: 'search', label: 'Search', type: 'text' },
      ],
      run: clientList,
    },
    {
      id: 'calendar_list',
      label: 'List calendars',
      description: 'GET /calendars.',
      fields: [...inlineCreds],
      run: calendarList,
    },
  ],
};

registerForgeBlock(block);
export default block;
