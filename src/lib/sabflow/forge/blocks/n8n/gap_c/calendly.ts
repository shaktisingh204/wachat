/**
 * Forge block: Calendly
 *
 * `https://api.calendly.com` — list events, fetch event types, cancel.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.calendly.com';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Calendly: apiKey is required');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

async function getCurrentUser(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Calendly',
    method: 'GET',
    url: `${API}/users/me`,
    headers: authHeaders(ctx),
  });
  return { outputs: { user: res.data }, logs: ['Calendly get current user'] };
}

async function listScheduledEvents(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const user = asString(ctx.options.userUri);
  const status = asString(ctx.options.status);
  if (!user) throw new Error('Calendly: userUri is required');
  const params = new URLSearchParams({ user });
  if (status) params.set('status', status);
  const res = await apiRequest({
    service: 'Calendly',
    method: 'GET',
    url: `${API}/scheduled_events?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { events: res.data }, logs: ['Calendly list scheduled events'] };
}

async function listEventTypes(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const user = asString(ctx.options.userUri);
  if (!user) throw new Error('Calendly: userUri is required');
  const res = await apiRequest({
    service: 'Calendly',
    method: 'GET',
    url: `${API}/event_types?user=${encodeURIComponent(user)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { eventTypes: res.data }, logs: ['Calendly list event types'] };
}

async function cancelEvent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const uuid = asString(ctx.options.eventUuid);
  const reason = asString(ctx.options.reason);
  if (!uuid) throw new Error('Calendly: eventUuid is required');
  const res = await apiRequest({
    service: 'Calendly',
    method: 'POST',
    url: `${API}/scheduled_events/${encodeURIComponent(uuid)}/cancellation`,
    headers: authHeaders(ctx),
    json: reason ? { reason } : {},
  });
  return { outputs: { event: res.data }, logs: [`Calendly cancel event → ${uuid}`] };
}

const block: ForgeBlock = {
  id: 'forge_calendly',
  name: 'Calendly',
  description: 'Manage scheduled events and event types via Calendly v2.',
  iconName: 'LuCalendar',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'get_current_user',
      label: 'Get current user',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: getCurrentUser,
    },
    {
      id: 'list_scheduled_events',
      label: 'List scheduled events',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'userUri', label: 'User URI', type: 'text', required: true },
        { id: 'status', label: 'Status (active/canceled)', type: 'text' },
      ],
      run: listScheduledEvents,
    },
    {
      id: 'list_event_types',
      label: 'List event types',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'userUri', label: 'User URI', type: 'text', required: true },
      ],
      run: listEventTypes,
    },
    {
      id: 'cancel_event',
      label: 'Cancel event',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'eventUuid', label: 'Event UUID', type: 'text', required: true },
        { id: 'reason', label: 'Reason', type: 'textarea' },
      ],
      run: cancelEvent,
    },
  ],
};

registerForgeBlock(block);
export default block;
