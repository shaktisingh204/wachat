/**
 * Forge block: Bitwarden
 *
 * Source: n8n-master/packages/nodes-base/nodes/Bitwarden/Bitwarden.node.ts
 *
 * Bitwarden Public API. Inline auth: base URL + bearer access token (the
 * caller is expected to mint the token via the Bitwarden identity endpoint
 * — we don't bake that exchange in to keep this block stateless).
 *
 * Operations covered:
 *   - vault.item.list      GET    /public/ciphers (loosely matched to public-api shape)
 *   - vault.item.get       GET    /public/ciphers/{id}
 *   - vault.item.create    POST   /public/ciphers
 *   - collection.list      GET    /public/collections
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function base(ctx: ForgeActionContext): string {
  const raw = asString(ctx.options.baseUrl) || 'https://api.bitwarden.com';
  return raw.replace(/\/+$/, '');
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Bitwarden: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function itemList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Bitwarden',
    method: 'GET',
    url: `${base(ctx)}/public/ciphers`,
    headers: authHeader(ctx),
  });
  return { outputs: { items: res.data }, logs: ['Bitwarden vault.item.list'] };
}

async function itemGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.itemId);
  if (!id) throw new Error('Bitwarden: itemId is required');
  const res = await apiRequest({
    service: 'Bitwarden',
    method: 'GET',
    url: `${base(ctx)}/public/ciphers/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { item: res.data }, logs: [`Bitwarden vault.item.get → ${id}`] };
}

async function itemCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Bitwarden: name is required');
  const notes = asString(ctx.options.notes);
  const folderId = asString(ctx.options.folderId);
  const organizationId = asString(ctx.options.organizationId);
  const body: Record<string, unknown> = { name, type: 1 };
  if (notes) body.notes = notes;
  if (folderId) body.folderId = folderId;
  if (organizationId) body.organizationId = organizationId;
  const res = await apiRequest({
    service: 'Bitwarden',
    method: 'POST',
    url: `${base(ctx)}/public/ciphers`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { item: res.data }, logs: [`Bitwarden vault.item.create → ${name}`] };
}

async function collectionList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Bitwarden',
    method: 'GET',
    url: `${base(ctx)}/public/collections`,
    headers: authHeader(ctx),
  });
  return { outputs: { collections: res.data }, logs: ['Bitwarden collection.list'] };
}

const credFields = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, defaultValue: 'https://api.bitwarden.com' },
  { id: 'accessToken', label: 'Access token', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_bitwarden',
  name: 'Bitwarden',
  description: 'Manage Bitwarden vault items and collections via the Public API.',
  iconName: 'LuShield',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'item_list',
      label: 'List vault items',
      description: 'List ciphers visible to the configured access token.',
      fields: [...credFields],
      run: itemList,
    },
    {
      id: 'item_get',
      label: 'Get vault item',
      description: 'Fetch a single cipher by id.',
      fields: [
        ...credFields,
        { id: 'itemId', label: 'Item ID', type: 'text', required: true },
      ],
      run: itemGet,
    },
    {
      id: 'item_create',
      label: 'Create vault item',
      description: 'Create a login-type cipher.',
      fields: [
        ...credFields,
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'notes', label: 'Notes', type: 'textarea' },
        { id: 'folderId', label: 'Folder ID', type: 'text' },
        { id: 'organizationId', label: 'Organization ID', type: 'text' },
      ],
      run: itemCreate,
    },
    {
      id: 'collection_list',
      label: 'List collections',
      description: 'List collections accessible to the access token.',
      fields: [...credFields],
      run: collectionList,
    },
  ],
};

registerForgeBlock(block);
export default block;
