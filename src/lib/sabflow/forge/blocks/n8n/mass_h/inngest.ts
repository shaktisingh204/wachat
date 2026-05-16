/**
 * Forge block: Inngest
 *
 * Send events to Inngest via the Event API:
 *   POST https://inn.gs/e/{event_key}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const EVENT_API = 'https://inn.gs/e';

function parseOptionalJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Inngest: ${label} must be valid JSON`);
  }
}

async function sendEvent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const eventKey = asString(ctx.options.eventKey);
  const name = asString(ctx.options.name);
  const data = parseOptionalJson(ctx.options.data, 'data');
  const user = parseOptionalJson(ctx.options.user, 'user');
  if (!eventKey) throw new Error('Inngest: eventKey is required');
  if (!name) throw new Error('Inngest: name is required');
  const body: Record<string, unknown> = { name };
  if (data !== undefined) body.data = data;
  if (user !== undefined) body.user = user;
  const ts = asString(ctx.options.ts);
  if (ts) body.ts = Number(ts) || ts;
  const res = await apiRequest({
    service: 'Inngest',
    method: 'POST',
    url: `${EVENT_API}/${encodeURIComponent(eventKey)}`,
    json: body,
  });
  return { outputs: { response: res.data, status: res.status }, logs: [`Inngest send → ${name}`] };
}

async function sendEventBatch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const eventKey = asString(ctx.options.eventKey);
  const events = parseOptionalJson(ctx.options.events, 'events');
  if (!eventKey) throw new Error('Inngest: eventKey is required');
  if (!Array.isArray(events)) throw new Error('Inngest: events must be a JSON array');
  const res = await apiRequest({
    service: 'Inngest',
    method: 'POST',
    url: `${EVENT_API}/${encodeURIComponent(eventKey)}`,
    json: events,
  });
  return { outputs: { response: res.data, status: res.status }, logs: [`Inngest send batch → ${events.length} events`] };
}

const block: ForgeBlock = {
  id: 'forge_inngest',
  name: 'Inngest',
  description: 'Send events to Inngest via the Event API.',
  iconName: 'LuZap',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send_event',
      label: 'Send event',
      fields: [
        { id: 'eventKey', label: 'Event key', type: 'password', required: true },
        { id: 'name', label: 'Event name', type: 'text', required: true, placeholder: 'app/user.signup' },
        { id: 'data', label: 'Data (JSON)', type: 'json' },
        { id: 'user', label: 'User (JSON)', type: 'json' },
        { id: 'ts', label: 'Timestamp (ms epoch)', type: 'text' },
      ],
      run: sendEvent,
    },
    {
      id: 'send_event_batch',
      label: 'Send event batch',
      fields: [
        { id: 'eventKey', label: 'Event key', type: 'password', required: true },
        { id: 'events', label: 'Events (JSON array)', type: 'json', required: true },
      ],
      run: sendEventBatch,
    },
  ],
};

registerForgeBlock(block);
export default block;
