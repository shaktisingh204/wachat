/**
 * Forge block: Raindrop
 *
 * Source: n8n-master/packages/nodes-base/nodes/Raindrop/Raindrop.node.ts
 * Auth: `Authorization: Bearer <accessToken>` — inline as `password`.
 *
 * Operations covered:
 *   - raindrop.create     POST   /raindrop
 *   - raindrop.get        GET    /raindrop/{id}
 *   - raindrop.list       GET    /raindrops/{collectionId}
 *   - collection.list     GET    /collections
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.raindrop.io/rest/v1';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Raindrop: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function raindropCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const link = asString(ctx.options.link);
  if (!link) throw new Error('Raindrop: link is required');
  const body: Record<string, unknown> = { link };
  const title = asString(ctx.options.title);
  const collectionId = asNumber(ctx.options.collectionId);
  const tags = asString(ctx.options.tags);
  if (title) body.title = title;
  if (collectionId !== undefined) body.collection = { $id: collectionId };
  if (tags) body.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
  const res = await apiRequest({
    service: 'Raindrop',
    method: 'POST',
    url: `${API}/raindrop`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { raindrop: res.data }, logs: [`Raindrop raindrop.create → ${link}`] };
}

async function raindropGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.raindropId);
  if (!id) throw new Error('Raindrop: raindropId is required');
  const res = await apiRequest({
    service: 'Raindrop',
    method: 'GET',
    url: `${API}/raindrop/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { raindrop: res.data }, logs: [`Raindrop raindrop.get → ${id}`] };
}

async function raindropList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  // Collection id 0 = all raindrops; -1 = unsorted; -99 = trash.
  const collectionId = asString(ctx.options.collectionId) || '0';
  const params = new URLSearchParams();
  const page = asString(ctx.options.page);
  const perPage = asString(ctx.options.perPage);
  const search = asString(ctx.options.search);
  if (page) params.set('page', page);
  if (perPage) params.set('perpage', perPage);
  if (search) params.set('search', search);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Raindrop',
    method: 'GET',
    url: `${API}/raindrops/${encodeURIComponent(collectionId)}${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { raindrops: res.data }, logs: [`Raindrop raindrop.list → collection ${collectionId}`] };
}

async function collectionList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Raindrop',
    method: 'GET',
    url: `${API}/collections`,
    headers: authHeader(ctx),
  });
  return { outputs: { collections: res.data }, logs: ['Raindrop collection.list'] };
}

const block: ForgeBlock = {
  id: 'forge_raindrop',
  name: 'Raindrop',
  description: 'Save and browse Raindrop.io bookmarks and collections.',
  iconName: 'LuBookmark',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'raindrop_create',
      label: 'Create raindrop',
      description: 'Save a new bookmark.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'link', label: 'Link', type: 'text', required: true, placeholder: 'https://…' },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'collectionId', label: 'Collection id', type: 'number' },
        { id: 'tags', label: 'Tags (comma-separated)', type: 'text' },
      ],
      run: raindropCreate,
    },
    {
      id: 'raindrop_get',
      label: 'Get raindrop',
      description: 'Fetch a single raindrop by id.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'raindropId', label: 'Raindrop id', type: 'text', required: true },
      ],
      run: raindropGet,
    },
    {
      id: 'raindrop_list',
      label: 'List raindrops',
      description: 'List raindrops in a collection (0 = all, -1 = unsorted).',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'collectionId', label: 'Collection id', type: 'text', defaultValue: '0' },
        { id: 'page', label: 'Page', type: 'number' },
        { id: 'perPage', label: 'Per page', type: 'number' },
        { id: 'search', label: 'Search query', type: 'text' },
      ],
      run: raindropList,
    },
    {
      id: 'collection_list',
      label: 'List collections',
      description: 'List all root collections.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
      ],
      run: collectionList,
    },
  ],
};

registerForgeBlock(block);
export default block;
