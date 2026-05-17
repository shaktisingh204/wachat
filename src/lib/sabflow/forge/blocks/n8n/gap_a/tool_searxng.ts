/**
 * Forge block: LangChain Tool — SearXNG.
 *
 * Queries a SearXNG instance over its JSON API (`/search?format=json&q=...`).
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

type SearxResult = {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
};

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const instance = asString(ctx.options.instanceUrl).trim().replace(/\/+$/, '');
  if (!instance) throw new Error('SearXNG: instanceUrl is required');
  const query = asString(ctx.options.query);
  if (!query) throw new Error('SearXNG: query is required');
  const apiKey = asString(ctx.options.apiKey);
  const categories = asString(ctx.options.categories);
  const language = asString(ctx.options.language);
  const limit = asNumber(ctx.options.limit) ?? 10;

  const url = new URL(`${instance}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  if (categories) url.searchParams.set('categories', categories);
  if (language) url.searchParams.set('language', language);

  const res = await apiRequest({
    service: 'SearXNG',
    method: 'GET',
    url: url.toString(),
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  const body = res.data as { results?: SearxResult[] };
  const all = body?.results ?? [];
  const results = all.slice(0, Math.max(0, limit));
  return {
    outputs: { results, count: results.length, total: all.length, raw: res.data },
    logs: [`SearXNG search → ${results.length}/${all.length}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_tool_searxng',
  name: 'Tool: SearXNG',
  description: 'Search the web through a self-hosted SearXNG instance.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Search',
      description: 'Run a search query against a SearXNG instance.',
      fields: [
        {
          id: 'instanceUrl',
          label: 'Instance URL',
          type: 'text',
          required: true,
          placeholder: 'https://searx.example.org',
        },
        { id: 'apiKey', label: 'Bearer token (optional)', type: 'password' },
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'categories', label: 'Categories (comma-separated)', type: 'text', placeholder: 'general,news' },
        { id: 'language', label: 'Language', type: 'text', placeholder: 'en' },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 10 },
      ],
      run: search,
    },
  ],
};

registerForgeBlock(block);
export default block;
