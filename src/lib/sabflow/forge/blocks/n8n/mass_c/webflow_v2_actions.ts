/**
 * Forge block: Webflow V2 (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Webflow/V2/WebflowV2.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.webflow.com/v2';

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.webflowToken);
  if (!token) throw new Error('Webflow: webflowToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function sitesList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Webflow',
    method: 'GET',
    url: `${API}/sites`,
    headers: headers(ctx),
  });
  return { outputs: { result: res.data }, logs: ['Webflow sites list'] };
}

async function collectionsList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const siteId = asString(ctx.options.siteId);
  if (!siteId) throw new Error('Webflow: siteId is required');
  const res = await apiRequest({
    service: 'Webflow',
    method: 'GET',
    url: `${API}/sites/${encodeURIComponent(siteId)}/collections`,
    headers: headers(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Webflow collections → ${siteId}`] };
}

async function itemPublish(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collectionId = asString(ctx.options.collectionId);
  const itemIds = asString(ctx.options.itemIds);
  if (!collectionId || !itemIds)
    throw new Error('Webflow: collectionId and itemIds are required');
  const res = await apiRequest({
    service: 'Webflow',
    method: 'POST',
    url: `${API}/collections/${encodeURIComponent(collectionId)}/items/publish`,
    headers: headers(ctx),
    json: { itemIds: itemIds.split(',').map((s) => s.trim()).filter(Boolean) },
  });
  return { outputs: { result: res.data }, logs: [`Webflow publish items → ${collectionId}`] };
}

async function sitePublish(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const siteId = asString(ctx.options.siteId);
  const domains = asString(ctx.options.customDomains);
  if (!siteId) throw new Error('Webflow: siteId is required');
  const body: Record<string, unknown> = {};
  if (domains) body.customDomains = domains.split(',').map((s) => s.trim()).filter(Boolean);
  const res = await apiRequest({
    service: 'Webflow',
    method: 'POST',
    url: `${API}/sites/${encodeURIComponent(siteId)}/publish`,
    headers: headers(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Webflow site publish → ${siteId}`] };
}

const block: ForgeBlock = {
  id: 'forge_webflow_v2_actions',
  name: 'Webflow V2 (extended)',
  description: 'Webflow ops (sites, collections, publish items, publish site).',
  iconName: 'LuLayoutDashboard',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'sites_list',
      label: 'List sites',
      fields: [{ id: 'webflowToken', label: 'API token', type: 'password', required: true }],
      run: sitesList,
    },
    {
      id: 'collections_list',
      label: 'List collections',
      fields: [
        { id: 'webflowToken', label: 'API token', type: 'password', required: true },
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
      ],
      run: collectionsList,
    },
    {
      id: 'item_publish',
      label: 'Publish collection items',
      fields: [
        { id: 'webflowToken', label: 'API token', type: 'password', required: true },
        { id: 'collectionId', label: 'Collection ID', type: 'text', required: true },
        { id: 'itemIds', label: 'Item IDs (CSV)', type: 'text', required: true },
      ],
      run: itemPublish,
    },
    {
      id: 'site_publish',
      label: 'Publish site',
      fields: [
        { id: 'webflowToken', label: 'API token', type: 'password', required: true },
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
        { id: 'customDomains', label: 'Custom domains (CSV)', type: 'text' },
      ],
      run: sitePublish,
    },
  ],
};

registerForgeBlock(block);
export default block;
