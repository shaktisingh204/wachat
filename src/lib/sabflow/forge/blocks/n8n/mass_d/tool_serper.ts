/**
 * Forge block: Serper.dev Search Tool
 *
 * Wraps https://serper.dev/ — a low-cost Google SERP API used by many
 * LangChain examples. Inline API key, no SDK.
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
  if (!apiKey) throw new Error('Serper: apiKey is required');
  const query = asString(ctx.options.query);
  if (!query) throw new Error('Serper: query is required');
  const num = asNumber(ctx.options.num) ?? 10;
  const gl = asString(ctx.options.gl) || 'us';
  const hl = asString(ctx.options.hl) || 'en';

  const result = await apiRequest({
    service: 'Serper',
    method: 'POST',
    url: 'https://google.serper.dev/search',
    headers: { 'X-API-KEY': apiKey },
    json: { q: query, num, gl, hl },
  });

  const data = result.data as { organic?: Array<{ title?: string; link?: string; snippet?: string }>; answerBox?: unknown };
  const organic = (data.organic ?? []).map((r) => ({
    title: r.title ?? '',
    link: r.link ?? '',
    snippet: r.snippet ?? '',
  }));
  return {
    outputs: { results: organic, answerBox: data.answerBox ?? null, raw: data },
    logs: [`Serper search → ${organic.length} result(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_serper',
  name: 'Serper Search',
  description: 'Search Google via the Serper.dev API.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Web search',
      fields: [
        { id: 'apiKey', label: 'API Key', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'num', label: 'Result count', type: 'number', defaultValue: 10 },
        { id: 'gl', label: 'Country (gl)', type: 'text', defaultValue: 'us' },
        { id: 'hl', label: 'Language (hl)', type: 'text', defaultValue: 'en' },
      ],
      run: search,
    },
  ],
};

registerForgeBlock(block);
export default block;
