/**
 * Forge block: LangChain Tool — SerpAPI
 *
 * Source: @n8n/nodes-langchain/nodes/tools/ToolSerpApi/
 *
 * Web search via https://serpapi.com/search. The API key is inlined per
 * action (rather than a SabFlow credential) so an LLM agent can wire it up
 * from a single options object.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

type SerpOrganic = { title?: string; link?: string; snippet?: string };

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey).trim();
  const query = asString(ctx.options.query).trim();
  if (!apiKey) throw new Error('SerpAPI: apiKey is required');
  if (!query) throw new Error('SerpAPI: query is required');

  const engine = asString(ctx.options.engine) || 'google';
  const url =
    `https://serpapi.com/search?engine=${encodeURIComponent(engine)}&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}`;

  const res = await apiRequest({ service: 'SerpAPI', method: 'GET', url });

  const data = (res.data ?? {}) as { organic_results?: SerpOrganic[]; answer_box?: unknown };
  const organic = Array.isArray(data.organic_results) ? data.organic_results : [];
  const results = organic.slice(0, 10).map((r) => ({
    title: asString(r.title),
    link: asString(r.link),
    snippet: asString(r.snippet),
  }));

  const text = results
    .map((r) => `• ${r.title}\n  ${r.snippet}\n  ${r.link}`)
    .join('\n');

  return {
    outputs: { results, answer_box: data.answer_box, text, count: results.length },
    logs: [`SerpAPI ${engine} "${query}" → ${results.length} result(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_serpapi',
  name: 'LangChain Tool — SerpAPI',
  description: 'Run a web search via SerpAPI and return organic results.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Search the web',
      fields: [
        { id: 'apiKey', label: 'SerpAPI key', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true, placeholder: 'latest SabFlow release notes' },
        {
          id: 'engine',
          label: 'Engine',
          type: 'select',
          defaultValue: 'google',
          options: [
            { label: 'Google', value: 'google' },
            { label: 'Bing', value: 'bing' },
            { label: 'DuckDuckGo', value: 'duckduckgo' },
            { label: 'Yahoo', value: 'yahoo' },
          ],
        },
      ],
      run: search,
    },
  ],
};

registerForgeBlock(block);
export default block;
