/**
 * Forge block: Tavily search
 *
 * `https://api.tavily.com` — AI-native web search optimised for LLMs.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.tavily.com';

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  const query = asString(ctx.options.query);
  const searchDepth = asString(ctx.options.searchDepth) || 'basic';
  const maxResults = asNumber(ctx.options.maxResults) ?? 5;
  const includeAnswer = ctx.options.includeAnswer === true;
  if (!apiKey) throw new Error('Tavily: apiKey is required');
  if (!query) throw new Error('Tavily: query is required');
  const res = await apiRequest({
    service: 'Tavily',
    method: 'POST',
    url: `${API}/search`,
    json: {
      api_key: apiKey,
      query,
      search_depth: searchDepth,
      max_results: maxResults,
      include_answer: includeAnswer,
    },
  });
  return { outputs: { results: res.data }, logs: [`Tavily search → ${query}`] };
}

async function extract(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  const urlsRaw = asString(ctx.options.urls);
  if (!apiKey) throw new Error('Tavily: apiKey is required');
  const urls = urlsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  if (urls.length === 0) throw new Error('Tavily: urls is required');
  const res = await apiRequest({
    service: 'Tavily',
    method: 'POST',
    url: `${API}/extract`,
    json: { api_key: apiKey, urls },
  });
  return { outputs: { results: res.data }, logs: [`Tavily extract ${urls.length} url(s)`] };
}

const block: ForgeBlock = {
  id: 'forge_tavily_search',
  name: 'Tavily Search',
  description: 'LLM-optimised web search and content extraction via Tavily.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Search',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'searchDepth', label: 'Depth (basic/advanced)', type: 'text', defaultValue: 'basic' },
        { id: 'maxResults', label: 'Max results', type: 'number', defaultValue: 5 },
        { id: 'includeAnswer', label: 'Include answer summary', type: 'toggle' },
      ],
      run: search,
    },
    {
      id: 'extract',
      label: 'Extract content',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'urls', label: 'URLs (comma separated)', type: 'textarea', required: true },
      ],
      run: extract,
    },
  ],
};

registerForgeBlock(block);
export default block;
