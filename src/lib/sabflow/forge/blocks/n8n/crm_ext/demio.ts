/**
 * Forge block: Demio
 *
 * Source: n8n-master/packages/nodes-base/nodes/Demio/Demio.node.ts
 * Credential type: 'demio' — fields: { apiKey, apiSecret? }
 *
 * Operations (subset):
 *   - event.list             GET  /v1/events
 *   - event.get              GET  /v1/event/{id}
 *   - registration.register  PUT  /v1/event/register
 *
 * Demio v1 uses an `Api-Key` header. Some endpoints accept `Api-Secret` too;
 * we forward when present.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://my.demio.com/api';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Demio', ctx.credential);
  const apiKey = cred.apiKey;
  if (!apiKey) throw new Error('Demio: credential is missing `apiKey` field');
  const headers: Record<string, string> = { 'Api-Key': apiKey };
  if (cred.apiSecret) headers['Api-Secret'] = cred.apiSecret;
  return headers;
}

async function demioApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Demio',
    method,
    url: `${BASE}${path}`,
    headers: authHeaders(ctx),
    json,
  });
  return res.data;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function eventList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const qs = new URLSearchParams();
  const type = asString(ctx.options.type);
  if (type) qs.set('type', type);
  const path = qs.size ? `/v1/events?${qs.toString()}` : '/v1/events';
  const data = await demioApi(ctx, 'GET', path);
  return { outputs: { result: data }, logs: ['Demio event list'] };
}

async function eventGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.eventId);
  if (!id) throw new Error('Demio: eventId is required');
  const data = await demioApi(ctx, 'GET', `/v1/event/${encodeURIComponent(id)}`);
  return { outputs: { event: data }, logs: [`Demio event get → ${id}`] };
}

async function registrationRegister(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const eventId = asString(ctx.options.eventId);
  const dateId = asString(ctx.options.dateId);
  const firstName = asString(ctx.options.firstName);
  const email = asString(ctx.options.email);
  if (!eventId) throw new Error('Demio: eventId is required');
  if (!firstName) throw new Error('Demio: firstName is required');
  if (!email) throw new Error('Demio: email is required');

  const body: Record<string, unknown> = {
    id: eventId,
    first_name: firstName,
    email,
  };
  if (dateId) body.date_id = dateId;
  const lastName = asString(ctx.options.lastName);
  if (lastName) body.last_name = lastName;
  const company = asString(ctx.options.company);
  if (company) body.company = company;

  const data = (await demioApi(ctx, 'PUT', '/v1/event/register', body)) as
    | { id?: string | number }
    | null;
  return {
    outputs: { registration: data, id: data?.id ?? null },
    logs: [`Demio registration → ${eventId}`],
  };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_demio',
  name: 'Demio',
  description: 'Manage Demio webinar events and registrations.',
  iconName: 'LuCalendar',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'demio' },
  actions: [
    {
      id: 'event_list',
      label: 'List events',
      fields: [
        {
          id: 'type',
          label: 'Type',
          type: 'select',
          options: [
            { label: 'Any', value: '' },
            { label: 'Future', value: 'future' },
            { label: 'Past', value: 'past' },
          ],
        },
      ],
      run: eventList,
    },
    {
      id: 'event_get',
      label: 'Get event',
      fields: [{ id: 'eventId', label: 'Event ID', type: 'text', required: true }],
      run: eventGet,
    },
    {
      id: 'registration_register',
      label: 'Register attendee',
      fields: [
        { id: 'eventId', label: 'Event ID', type: 'text', required: true },
        { id: 'dateId', label: 'Date ID', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'company', label: 'Company', type: 'text' },
      ],
      run: registrationRegister,
    },
  ],
};

registerForgeBlock(block);
export default block;
