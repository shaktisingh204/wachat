/**
 * Forge block: Microsoft SharePoint (Graph)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/SharePoint/MicrosoftSharePoint.node.ts
 * Credential type: 'microsoft_sharepoint' — { clientId, clientSecret, refreshToken }
 *
 * Operations (Graph v1.0):
 *   - site.list   GET  /sites?search=*
 *   - list.get    GET  /sites/{siteId}/lists/{listId}
 *   - list.items  GET  /sites/{siteId}/lists/{listId}/items?$expand=fields
 *   - item.create POST /sites/{siteId}/lists/{listId}/items
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, MICROSOFT_TOKEN_URL } from '../_shared/google_oauth';

const BASE = 'https://graph.microsoft.com/v1.0';
const SERVICE = 'Microsoft SharePoint';

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, ctx.credential, MICROSOFT_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method,
    url: `${BASE}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

async function siteList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const search = asString(ctx.options.search) || '*';
  const data = await call(ctx, 'GET', `/sites?search=${encodeURIComponent(search)}`);
  return { outputs: { result: data }, logs: ['SharePoint sites search'] };
}

async function listGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const siteId = asString(ctx.options.siteId);
  const listId = asString(ctx.options.listId);
  if (!siteId) throw new Error(`${SERVICE}: siteId is required`);
  if (!listId) throw new Error(`${SERVICE}: listId is required`);
  const data = await call(
    ctx,
    'GET',
    `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}`,
  );
  return { outputs: { result: data }, logs: [`SharePoint list get → ${listId}`] };
}

async function listItems(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const siteId = asString(ctx.options.siteId);
  const listId = asString(ctx.options.listId);
  if (!siteId) throw new Error(`${SERVICE}: siteId is required`);
  if (!listId) throw new Error(`${SERVICE}: listId is required`);
  const data = await call(
    ctx,
    'GET',
    `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items?$expand=fields`,
  );
  return { outputs: { result: data }, logs: [`SharePoint list items → ${listId}`] };
}

async function itemCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const siteId = asString(ctx.options.siteId);
  const listId = asString(ctx.options.listId);
  if (!siteId) throw new Error(`${SERVICE}: siteId is required`);
  if (!listId) throw new Error(`${SERVICE}: listId is required`);
  const fieldsRaw = asString(ctx.options.fields).trim();
  if (!fieldsRaw) throw new Error(`${SERVICE}: fields is required`);
  let fields: unknown;
  try {
    fields = JSON.parse(fieldsRaw);
  } catch {
    throw new Error(`${SERVICE}: fields must be valid JSON`);
  }
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw new Error(`${SERVICE}: fields must be a JSON object`);
  }
  const body = { fields };
  const data = await call(
    ctx,
    'POST',
    `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items`,
    body,
  );
  return { outputs: { result: data }, logs: [`SharePoint item create → ${listId}`] };
}

const block: ForgeBlock = {
  id: 'forge_microsoft_sharepoint',
  name: 'Microsoft SharePoint',
  description: 'Search sites, fetch lists/items and create list items in SharePoint.',
  iconName: 'LuLayoutGrid',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'microsoft_sharepoint' },
  actions: [
    {
      id: 'site_list',
      label: 'Search sites',
      description: 'Search SharePoint sites (default search = "*").',
      fields: [{ id: 'search', label: 'Search', type: 'text', defaultValue: '*' }],
      run: siteList,
    },
    {
      id: 'list_get',
      label: 'Get list',
      description: 'Get a SharePoint list by ID.',
      fields: [
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
      ],
      run: listGet,
    },
    {
      id: 'list_items',
      label: 'List items',
      description: 'List items in a SharePoint list (fields expanded).',
      fields: [
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
      ],
      run: listItems,
    },
    {
      id: 'item_create',
      label: 'Create list item',
      description: 'Create an item in a SharePoint list.',
      fields: [
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'fields', label: 'Fields (JSON object)', type: 'json', required: true },
      ],
      run: itemCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
