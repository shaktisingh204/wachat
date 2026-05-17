/**
 * Forge block: Exa search
 *
 * `https://api.exa.ai` — neural search with contents retrieval.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.exa.ai';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Exa: apiKey is required');
  return { 'x-api-key': apiKey, Accept: 'application/json' };
}

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  const numResults = asNumber(ctx.options.numResults) ?? 10;
  const type = asString(ctx.options.type) || 'auto';
  if (!query) throw new Error('Exa: query is required');
  const res = await apiRequest({
    service: 'Exa',
    method: 'POST',
    url: `${API}/search`,
    headers: authHeaders(ctx),
    json: { query, numResults, type },
  });
  return { outputs: { results: res.data }, logs: [`Exa search → ${query}`] };
}

async function searchAndContents(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  const numResults = asNumber(ctx.options.numResults) ?? 10;
  const includeText = ctx.options.includeText !== false;
  if (!query) throw new Error('Exa: query is required');
  const body: Record<string, unknown> = {
    query,
    numResults,
    contents: { text: includeText },
  };
  const res = await apiRequest({
    service: 'Exa',
    method: 'POST',
    url: `${API}/search`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { results: res.data }, logs: [`Exa search+contents → ${query}`] };
}

async function findSimilar(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  const numResults = asNumber(ctx.options.numResults) ?? 10;
  if (!url) throw new Error('Exa: url is required');
  const res = await apiRequest({
    service: 'Exa',
    method: 'POST',
    url: `${API}/findSimilar`,
    headers: authHeaders(ctx),
    json: { url, numResults },
  });
  return { outputs: { results: res.data }, logs: [`Exa findSimilar → ${url}`] };
}

const block: ForgeBlock = {
  id: 'forge_exa_search',
  name: 'Exa Search',
  description: 'Neural web search and contents retrieval via Exa.',
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
        { id: 'numResults', label: 'Num results', type: 'number', defaultValue: 10 },
        { id: 'type', label: 'Type (auto/neural/keyword)', type: 'text', defaultValue: 'auto' },
      ],
      run: search,
    },
    {
      id: 'search_and_contents',
      label: 'Search and get contents',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'numResults', label: 'Num results', type: 'number', defaultValue: 10 },
        { id: 'includeText', label: 'Include text', type: 'toggle', defaultValue: true },
      ],
      run: searchAndContents,
    },
    {
      id: 'find_similar',
      label: 'Find similar',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'url', label: 'URL', type: 'text', required: true },
        { id: 'numResults', label: 'Num results', type: 'number', defaultValue: 10 },
      ],
      run: findSimilar,
    },
  ],
};

registerForgeBlock(block);
export default block;
