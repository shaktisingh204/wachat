/**
 * Forge block: Vero
 *
 * Source: n8n-master/packages/nodes-base/nodes/Vero/Vero.node.ts
 * Credential type: 'vero' (authToken)
 *
 * Auth: every endpoint accepts the auth token as a body field `auth_token`.
 *
 * Operations covered:
 *   - user.identify    POST /api/v2/users/track       (create or update a user)
 *   - event.track      POST /api/v2/events/track
 *   - user.unsubscribe POST /api/v2/users/unsubscribe
 *
 * Out of scope for the first port:
 *   - User alias (reidentify), addTags/removeTags
 *   - Resubscribe / delete user — easy follow-up clones of unsubscribe
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.getvero.com/api/v2';

function getAuthToken(ctx: ForgeActionContext): string {
  const cred = requireCredential('Vero', ctx.credential);
  const authToken = cred.authToken ?? '';
  if (!authToken) throw new Error('Vero: credential is missing `authToken`');
  return authToken;
}

function parseJson(raw: string, label: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Vero: ${label} must be valid JSON`);
  }
}

async function userIdentify(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const auth_token = getAuthToken(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Vero: id is required');
  const body: Record<string, unknown> = { auth_token, id };
  const email = asString(ctx.options.email);
  if (email) body.email = email;
  const data = parseJson(asString(ctx.options.data), 'data');
  if (data) body.data = data;

  const res = await apiRequest({
    service: 'Vero',
    method: 'POST',
    url: `${BASE}/users/track`,
    json: body,
  });
  return { outputs: { result: res.data, success: true }, logs: [`Vero identify → ${id}`] };
}

async function eventTrack(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const auth_token = getAuthToken(ctx);
  const id = asString(ctx.options.id);
  const email = asString(ctx.options.email);
  const eventName = asString(ctx.options.eventName);
  if (!id) throw new Error('Vero: id is required');
  if (!eventName) throw new Error('Vero: eventName is required');

  const body: Record<string, unknown> = {
    auth_token,
    identity: { id, email: email || undefined },
    event_name: eventName,
  };
  const data = parseJson(asString(ctx.options.data), 'data');
  if (data) body.data = data;
  const extras = parseJson(asString(ctx.options.extras), 'extras');
  if (extras) body.extras = extras;

  const res = await apiRequest({
    service: 'Vero',
    method: 'POST',
    url: `${BASE}/events/track`,
    json: body,
  });
  return { outputs: { result: res.data, success: true }, logs: [`Vero event → ${eventName}`] };
}

async function userUnsubscribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const auth_token = getAuthToken(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Vero: id is required');
  const res = await apiRequest({
    service: 'Vero',
    method: 'POST',
    url: `${BASE}/users/unsubscribe`,
    json: { auth_token, id },
  });
  return { outputs: { result: res.data, success: true }, logs: [`Vero unsubscribe → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_vero',
  name: 'Vero',
  description: 'Identify users, track events and manage subscriptions in Vero.',
  iconName: 'LuActivity',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'vero' },
  actions: [
    {
      id: 'user_identify',
      label: 'Identify user',
      description: 'Create or update a Vero user profile.',
      fields: [
        { id: 'id', label: 'User ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'data', label: 'Data attributes (JSON)', type: 'json' },
      ],
      run: userIdentify,
    },
    {
      id: 'event_track',
      label: 'Track event',
      description: 'Record a custom event for a user.',
      fields: [
        { id: 'id', label: 'User ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'eventName', label: 'Event name', type: 'text', required: true },
        { id: 'data', label: 'Event data (JSON)', type: 'json' },
        { id: 'extras', label: 'Extras (JSON)', type: 'json' },
      ],
      run: eventTrack,
    },
    {
      id: 'user_unsubscribe',
      label: 'Unsubscribe user',
      description: 'Mark a user as unsubscribed.',
      fields: [{ id: 'id', label: 'User ID', type: 'text', required: true }],
      run: userUnsubscribe,
    },
  ],
};

registerForgeBlock(block);
export default block;
