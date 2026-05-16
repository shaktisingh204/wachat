/**
 * Forge block: Webflow
 *
 * Source: n8n-master/packages/nodes-base/nodes/Webflow/Webflow.node.ts
 * Credential type: 'webflow' (CREDENTIAL_FIELD_SCHEMAS → { apiToken })
 *
 * Operations:
 *   - site.list       GET  /sites
 *   - item.create     POST /collections/{collectionId}/items
 *   - item.get        GET  /collections/{collectionId}/items/{itemId}
 *   - item.list       GET  /collections/{collectionId}/items
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.webflow.com';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Webflow', ctx.credential);
  const token = cred.apiToken;
  if (!token) throw new Error('Webflow: credential is missing `apiToken`');
  return {
    Authorization: `Bearer ${token}`,
    'accept-version': '1.0.0',
  };
}

async function siteList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Webflow',
    method: 'GET',
    url: `${BASE}/sites`,
    headers: authHeaders(ctx),
  });
  return { outputs: { sites: res.data }, logs: ['Webflow sites list'] };
}

async function itemCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collectionId = asString(ctx.options.collectionId);
  if (!collectionId) throw new Error('Webflow: collectionId is required');
  const fieldsRaw = asString(ctx.options.fields);
  if (!fieldsRaw) throw new Error('Webflow: fields JSON is required');
  let fields: Record<string, unknown>;
  try {
    fields = JSON.parse(fieldsRaw) as Record<string, unknown>;
  } catch {
    throw new Error('Webflow: fields must be valid JSON');
  }

  const live = ctx.options.live === true || ctx.options.live === 'true';
  const url = `${BASE}/collections/${encodeURIComponent(collectionId)}/items${live ? '?live=true' : ''}`;

  const res = await apiRequest({
    service: 'Webflow',
    method: 'POST',
    url,
    headers: authHeaders(ctx),
    json: { fields },
  });
  return { outputs: { item: res.data }, logs: [`Webflow item create → ${collectionId}`] };
}

async function itemGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collectionId = asString(ctx.options.collectionId);
  const itemId = asString(ctx.options.itemId);
  if (!collectionId) throw new Error('Webflow: collectionId is required');
  if (!itemId) throw new Error('Webflow: itemId is required');

  const res = await apiRequest({
    service: 'Webflow',
    method: 'GET',
    url: `${BASE}/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { item: res.data }, logs: [`Webflow item get → ${itemId}`] };
}

async function itemList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collectionId = asString(ctx.options.collectionId);
  if (!collectionId) throw new Error('Webflow: collectionId is required');
  const params = new URLSearchParams();
  if (asString(ctx.options.limit)) params.set('limit', asString(ctx.options.limit));
  if (asString(ctx.options.offset)) params.set('offset', asString(ctx.options.offset));
  const qs = params.toString();

  const res = await apiRequest({
    service: 'Webflow',
    method: 'GET',
    url: `${BASE}/collections/${encodeURIComponent(collectionId)}/items${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { items: res.data }, logs: [`Webflow item list → ${collectionId}`] };
}

const block: ForgeBlock = {
  id: 'forge_webflow',
  name: 'Webflow',
  description: 'Create and read Webflow CMS items.',
  iconName: 'LuLayoutDashboard',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'webflow' },
  actions: [
    {
      id: 'site_list',
      label: 'List sites',
      description: 'List all sites accessible to the API token.',
      fields: [],
      run: siteList,
    },
    {
      id: 'item_create',
      label: 'Create CMS item',
      description: 'Create a new item in a Webflow collection.',
      fields: [
        { id: 'collectionId', label: 'Collection ID', type: 'text', required: true },
        {
          id: 'fields',
          label: 'Fields (JSON)',
          type: 'json',
          required: true,
          placeholder: '{"name":"My item","slug":"my-item","_archived":false,"_draft":false}',
        },
        { id: 'live', label: 'Publish live', type: 'toggle' },
      ],
      run: itemCreate,
    },
    {
      id: 'item_get',
      label: 'Get CMS item',
      description: 'Fetch a single item by id.',
      fields: [
        { id: 'collectionId', label: 'Collection ID', type: 'text', required: true },
        { id: 'itemId', label: 'Item ID', type: 'text', required: true },
      ],
      run: itemGet,
    },
    {
      id: 'item_list',
      label: 'List CMS items',
      description: 'List items in a collection with optional pagination.',
      fields: [
        { id: 'collectionId', label: 'Collection ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'offset', label: 'Offset', type: 'number' },
      ],
      run: itemList,
    },
  ],
};

registerForgeBlock(block);
export default block;
