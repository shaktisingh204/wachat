/**
 * Forge block: Twitter V2 (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Twitter/V2/TwitterV2.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.twitter.com/2';

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.bearerToken);
  if (!token) throw new Error('Twitter: bearerToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function tweetCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Twitter: text is required');
  const res = await apiRequest({
    service: 'Twitter',
    method: 'POST',
    url: `${API}/tweets`,
    headers: headers(ctx),
    json: { text },
  });
  return { outputs: { tweet: res.data }, logs: ['Twitter tweet create'] };
}

async function tweetDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const tweetId = asString(ctx.options.tweetId);
  if (!tweetId) throw new Error('Twitter: tweetId is required');
  const res = await apiRequest({
    service: 'Twitter',
    method: 'DELETE',
    url: `${API}/tweets/${encodeURIComponent(tweetId)}`,
    headers: headers(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Twitter tweet delete → ${tweetId}`] };
}

async function userByUsername(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const username = asString(ctx.options.username);
  if (!username) throw new Error('Twitter: username is required');
  const res = await apiRequest({
    service: 'Twitter',
    method: 'GET',
    url: `${API}/users/by/username/${encodeURIComponent(username)}`,
    headers: headers(ctx),
  });
  return { outputs: { user: res.data }, logs: [`Twitter user → ${username}`] };
}

async function tweetSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  const maxResults = asString(ctx.options.maxResults);
  if (!query) throw new Error('Twitter: query is required');
  const params = new URLSearchParams({ query });
  if (maxResults) params.set('max_results', maxResults);
  const res = await apiRequest({
    service: 'Twitter',
    method: 'GET',
    url: `${API}/tweets/search/recent?${params.toString()}`,
    headers: headers(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Twitter search → ${query}`] };
}

const block: ForgeBlock = {
  id: 'forge_twitter_v2_actions',
  name: 'Twitter V2 (extended)',
  description: 'Twitter v2 ops (create/delete tweet, user lookup, search).',
  iconName: 'LuTwitter',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'tweet_create',
      label: 'Create tweet',
      fields: [
        { id: 'bearerToken', label: 'Bearer token', type: 'password', required: true },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
      ],
      run: tweetCreate,
    },
    {
      id: 'tweet_delete',
      label: 'Delete tweet',
      fields: [
        { id: 'bearerToken', label: 'Bearer token', type: 'password', required: true },
        { id: 'tweetId', label: 'Tweet ID', type: 'text', required: true },
      ],
      run: tweetDelete,
    },
    {
      id: 'user_by_username',
      label: 'Get user by username',
      fields: [
        { id: 'bearerToken', label: 'Bearer token', type: 'password', required: true },
        { id: 'username', label: 'Username (no @)', type: 'text', required: true },
      ],
      run: userByUsername,
    },
    {
      id: 'tweet_search',
      label: 'Search recent tweets',
      fields: [
        { id: 'bearerToken', label: 'Bearer token', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'maxResults', label: 'Max results (10-100)', type: 'number', defaultValue: 10 },
      ],
      run: tweetSearch,
    },
  ],
};

registerForgeBlock(block);
export default block;
