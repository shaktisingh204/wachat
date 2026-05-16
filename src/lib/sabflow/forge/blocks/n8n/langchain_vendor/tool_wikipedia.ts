/**
 * Forge block: LangChain Tool — Wikipedia
 *
 * Source: @n8n/nodes-langchain/nodes/tools/ToolWikipedia/
 *
 * Tool-call friendly Wikipedia lookup. Uses the public MediaWiki endpoint
 * `en.wikipedia.org/w/api.php` — no credential required.
 *
 * Actions:
 *   - search(query) → top opensearch matches (title + snippet + url)
 *   - summary(title) → first paragraph extract for a given page title
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://en.wikipedia.org/w/api.php';

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query).trim();
  if (!query) throw new Error('Wikipedia: query is required');

  const url =
    `${API}?action=opensearch&format=json&limit=5&search=${encodeURIComponent(query)}`;
  const res = await apiRequest({ service: 'Wikipedia', method: 'GET', url });

  // opensearch returns [query, titles[], descriptions[], urls[]]
  const tuple = Array.isArray(res.data) ? (res.data as unknown[]) : [];
  const titles = Array.isArray(tuple[1]) ? (tuple[1] as string[]) : [];
  const descs = Array.isArray(tuple[2]) ? (tuple[2] as string[]) : [];
  const urls = Array.isArray(tuple[3]) ? (tuple[3] as string[]) : [];

  const results = titles.map((title, i) => ({
    title,
    snippet: descs[i] ?? '',
    url: urls[i] ?? '',
  }));

  const text = results
    .map((r) => `• ${r.title} — ${r.snippet}\n  ${r.url}`)
    .join('\n');

  return {
    outputs: { results, text, count: results.length },
    logs: [`Wikipedia search "${query}" → ${results.length} result(s)`],
  };
}

async function summary(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title).trim();
  if (!title) throw new Error('Wikipedia: title is required');

  const url =
    `${API}?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}&origin=*`;
  const res = await apiRequest({ service: 'Wikipedia', method: 'GET', url });

  const pages =
    (res.data as { query?: { pages?: Record<string, { extract?: string; title?: string }> } })
      ?.query?.pages ?? {};
  const first = Object.values(pages)[0] ?? {};
  const extract = asString(first.extract);
  const resolvedTitle = asString(first.title) || title;

  return {
    outputs: { title: resolvedTitle, extract, text: extract },
    logs: [`Wikipedia summary "${resolvedTitle}" → ${extract.length} chars`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_wikipedia',
  name: 'LangChain Tool — Wikipedia',
  description: 'Search Wikipedia or fetch an article summary. No credential needed.',
  iconName: 'LuBookOpen',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Search Wikipedia',
      description: 'Return top 5 matches for a query (title + snippet + url).',
      fields: [
        { id: 'query', label: 'Query', type: 'text', required: true, placeholder: 'Alan Turing' },
      ],
      run: search,
    },
    {
      id: 'summary',
      label: 'Get article summary',
      description: 'Return the lead extract for a specific page title.',
      fields: [
        { id: 'title', label: 'Article title', type: 'text', required: true, placeholder: 'Alan Turing' },
      ],
      run: summary,
    },
  ],
};

registerForgeBlock(block);
export default block;
