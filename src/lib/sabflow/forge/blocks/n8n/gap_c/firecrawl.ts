/**
 * Forge block: Firecrawl
 *
 * `https://api.firecrawl.dev/v1` — scrape, crawl, map, and search.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.firecrawl.dev/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Firecrawl: apiKey is required');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

async function scrape(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  const formats = asString(ctx.options.formats) || 'markdown';
  const onlyMain = ctx.options.onlyMainContent !== false;
  if (!url) throw new Error('Firecrawl: url is required');
  const body = {
    url,
    formats: formats.split(',').map((s) => s.trim()),
    onlyMainContent: onlyMain,
  };
  const res = await apiRequest({
    service: 'Firecrawl',
    method: 'POST',
    url: `${API}/scrape`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Firecrawl scrape → ${url}`] };
}

async function crawl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  const limit = asString(ctx.options.limit);
  if (!url) throw new Error('Firecrawl: url is required');
  const body: Record<string, unknown> = { url };
  if (limit) body.limit = Number(limit);
  const res = await apiRequest({
    service: 'Firecrawl',
    method: 'POST',
    url: `${API}/crawl`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { job: res.data }, logs: [`Firecrawl crawl → ${url}`] };
}

async function map(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  const search = asString(ctx.options.search);
  if (!url) throw new Error('Firecrawl: url is required');
  const body: Record<string, unknown> = { url };
  if (search) body.search = search;
  const res = await apiRequest({
    service: 'Firecrawl',
    method: 'POST',
    url: `${API}/map`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { urls: res.data }, logs: [`Firecrawl map → ${url}`] };
}

const block: ForgeBlock = {
  id: 'forge_firecrawl',
  name: 'Firecrawl',
  description: 'Scrape and crawl websites for clean markdown via Firecrawl.',
  iconName: 'LuGlobe',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'scrape',
      label: 'Scrape URL',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'url', label: 'URL', type: 'text', required: true },
        { id: 'formats', label: 'Formats (comma: markdown,html)', type: 'text', defaultValue: 'markdown' },
        { id: 'onlyMainContent', label: 'Only main content', type: 'toggle', defaultValue: true },
      ],
      run: scrape,
    },
    {
      id: 'crawl',
      label: 'Crawl site',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'url', label: 'Start URL', type: 'text', required: true },
        { id: 'limit', label: 'Page limit', type: 'number' },
      ],
      run: crawl,
    },
    {
      id: 'map',
      label: 'Map site URLs',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'url', label: 'URL', type: 'text', required: true },
        { id: 'search', label: 'Search filter', type: 'text' },
      ],
      run: map,
    },
  ],
};

registerForgeBlock(block);
export default block;
