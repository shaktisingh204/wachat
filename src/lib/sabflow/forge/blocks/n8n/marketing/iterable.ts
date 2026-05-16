/**
 * Forge block: Iterable
 *
 * Source: n8n-master/packages/nodes-base/nodes/Iterable/Iterable.node.ts
 * Credential type: 'iterable' — { apiKey } sent as `Api-Key: <key>` header.
 *
 * Operations covered:
 *   - user.upsert
 *   - event.track
 *   - campaign.list
 *
 * Out of scope (deferred):
 *   - region selection (we use `https://api.iterable.com`; EU is `.eu.iterable.com`)
 *   - user-list subscribe/unsubscribe (use the dedicated endpoints when needed)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.iterable.com/api';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Iterable', ctx.credential);
  const key = cred.apiKey ?? '';
  if (!key) throw new Error('Iterable: credential is missing `apiKey`');
  return { 'Api-Key': key };
}

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Iterable',
    method,
    url: `${BASE}${path}`,
    headers: authHeader(ctx),
    json,
  });
  return res.data;
}

function tryJson(s: string): Record<string, unknown> | undefined {
  if (!s) return undefined;
  try {
    const v = JSON.parse(s);
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined;
  } catch {
    throw new Error('Iterable: dataFields must be valid JSON');
  }
}

// ── Actions ────────────────────────────────────────────────────────────────

async function userUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const userId = asString(ctx.options.userId);
  if (!email && !userId) {
    throw new Error('Iterable: email or userId is required');
  }
  const body: Record<string, unknown> = {};
  if (email) body.email = email;
  if (userId) body.userId = userId;
  const dataFields = tryJson(asString(ctx.options.dataFields));
  if (dataFields) body.dataFields = dataFields;
  const data = await call(ctx, 'POST', '/users/update', body);
  return { outputs: { result: data }, logs: [`Iterable user upsert → ${email || userId}`] };
}

async function eventTrack(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const eventName = asString(ctx.options.eventName);
  const email = asString(ctx.options.email);
  const userId = asString(ctx.options.userId);
  if (!eventName) throw new Error('Iterable: eventName is required');
  if (!email && !userId) {
    throw new Error('Iterable: email or userId is required');
  }
  const body: Record<string, unknown> = { eventName };
  if (email) body.email = email;
  if (userId) body.userId = userId;
  const dataFields = tryJson(asString(ctx.options.dataFields));
  if (dataFields) body.dataFields = dataFields;
  const data = await call(ctx, 'POST', '/events/track', body);
  return { outputs: { result: data }, logs: [`Iterable event track → ${eventName}`] };
}

async function campaignList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await call(ctx, 'GET', '/campaigns');
  return { outputs: { result: data }, logs: ['Iterable campaign list'] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_iterable',
  name: 'Iterable',
  description: 'Upsert users, track events and list campaigns in Iterable.',
  iconName: 'LuRepeat',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'iterable',
  },
  actions: [
    {
      id: 'user_upsert',
      label: 'Upsert user',
      description: 'Create or update a user identified by email or userId.',
      fields: [
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'userId', label: 'User ID', type: 'text' },
        { id: 'dataFields', label: 'Data fields (JSON)', type: 'json' },
      ],
      run: userUpsert,
    },
    {
      id: 'event_track',
      label: 'Track event',
      description: 'Record a custom event for a user.',
      fields: [
        { id: 'eventName', label: 'Event name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'userId', label: 'User ID', type: 'text' },
        { id: 'dataFields', label: 'Data fields (JSON)', type: 'json' },
      ],
      run: eventTrack,
    },
    {
      id: 'campaign_list',
      label: 'List campaigns',
      description: 'List campaigns in the Iterable workspace.',
      fields: [],
      run: campaignList,
    },
  ],
};

registerForgeBlock(block);
export default block;
