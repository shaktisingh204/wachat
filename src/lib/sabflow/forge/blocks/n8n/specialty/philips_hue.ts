/**
 * Forge block: Philips Hue
 *
 * Source: n8n-master/packages/nodes-base/nodes/PhilipsHue/PhilipsHue.node.ts
 *
 * Hue bridge IP + application (user) key passed inline. Calls are local LAN
 * to `http://<bridge>/api/<appKey>/...`. We accept any reachable URL so users
 * can use HTTPS bridges or proxied gateways.
 *
 * Operations covered:
 *   - lights.list              GET    /api/{appKey}/lights
 *   - lights.get               GET    /api/{appKey}/lights/{id}
 *   - lights.set_state         PUT    /api/{appKey}/lights/{id}/state
 *   - lights.rename            PUT    /api/{appKey}/lights/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function bridgeBase(ctx: ForgeActionContext): string {
  const ip = asString(ctx.options.bridgeIp).trim();
  const appKey = asString(ctx.options.appKey).trim();
  if (!ip) throw new Error('Philips Hue: bridgeIp is required');
  if (!appKey) throw new Error('Philips Hue: appKey is required');
  const root = /^https?:\/\//i.test(ip) ? ip : `http://${ip}`;
  return `${root.replace(/\/$/, '')}/api/${encodeURIComponent(appKey)}`;
}

function parseJsonOption(v: unknown, field: string): Record<string, unknown> {
  if (v == null || v === '') return {};
  if (typeof v === 'object') return v as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(v));
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`Philips Hue: ${field} must be valid JSON`);
  }
  throw new Error(`Philips Hue: ${field} must be a JSON object`);
}

async function lightsList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Philips Hue',
    method: 'GET',
    url: `${bridgeBase(ctx)}/lights`,
  });
  return { outputs: { lights: res.data }, logs: ['Philips Hue lights list'] };
}

async function lightsGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.lightId);
  if (!id) throw new Error('Philips Hue: lightId is required');
  const res = await apiRequest({
    service: 'Philips Hue',
    method: 'GET',
    url: `${bridgeBase(ctx)}/lights/${encodeURIComponent(id)}`,
  });
  return { outputs: { light: res.data }, logs: [`Philips Hue lights get → ${id}`] };
}

async function lightsSetState(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.lightId);
  if (!id) throw new Error('Philips Hue: lightId is required');
  const state = parseJsonOption(ctx.options.state, 'state');
  const res = await apiRequest({
    service: 'Philips Hue',
    method: 'PUT',
    url: `${bridgeBase(ctx)}/lights/${encodeURIComponent(id)}/state`,
    json: state,
  });
  return { outputs: { result: res.data }, logs: [`Philips Hue set state → ${id}`] };
}

async function lightsRename(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.lightId);
  const name = asString(ctx.options.name);
  if (!id) throw new Error('Philips Hue: lightId is required');
  if (!name) throw new Error('Philips Hue: name is required');
  const res = await apiRequest({
    service: 'Philips Hue',
    method: 'PUT',
    url: `${bridgeBase(ctx)}/lights/${encodeURIComponent(id)}`,
    json: { name },
  });
  return { outputs: { result: res.data }, logs: [`Philips Hue rename → ${id}`] };
}

const CRED_FIELDS = [
  {
    id: 'bridgeIp',
    label: 'Bridge IP or URL',
    type: 'text' as const,
    required: true,
    placeholder: '192.168.1.50',
    helperText: 'IPv4 address of the bridge — http:// is added automatically.',
  },
  {
    id: 'appKey',
    label: 'Application key',
    type: 'password' as const,
    required: true,
    helperText: 'The authenticated username returned by `POST /api`.',
  },
];

const block: ForgeBlock = {
  id: 'forge_philips_hue',
  name: 'Philips Hue',
  description: 'Control Philips Hue lights on a local bridge via its REST API.',
  iconName: 'LuLightbulb',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'lights_list',
      label: 'List lights',
      description: 'Fetch every light registered on the bridge.',
      fields: [...CRED_FIELDS],
      run: lightsList,
    },
    {
      id: 'lights_get',
      label: 'Get light',
      description: 'Fetch a single light by id.',
      fields: [
        ...CRED_FIELDS,
        { id: 'lightId', label: 'Light ID', type: 'text', required: true },
      ],
      run: lightsGet,
    },
    {
      id: 'lights_set_state',
      label: 'Set light state',
      description: 'Update a light — on/off, brightness, colour, transition, etc.',
      fields: [
        ...CRED_FIELDS,
        { id: 'lightId', label: 'Light ID', type: 'text', required: true },
        {
          id: 'state',
          label: 'State JSON',
          type: 'json',
          required: true,
          placeholder: '{"on": true, "bri": 200}',
          helperText: 'Mirrors the Hue REST state body — `on`, `bri`, `hue`, `sat`, `xy`, `ct`, …',
        },
      ],
      run: lightsSetState,
    },
    {
      id: 'lights_rename',
      label: 'Rename light',
      description: 'Set the display name of a light.',
      fields: [
        ...CRED_FIELDS,
        { id: 'lightId', label: 'Light ID', type: 'text', required: true },
        { id: 'name', label: 'New name', type: 'text', required: true },
      ],
      run: lightsRename,
    },
  ],
};

registerForgeBlock(block);
export default block;
