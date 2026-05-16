/**
 * Forge block: Google Books
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Books/GoogleBooks.node.ts
 *
 * Auth: public API key (no OAuth) — `key` query parameter passed inline.
 *
 * REST base: https://www.googleapis.com/books/v1
 *
 * Operations:
 *   - volume.search GET /volumes?q={q}
 *   - volume.get    GET /volumes/{volumeId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const SERVICE = 'Google Books';
const BASE = 'https://www.googleapis.com/books/v1';

const authFields = [
  { id: 'apiKey', label: 'API key', type: 'password' as const, placeholder: 'Optional — increases quota' },
];

async function volumeSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const q = asString(ctx.options.q);
  if (!q) throw new Error(`${SERVICE}: q (search query) is required`);
  const apiKey = asString(ctx.options.apiKey);
  const maxResults = asString(ctx.options.maxResults);
  const params = new URLSearchParams();
  params.set('q', q);
  if (apiKey) params.set('key', apiKey);
  if (maxResults) params.set('maxResults', maxResults);
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `${BASE}/volumes?${params.toString()}`,
  });
  return { outputs: { result: res.data }, logs: [`Books search → ${q}`] };
}

async function volumeGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const volumeId = asString(ctx.options.volumeId);
  if (!volumeId) throw new Error(`${SERVICE}: volumeId is required`);
  const apiKey = asString(ctx.options.apiKey);
  const qs = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `${BASE}/volumes/${encodeURIComponent(volumeId)}${qs}`,
  });
  return { outputs: { result: res.data }, logs: [`Books get → ${volumeId}`] };
}

const block: ForgeBlock = {
  id: 'forge_google_books',
  name: 'Google Books',
  description: 'Search for and fetch volumes from the Google Books catalogue.',
  iconName: 'LuBook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'volume_search',
      label: 'Search volumes',
      description: 'Search the Books catalogue by free-text query.',
      fields: [
        ...authFields,
        { id: 'q', label: 'Query', type: 'text', required: true, placeholder: 'tolkien' },
        { id: 'maxResults', label: 'Max results', type: 'number', placeholder: '10' },
      ],
      run: volumeSearch,
    },
    {
      id: 'volume_get',
      label: 'Get volume',
      description: 'Fetch a single volume by id.',
      fields: [
        ...authFields,
        { id: 'volumeId', label: 'Volume ID', type: 'text', required: true },
      ],
      run: volumeGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
