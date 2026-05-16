/**
 * Forge block: Tavily Search Tool
 *
 * Wraps https://api.tavily.com/search — a search API tuned for LLM agents
 * (returns a synthesised answer + structured results).
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asBoolean, asNumber, asString } from '../_shared/http';

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Tavily: apiKey is required');
  const query = asString(ctx.options.query);
  if (!query) throw new Error('Tavily: query is required');
  const maxResults = asNumber(ctx.options.maxResults) ?? 5;
  const depth = asString(ctx.options.depth) || 'basic';
  const includeAnswer = asBoolean(ctx.options.includeAnswer);
  const includeRaw = asBoolean(ctx.options.includeRaw);

  const result = await apiRequest({
    service: 'Tavily',
    method: 'POST',
    url: 'https://api.tavily.com/search',
    json: {
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: depth,
      include_answer: includeAnswer,
      include_raw_content: includeRaw,
    },
  });

  const data = result.data as {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string }>;
  };
  const results = (data.results ?? []).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    content: r.content ?? '',
    raw: r.raw_content ?? '',
  }));
  return {
    outputs: { answer: data.answer ?? '', results, raw: data },
    logs: [`Tavily search → ${results.length} result(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_tavily',
  name: 'Tavily Search',
  description: 'Agent-tuned web search via Tavily (returns answer + structured results).',
  iconName: 'LuGlobe',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Search',
      fields: [
        { id: 'apiKey', label: 'API Key', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'maxResults', label: 'Max results', type: 'number', defaultValue: 5 },
        {
          id: 'depth',
          label: 'Search depth',
          type: 'select',
          defaultValue: 'basic',
          options: [
            { label: 'Basic', value: 'basic' },
            { label: 'Advanced', value: 'advanced' },
          ],
        },
        { id: 'includeAnswer', label: 'Include synthesised answer', type: 'toggle', defaultValue: true },
        { id: 'includeRaw', label: 'Include raw page content', type: 'toggle', defaultValue: false },
      ],
      run: search,
    },
  ],
};

registerForgeBlock(block);
export default block;
