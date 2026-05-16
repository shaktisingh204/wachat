/**
 * Forge block: Brave Search Tool
 *
 * Wraps https://api.search.brave.com/res/v1/web/search — a privacy-focused
 * web search API. Subscription token goes in the `X-Subscription-Token` header.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Brave Search: apiKey is required');
  const query = asString(ctx.options.query);
  if (!query) throw new Error('Brave Search: query is required');
  const count = asNumber(ctx.options.count) ?? 10;
  const country = asString(ctx.options.country) || 'US';
  const safeSearch = asString(ctx.options.safeSearch) || 'moderate';

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(count));
  url.searchParams.set('country', country);
  url.searchParams.set('safesearch', safeSearch);

  const result = await apiRequest({
    service: 'Brave Search',
    method: 'GET',
    url: url.toString(),
    headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
  });

  const data = result.data as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  const results = (data.web?.results ?? []).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    description: r.description ?? '',
  }));
  return { outputs: { results, raw: data }, logs: [`Brave Search → ${results.length} result(s)`] };
}

const block: ForgeBlock = {
  id: 'forge_tool_brave_search',
  name: 'Brave Search',
  description: 'Search the web via the Brave Search API.',
  iconName: 'LuShield',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Web search',
      fields: [
        { id: 'apiKey', label: 'Subscription Token', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'count', label: 'Result count', type: 'number', defaultValue: 10 },
        { id: 'country', label: 'Country', type: 'text', defaultValue: 'US' },
        {
          id: 'safeSearch',
          label: 'Safe search',
          type: 'select',
          defaultValue: 'moderate',
          options: [
            { label: 'Off', value: 'off' },
            { label: 'Moderate', value: 'moderate' },
            { label: 'Strict', value: 'strict' },
          ],
        },
      ],
      run: search,
    },
  ],
};

registerForgeBlock(block);
export default block;
