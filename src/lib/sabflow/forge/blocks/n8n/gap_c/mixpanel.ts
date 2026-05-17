/**
 * Forge block: Mixpanel
 *
 * `https://api.mixpanel.com` — track events, set user profile properties.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.mixpanel.com';

function projectAuth(ctx: ForgeActionContext): string {
  const token = asString(ctx.options.token);
  if (!token) throw new Error('Mixpanel: token is required');
  return token;
}

function parseJson(input: unknown, label: string): Record<string, unknown> {
  const s = asString(input).trim();
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`Mixpanel: ${label} must be a JSON object`);
  }
}

async function trackEvent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const event = asString(ctx.options.event);
  const distinctId = asString(ctx.options.distinctId);
  const props = parseJson(ctx.options.propertiesJson, 'propertiesJson');
  if (!event) throw new Error('Mixpanel: event is required');
  const properties: Record<string, unknown> = {
    token: projectAuth(ctx),
    ...props,
  };
  if (distinctId) properties.distinct_id = distinctId;
  const payload = [{ event, properties }];
  const res = await apiRequest({
    service: 'Mixpanel',
    method: 'POST',
    url: `${API}/track?ip=0`,
    headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
    json: payload,
  });
  return { outputs: { result: res.data }, logs: [`Mixpanel track → ${event}`] };
}

async function setProfile(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const distinctId = asString(ctx.options.distinctId);
  const set = parseJson(ctx.options.setJson, 'setJson');
  if (!distinctId) throw new Error('Mixpanel: distinctId is required');
  const payload = [{ $token: projectAuth(ctx), $distinct_id: distinctId, $set: set }];
  const res = await apiRequest({
    service: 'Mixpanel',
    method: 'POST',
    url: `${API}/engage`,
    headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
    json: payload,
  });
  return { outputs: { result: res.data }, logs: [`Mixpanel engage → ${distinctId}`] };
}

const block: ForgeBlock = {
  id: 'forge_mixpanel',
  name: 'Mixpanel',
  description: 'Send analytics events and update user profiles via Mixpanel.',
  iconName: 'LuBarChart',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'track_event',
      label: 'Track event',
      fields: [
        { id: 'token', label: 'Project token', type: 'password', required: true },
        { id: 'event', label: 'Event name', type: 'text', required: true },
        { id: 'distinctId', label: 'Distinct ID', type: 'text' },
        { id: 'propertiesJson', label: 'Properties (JSON)', type: 'json' },
      ],
      run: trackEvent,
    },
    {
      id: 'set_profile',
      label: 'Set user profile',
      fields: [
        { id: 'token', label: 'Project token', type: 'password', required: true },
        { id: 'distinctId', label: 'Distinct ID', type: 'text', required: true },
        { id: 'setJson', label: 'Properties to set (JSON)', type: 'json', required: true },
      ],
      run: setProfile,
    },
  ],
};

registerForgeBlock(block);
export default block;
