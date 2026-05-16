/**
 * Forge block: X / Twitter (v2 API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Twitter/V2/*
 * Credential type: 'twitter' (CREDENTIAL_FIELD_SCHEMAS → { bearerToken, ... })
 *
 * Notes:
 *   - Uses Bearer-token auth via the v2 endpoint. OAuth1 user-context flows
 *     (required for some write ops on the real API) are NOT modelled here —
 *     this gets us read paths + write paths against bearer-tokenable endpoints.
 *     Throwing on 401/403 surfaces the gap when callers hit a write endpoint
 *     that requires elevated context.
 *
 * Operations:
 *   - tweet.create   POST /2/tweets
 *   - tweet.delete   DELETE /2/tweets/{id}
 *   - tweet.get      GET /2/tweets/{id}
 *   - user.lookup    GET /2/users/by/username/{username}
 *   - user.get_me    GET /2/users/me
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.twitter.com/2';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Twitter', ctx.credential);
  const token = cred.bearerToken;
  if (!token) throw new Error('Twitter: credential is missing `bearerToken`');
  return { Authorization: `Bearer ${token}` };
}

async function tweetCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Twitter: text is required');
  const res = await apiRequest({
    service: 'Twitter',
    method: 'POST',
    url: `${BASE}/tweets`,
    headers: authHeaders(ctx),
    json: { text },
  });
  const data = res.data as { data?: { id?: string; text?: string } };
  return { outputs: { tweet: data.data }, logs: [`Twitter create → ${data.data?.id ?? '?'}`] };
}

async function tweetDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.tweetId);
  if (!id) throw new Error('Twitter: tweetId is required');
  const res = await apiRequest({
    service: 'Twitter',
    method: 'DELETE',
    url: `${BASE}/tweets/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Twitter delete → ${id}`] };
}

async function tweetGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.tweetId);
  if (!id) throw new Error('Twitter: tweetId is required');
  const params = new URLSearchParams();
  params.set('tweet.fields', 'author_id,created_at,public_metrics,lang,source');
  const res = await apiRequest({
    service: 'Twitter',
    method: 'GET',
    url: `${BASE}/tweets/${encodeURIComponent(id)}?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  const data = res.data as { data?: unknown };
  return { outputs: { tweet: data.data }, logs: [`Twitter get → ${id}`] };
}

async function userLookup(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const username = asString(ctx.options.username).replace(/^@/, '');
  if (!username) throw new Error('Twitter: username is required');
  const params = new URLSearchParams();
  params.set('user.fields', 'id,name,username,description,public_metrics,verified');
  const res = await apiRequest({
    service: 'Twitter',
    method: 'GET',
    url: `${BASE}/users/by/username/${encodeURIComponent(username)}?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  const data = res.data as { data?: unknown };
  return { outputs: { user: data.data }, logs: [`Twitter user lookup → @${username}`] };
}

async function userGetMe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Twitter',
    method: 'GET',
    url: `${BASE}/users/me`,
    headers: authHeaders(ctx),
  });
  const data = res.data as { data?: unknown };
  return { outputs: { user: data.data }, logs: ['Twitter users/me'] };
}

const block: ForgeBlock = {
  id: 'forge_twitter',
  name: 'X / Twitter',
  description: 'Post and read tweets via the X (Twitter) v2 API.',
  iconName: 'LuTwitter',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'twitter' },
  actions: [
    {
      id: 'tweet_create',
      label: 'Create tweet',
      description: 'Post a new tweet on behalf of the authenticated user.',
      fields: [
        { id: 'text', label: 'Tweet text', type: 'textarea', required: true, placeholder: 'Hello world' },
      ],
      run: tweetCreate,
    },
    {
      id: 'tweet_get',
      label: 'Get tweet',
      description: 'Fetch a single tweet by id.',
      fields: [
        { id: 'tweetId', label: 'Tweet ID', type: 'text', required: true },
      ],
      run: tweetGet,
    },
    {
      id: 'tweet_delete',
      label: 'Delete tweet',
      description: 'Permanently delete a tweet.',
      fields: [
        { id: 'tweetId', label: 'Tweet ID', type: 'text', required: true },
      ],
      run: tweetDelete,
    },
    {
      id: 'user_lookup',
      label: 'Look up user by username',
      description: 'Fetch a user profile by their @-handle.',
      fields: [
        { id: 'username', label: 'Username', type: 'text', required: true, placeholder: 'jack' },
      ],
      run: userLookup,
    },
    {
      id: 'user_get_me',
      label: 'Get authenticated user',
      description: 'Return the user the bearer token belongs to (users/me).',
      fields: [],
      run: userGetMe,
    },
  ],
};

registerForgeBlock(block);
export default block;
