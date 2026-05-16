/**
 * Forge block: Contentful (Content Delivery API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Contentful/Contentful.node.ts
 *
 * Contentful CDA — auth is a Bearer access token scoped to a space + env.
 *
 * Operations covered:
 *   - entry.list               GET /spaces/{space}/environments/{env}/entries
 *   - entry.get                GET /spaces/{space}/environments/{env}/entries/{id}
 *   - asset.list               GET /spaces/{space}/environments/{env}/assets
 *   - asset.get                GET /spaces/{space}/environments/{env}/assets/{id}
 *   - content_type.list        GET /spaces/{space}/environments/{env}/content_types
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://cdn.contentful.com';

function envBase(ctx: ForgeActionContext): string {
  const space = asString(ctx.options.spaceId).trim();
  if (!space) throw new Error('Contentful: spaceId is required');
  const env = asString(ctx.options.environment).trim() || 'master';
  return `${API}/spaces/${encodeURIComponent(space)}/environments/${encodeURIComponent(env)}`;
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Contentful: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

function buildSearchParams(ctx: ForgeActionContext, contentTypeField?: string): URLSearchParams {
  const params = new URLSearchParams();
  if (contentTypeField) {
    const ct = asString(ctx.options[contentTypeField]).trim();
    if (ct) params.set('content_type', ct);
  }
  const query = asString(ctx.options.query).trim();
  const limit = asString(ctx.options.limit).trim();
  const skip = asString(ctx.options.skip).trim();
  const order = asString(ctx.options.order).trim();
  if (query) params.set('query', query);
  if (limit) params.set('limit', limit);
  if (skip) params.set('skip', skip);
  if (order) params.set('order', order);
  return params;
}

async function entryList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = buildSearchParams(ctx, 'contentType');
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Contentful',
    method: 'GET',
    url: `${envBase(ctx)}/entries${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { entries: res.data }, logs: ['Contentful entry list'] };
}

async function entryGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.entryId);
  if (!id) throw new Error('Contentful: entryId is required');
  const res = await apiRequest({
    service: 'Contentful',
    method: 'GET',
    url: `${envBase(ctx)}/entries/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { entry: res.data }, logs: [`Contentful entry get → ${id}`] };
}

async function assetList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = buildSearchParams(ctx);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Contentful',
    method: 'GET',
    url: `${envBase(ctx)}/assets${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { assets: res.data }, logs: ['Contentful asset list'] };
}

async function assetGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.assetId);
  if (!id) throw new Error('Contentful: assetId is required');
  const res = await apiRequest({
    service: 'Contentful',
    method: 'GET',
    url: `${envBase(ctx)}/assets/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { asset: res.data }, logs: [`Contentful asset get → ${id}`] };
}

async function contentTypeList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Contentful',
    method: 'GET',
    url: `${envBase(ctx)}/content_types`,
    headers: authHeader(ctx),
  });
  return { outputs: { contentTypes: res.data }, logs: ['Contentful content_type list'] };
}

const CRED_FIELDS = [
  { id: 'spaceId', label: 'Space ID', type: 'text' as const, required: true },
  {
    id: 'environment',
    label: 'Environment',
    type: 'text' as const,
    defaultValue: 'master',
  },
  { id: 'accessToken', label: 'CDA access token', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_contentful',
  name: 'Contentful',
  description: 'Read Contentful entries, assets and content types via the Content Delivery API.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'entry_list',
      label: 'List entries',
      description: 'Fetch entries from a Contentful environment.',
      fields: [
        ...CRED_FIELDS,
        { id: 'contentType', label: 'Content type', type: 'text' },
        { id: 'query', label: 'Full-text query', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'skip', label: 'Skip', type: 'number' },
        { id: 'order', label: 'Order', type: 'text', placeholder: '-sys.createdAt' },
      ],
      run: entryList,
    },
    {
      id: 'entry_get',
      label: 'Get entry',
      description: 'Fetch a single entry by id.',
      fields: [
        ...CRED_FIELDS,
        { id: 'entryId', label: 'Entry ID', type: 'text', required: true },
      ],
      run: entryGet,
    },
    {
      id: 'asset_list',
      label: 'List assets',
      description: 'Fetch assets from a Contentful environment.',
      fields: [
        ...CRED_FIELDS,
        { id: 'query', label: 'Full-text query', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'skip', label: 'Skip', type: 'number' },
        { id: 'order', label: 'Order', type: 'text' },
      ],
      run: assetList,
    },
    {
      id: 'asset_get',
      label: 'Get asset',
      description: 'Fetch a single asset by id.',
      fields: [
        ...CRED_FIELDS,
        { id: 'assetId', label: 'Asset ID', type: 'text', required: true },
      ],
      run: assetGet,
    },
    {
      id: 'content_type_list',
      label: 'List content types',
      description: 'Fetch every content type in the environment.',
      fields: [...CRED_FIELDS],
      run: contentTypeList,
    },
  ],
};

registerForgeBlock(block);
export default block;
