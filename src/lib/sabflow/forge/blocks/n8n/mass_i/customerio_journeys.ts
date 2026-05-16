/**
 * Forge block: Customer.io Journeys (Track API)
 *
 * API: https://customer.io/docs/api/track/
 * Auth: HTTP Basic — `site_id:api_key`.
 *
 * Operations covered:
 *   - person.identify           PUT    /api/v1/customers/{id}
 *   - person.delete             DELETE /api/v1/customers/{id}
 *   - event.track               POST   /api/v1/customers/{id}/events
 *   - event.anonymous           POST   /api/v1/events
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://track.customer.io';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const siteId = asString(ctx.options.siteId);
  const apiKey = asString(ctx.options.apiKey);
  if (!siteId || !apiKey) throw new Error('Customer.io: siteId and apiKey are required');
  const token = Buffer.from(`${siteId}:${apiKey}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

function maybeJson(s: string): Record<string, unknown> {
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error('Customer.io: attributes must be valid JSON');
  }
}

async function personIdentify(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('Customer.io: customerId is required');
  const body: Record<string, unknown> = maybeJson(asString(ctx.options.attributes));
  const email = asString(ctx.options.email);
  if (email) body.email = email;
  const res = await apiRequest({
    service: 'Customer.io',
    method: 'PUT',
    url: `${API}/api/v1/customers/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Customer.io identify → ${id}`] };
}

async function personDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('Customer.io: customerId is required');
  const res = await apiRequest({
    service: 'Customer.io',
    method: 'DELETE',
    url: `${API}/api/v1/customers/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Customer.io delete → ${id}`] };
}

async function eventTrack(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  const name = asString(ctx.options.eventName);
  if (!id || !name) throw new Error('Customer.io: customerId and eventName are required');
  const body: Record<string, unknown> = {
    name,
    data: maybeJson(asString(ctx.options.data)),
  };
  const res = await apiRequest({
    service: 'Customer.io',
    method: 'POST',
    url: `${API}/api/v1/customers/${encodeURIComponent(id)}/events`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Customer.io track → ${name}`] };
}

async function eventAnonymous(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.eventName);
  if (!name) throw new Error('Customer.io: eventName is required');
  const body: Record<string, unknown> = {
    name,
    data: maybeJson(asString(ctx.options.data)),
  };
  const anonymousId = asString(ctx.options.anonymousId);
  if (anonymousId) body.anonymous_id = anonymousId;
  const res = await apiRequest({
    service: 'Customer.io',
    method: 'POST',
    url: `${API}/api/v1/events`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Customer.io anonymous event → ${name}`] };
}

const block: ForgeBlock = {
  id: 'forge_customerio_journeys',
  name: 'Customer.io Journeys',
  description: 'Identify customers and track events in Customer.io.',
  iconName: 'LuActivity',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'person_identify',
      label: 'Identify person',
      description: 'Create or update a customer.',
      fields: [
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'attributes', label: 'Attributes JSON', type: 'textarea' },
      ],
      run: personIdentify,
    },
    {
      id: 'person_delete',
      label: 'Delete person',
      description: 'Delete a customer profile.',
      fields: [
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
      ],
      run: personDelete,
    },
    {
      id: 'event_track',
      label: 'Track event',
      description: 'Track an event for a customer.',
      fields: [
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'eventName', label: 'Event name', type: 'text', required: true },
        { id: 'data', label: 'Event data JSON', type: 'textarea' },
      ],
      run: eventTrack,
    },
    {
      id: 'event_anonymous',
      label: 'Track anonymous event',
      description: 'Track an event without a customer id.',
      fields: [
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'eventName', label: 'Event name', type: 'text', required: true },
        { id: 'anonymousId', label: 'Anonymous ID', type: 'text' },
        { id: 'data', label: 'Event data JSON', type: 'textarea' },
      ],
      run: eventAnonymous,
    },
  ],
};

registerForgeBlock(block);
export default block;
