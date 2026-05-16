/**
 * Forge block: Home Assistant
 *
 * Source: n8n-master/packages/nodes-base/nodes/HomeAssistant/HomeAssistant.node.ts
 *
 * Long-lived access token + base URL passed inline. Auth is Bearer.
 *
 * Operations covered:
 *   - states.list              GET  /api/states
 *   - states.get               GET  /api/states/{entityId}
 *   - service.call             POST /api/services/{domain}/{service}
 *   - config.get               GET  /api/config
 *   - event.fire               POST /api/events/{eventType}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const url = asString(ctx.options.baseUrl).trim();
  if (!url) throw new Error('Home Assistant: baseUrl is required');
  return url.replace(/\/$/, '');
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Home Assistant: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

function parseJsonOption(v: unknown, field: string): Record<string, unknown> {
  if (v == null || v === '') return {};
  if (typeof v === 'object') return v as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(v));
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`Home Assistant: ${field} must be valid JSON`);
  }
  throw new Error(`Home Assistant: ${field} must be a JSON object`);
}

async function statesList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Home Assistant',
    method: 'GET',
    url: `${baseUrl(ctx)}/api/states`,
    headers: authHeader(ctx),
  });
  return { outputs: { states: res.data }, logs: ['Home Assistant states list'] };
}

async function statesGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const entityId = asString(ctx.options.entityId);
  if (!entityId) throw new Error('Home Assistant: entityId is required');
  const res = await apiRequest({
    service: 'Home Assistant',
    method: 'GET',
    url: `${baseUrl(ctx)}/api/states/${encodeURIComponent(entityId)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { state: res.data }, logs: [`Home Assistant states get → ${entityId}`] };
}

async function serviceCall(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  const service = asString(ctx.options.service);
  if (!domain) throw new Error('Home Assistant: domain is required');
  if (!service) throw new Error('Home Assistant: service is required');
  const payload = parseJsonOption(ctx.options.serviceData, 'serviceData');
  const res = await apiRequest({
    service: 'Home Assistant',
    method: 'POST',
    url: `${baseUrl(ctx)}/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`,
    headers: authHeader(ctx),
    json: payload,
  });
  return { outputs: { result: res.data }, logs: [`Home Assistant service call → ${domain}.${service}`] };
}

async function configGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Home Assistant',
    method: 'GET',
    url: `${baseUrl(ctx)}/api/config`,
    headers: authHeader(ctx),
  });
  return { outputs: { config: res.data }, logs: ['Home Assistant config get'] };
}

async function eventFire(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const eventType = asString(ctx.options.eventType);
  if (!eventType) throw new Error('Home Assistant: eventType is required');
  const payload = parseJsonOption(ctx.options.eventData, 'eventData');
  const res = await apiRequest({
    service: 'Home Assistant',
    method: 'POST',
    url: `${baseUrl(ctx)}/api/events/${encodeURIComponent(eventType)}`,
    headers: authHeader(ctx),
    json: payload,
  });
  return { outputs: { result: res.data }, logs: [`Home Assistant event fire → ${eventType}`] };
}

const CRED_FIELDS = [
  {
    id: 'baseUrl',
    label: 'Base URL',
    type: 'text' as const,
    required: true,
    placeholder: 'https://homeassistant.local:8123',
  },
  {
    id: 'accessToken',
    label: 'Long-lived access token',
    type: 'password' as const,
    required: true,
  },
];

const block: ForgeBlock = {
  id: 'forge_home_assistant',
  name: 'Home Assistant',
  description: 'Read entity states and invoke services on a Home Assistant instance.',
  iconName: 'LuHouse',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'states_list',
      label: 'List states',
      description: 'Fetch every entity state on the instance.',
      fields: [...CRED_FIELDS],
      run: statesList,
    },
    {
      id: 'states_get',
      label: 'Get state',
      description: 'Fetch a single entity state.',
      fields: [
        ...CRED_FIELDS,
        { id: 'entityId', label: 'Entity ID', type: 'text', required: true, placeholder: 'light.kitchen' },
      ],
      run: statesGet,
    },
    {
      id: 'service_call',
      label: 'Call service',
      description: 'Invoke a Home Assistant service (e.g. light.turn_on).',
      fields: [
        ...CRED_FIELDS,
        { id: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'light' },
        { id: 'service', label: 'Service', type: 'text', required: true, placeholder: 'turn_on' },
        {
          id: 'serviceData',
          label: 'Service data',
          type: 'json',
          placeholder: '{"entity_id": "light.kitchen", "brightness": 200}',
        },
      ],
      run: serviceCall,
    },
    {
      id: 'config_get',
      label: 'Get config',
      description: 'Fetch the instance configuration.',
      fields: [...CRED_FIELDS],
      run: configGet,
    },
    {
      id: 'event_fire',
      label: 'Fire event',
      description: 'Emit a custom event on the Home Assistant event bus.',
      fields: [
        ...CRED_FIELDS,
        { id: 'eventType', label: 'Event type', type: 'text', required: true },
        { id: 'eventData', label: 'Event data', type: 'json' },
      ],
      run: eventFire,
    },
  ],
};

registerForgeBlock(block);
export default block;
