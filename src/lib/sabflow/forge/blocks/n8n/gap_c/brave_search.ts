/**
 * Forge block: Brave Search
 *
 * `https://api.search.brave.com/res/v1` — web + news search.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.search.brave.com/res/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.subscriptionToken);
  if (!token) throw new Error('Brave Search: subscriptionToken is required');
  return {
    'X-Subscription-Token': token,
    Accept: 'application/json',
  };
}

async function webSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const q = asString(ctx.options.query);
  const count = asNumber(ctx.options.count) ?? 10;
  const country = asString(ctx.options.country);
  if (!q) throw new Error('Brave Search: query is required');
  const params = new URLSearchParams({ q, count: String(count) });
  if (country) params.set('country', country);
  const res = await apiRequest({
    service: 'Brave Search',
    method: 'GET',
    url: `${API}/web/search?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { results: res.data }, logs: [`Brave web search → ${q}`] };
}

async function newsSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const q = asString(ctx.options.query);
  const count = asNumber(ctx.options.count) ?? 10;
  if (!q) throw new Error('Brave Search: query is required');
  const res = await apiRequest({
    service: 'Brave Search',
    method: 'GET',
    url: `${API}/news/search?q=${encodeURIComponent(q)}&count=${count}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { results: res.data }, logs: [`Brave news search → ${q}`] };
}

const block: ForgeBlock = {
  id: 'forge_brave_search',
  name: 'Brave Search',
  description: 'Web and news search via the Brave Search API.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'web_search',
      label: 'Web search',
      fields: [
        { id: 'subscriptionToken', label: 'Subscription token', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'count', label: 'Count', type: 'number', defaultValue: 10 },
        { id: 'country', label: 'Country (e.g. US)', type: 'text' },
      ],
      run: webSearch,
    },
    {
      id: 'news_search',
      label: 'News search',
      fields: [
        { id: 'subscriptionToken', label: 'Subscription token', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'count', label: 'Count', type: 'number', defaultValue: 10 },
      ],
      run: newsSearch,
    },
  ],
};

registerForgeBlock(block);
export default block;
