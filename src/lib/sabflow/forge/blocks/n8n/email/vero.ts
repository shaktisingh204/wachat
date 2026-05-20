/**
 * Forge block: Vero
 *
 * Source: n8n-master/packages/nodes-base/nodes/Vero/Vero.node.ts
 * Credential type: 'vero' (authToken)
 *
 * Auth: every endpoint accepts the auth token as a body field `auth_token`.
 *
 * Operations covered:
 *   - user.identify     POST /api/v2/users/track       (create or update a user)
 *   - user.alias        PUT  /api/v2/users/reidentify
 *   - user.unsubscribe  POST /api/v2/users/unsubscribe
 *   - user.resubscribe  POST /api/v2/users/resubscribe
 *   - user.delete       POST /api/v2/users/delete
 *   - user.add_tags     PUT  /api/v2/users/tags/edit  (body.add)
 *   - user.remove_tags  PUT  /api/v2/users/tags/edit  (body.remove)
 *   - event.track       POST /api/v2/events/track
 *
 * Out of scope: nothing — every n8n Vero operation is covered.
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

// Three Vero "lifecycle" endpoints (/users/unsubscribe, /users/resubscribe,
// /users/delete) share the same body shape, so the executor is factored once
// and the public actions just pick the path.
async function userLifecycle(
  ctx: ForgeActionContext,
  path: 'unsubscribe' | 'resubscribe' | 'delete',
): Promise<ForgeActionResult> {
  const auth_token = getAuthToken(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Vero: id is required');
  const res = await apiRequest({
    service: 'Vero',
    method: 'POST',
    url: `${BASE}/users/${path}`,
    json: { auth_token, id },
  });
  return { outputs: { result: res.data, success: true }, logs: [`Vero ${path} → ${id}`] };
}

async function userUnsubscribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return userLifecycle(ctx, 'unsubscribe');
}

async function userResubscribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return userLifecycle(ctx, 'resubscribe');
}

async function userDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return userLifecycle(ctx, 'delete');
}

async function userAlias(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const auth_token = getAuthToken(ctx);
  const id = asString(ctx.options.id);
  const newId = asString(ctx.options.newId);
  if (!id) throw new Error('Vero: id is required');
  if (!newId) throw new Error('Vero: newId is required');
  const res = await apiRequest({
    service: 'Vero',
    method: 'PUT',
    url: `${BASE}/users/reidentify`,
    json: { auth_token, id, new_id: newId },
  });
  return { outputs: { result: res.data, success: true }, logs: [`Vero alias → ${id}→${newId}`] };
}

// n8n sends the tag list as a JSON-encoded string in body.add / body.remove —
// the Vero docs require that exact shape, hence the JSON.stringify here.
async function userTags(
  ctx: ForgeActionContext,
  mode: 'add' | 'remove',
): Promise<ForgeActionResult> {
  const auth_token = getAuthToken(ctx);
  const id = asString(ctx.options.id);
  const tagsRaw = asString(ctx.options.tags);
  if (!id) throw new Error('Vero: id is required');
  if (!tagsRaw) throw new Error('Vero: tags is required');
  const tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const body: Record<string, unknown> = { auth_token, id };
  if (mode === 'add') body.add = JSON.stringify(tags);
  else body.remove = JSON.stringify(tags);
  const res = await apiRequest({
    service: 'Vero',
    method: 'PUT',
    url: `${BASE}/users/tags/edit`,
    json: body,
  });
  return {
    outputs: { result: res.data, success: true },
    logs: [`Vero tags ${mode} → ${id} (${tags.length})`],
  };
}

async function userAddTags(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return userTags(ctx, 'add');
}

async function userRemoveTags(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return userTags(ctx, 'remove');
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
    {
      id: 'user_resubscribe',
      label: 'Resubscribe user',
      description: 'Reverse a previous unsubscribe.',
      fields: [{ id: 'id', label: 'User ID', type: 'text', required: true }],
      run: userResubscribe,
    },
    {
      id: 'user_delete',
      label: 'Delete user',
      description: 'Permanently delete a Vero user.',
      fields: [{ id: 'id', label: 'User ID', type: 'text', required: true }],
      run: userDelete,
    },
    {
      id: 'user_alias',
      label: 'Alias user ID',
      description: 'Re-identify an existing user under a new ID.',
      fields: [
        { id: 'id', label: 'Current user ID', type: 'text', required: true },
        { id: 'newId', label: 'New user ID', type: 'text', required: true },
      ],
      run: userAlias,
    },
    {
      id: 'user_add_tags',
      label: 'Add tags',
      description: 'Attach one or more tags to a user (comma-separated).',
      fields: [
        { id: 'id', label: 'User ID', type: 'text', required: true },
        { id: 'tags', label: 'Tags (comma separated)', type: 'text', required: true },
      ],
      run: userAddTags,
    },
    {
      id: 'user_remove_tags',
      label: 'Remove tags',
      description: 'Detach one or more tags from a user (comma-separated).',
      fields: [
        { id: 'id', label: 'User ID', type: 'text', required: true },
        { id: 'tags', label: 'Tags (comma separated)', type: 'text', required: true },
      ],
      run: userRemoveTags,
    },
  ],
};

registerForgeBlock(block);
export default block;
