/**
 * Forge block: Iterable
 *
 * Source: n8n-master/packages/nodes-base/nodes/Iterable/Iterable.node.ts
 * Credential type: 'iterable' — { apiKey } sent as `Api-Key: <key>` header.
 *
 * Operations covered:
 *   - user.upsert
 *   - user.get        (by email or userId)
 *   - user.delete     (by email or userId)
 *   - event.track
 *   - campaign.list
 *   - userList.subscribe
 *   - userList.unsubscribe
 *
 * Out of scope (deferred):
 *   - region selection: we use `https://api.iterable.com`; EU tenants need
 *     `.eu.iterable.com`. Folding this into the credential shape would
 *     require a credential-type bump, which is a separate batch concern.
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

async function userGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const userId = asString(ctx.options.userId);
  if (!email && !userId) {
    throw new Error('Iterable: email or userId is required');
  }
  // n8n uses GET /users/getByEmail?email= for email lookups and the path-style
  // /users/byUserId/{id} for userId lookups — mirror both precisely.
  let path: string;
  if (email) {
    path = `/users/getByEmail?email=${encodeURIComponent(email)}`;
  } else {
    path = `/users/byUserId/${encodeURIComponent(userId)}`;
  }
  const data = await call(ctx, 'GET', path);
  return { outputs: { user: (data as { user?: unknown })?.user ?? data }, logs: [`Iterable user get → ${email || userId}`] };
}

async function userDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const userId = asString(ctx.options.userId);
  if (!email && !userId) {
    throw new Error('Iterable: email or userId is required');
  }
  const path = email
    ? `/users/${encodeURIComponent(email)}`
    : `/users/byUserId/${encodeURIComponent(userId)}`;
  const data = await call(ctx, 'DELETE', path);
  return { outputs: { result: data }, logs: [`Iterable user delete → ${email || userId}`] };
}

async function userListSubscribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  const userId = asString(ctx.options.userId);
  if (!listId) throw new Error('Iterable: listId is required');
  if (!email && !userId) throw new Error('Iterable: email or userId is required');
  // Iterable expects `listId` as an integer; matches n8n's `parseInt(listId, 10)`.
  const subscriber = email ? { email } : { userId };
  const data = await call(ctx, 'POST', '/lists/subscribe', {
    listId: parseInt(listId, 10),
    subscribers: [subscriber],
  });
  return { outputs: { result: data }, logs: [`Iterable list subscribe → ${listId}`] };
}

async function userListUnsubscribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  const userId = asString(ctx.options.userId);
  const campaignId = asString(ctx.options.campaignId);
  if (!listId) throw new Error('Iterable: listId is required');
  if (!email && !userId) throw new Error('Iterable: email or userId is required');
  const subscriber = email ? { email } : { userId };
  const body: Record<string, unknown> = {
    listId: parseInt(listId, 10),
    subscribers: [subscriber],
  };
  if (campaignId) body.campaignId = parseInt(campaignId, 10);
  const data = await call(ctx, 'POST', '/lists/unsubscribe', body);
  return { outputs: { result: data }, logs: [`Iterable list unsubscribe → ${listId}`] };
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
      id: 'user_get',
      label: 'Get user',
      description: 'Fetch a user by email or userId.',
      fields: [
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'userId', label: 'User ID', type: 'text' },
      ],
      run: userGet,
    },
    {
      id: 'user_delete',
      label: 'Delete user',
      description: 'Delete a user by email or userId.',
      fields: [
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'userId', label: 'User ID', type: 'text' },
      ],
      run: userDelete,
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
    {
      id: 'user_list_subscribe',
      label: 'Subscribe to list',
      description: 'Add a user (email or userId) to an Iterable list.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'userId', label: 'User ID', type: 'text' },
      ],
      run: userListSubscribe,
    },
    {
      id: 'user_list_unsubscribe',
      label: 'Unsubscribe from list',
      description: 'Remove a user (email or userId) from an Iterable list.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'userId', label: 'User ID', type: 'text' },
        { id: 'campaignId', label: 'Campaign ID', type: 'text' },
      ],
      run: userListUnsubscribe,
    },
  ],
};

registerForgeBlock(block);
export default block;
