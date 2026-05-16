/**
 * Forge block: Microsoft OneDrive (Graph)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/OneDrive/MicrosoftOneDrive.node.ts
 * Credential type: 'microsoft_onedrive' — { clientId, clientSecret, refreshToken }
 *
 * Operations (Graph v1.0):
 *   - file.list      GET    /me/drive/root/children
 *   - file.get       GET    /me/drive/items/{id}
 *   - file.delete    DELETE /me/drive/items/{id}
 *   - folder.create  POST   /me/drive/items/{parentId}/children
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
const SERVICE = 'Microsoft OneDrive';

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
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

async function fileList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await call(ctx, 'GET', `/me/drive/root/children`);
  return { outputs: { result: data }, logs: ['OneDrive root children'] };
}

async function fileGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const itemId = asString(ctx.options.itemId);
  if (!itemId) throw new Error(`${SERVICE}: itemId is required`);
  const data = await call(ctx, 'GET', `/me/drive/items/${encodeURIComponent(itemId)}`);
  return { outputs: { result: data }, logs: [`OneDrive item get → ${itemId}`] };
}

async function fileDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const itemId = asString(ctx.options.itemId);
  if (!itemId) throw new Error(`${SERVICE}: itemId is required`);
  const data = await call(ctx, 'DELETE', `/me/drive/items/${encodeURIComponent(itemId)}`);
  return { outputs: { result: data }, logs: [`OneDrive item delete → ${itemId}`] };
}

async function folderCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const parentId = asString(ctx.options.parentId) || 'root';
  const name = asString(ctx.options.name);
  if (!name) throw new Error(`${SERVICE}: name is required`);
  const body = { name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' };
  const data = await call(
    ctx,
    'POST',
    `/me/drive/items/${encodeURIComponent(parentId)}/children`,
    body,
  );
  return { outputs: { result: data }, logs: [`OneDrive folder create → ${name}`] };
}

const block: ForgeBlock = {
  id: 'forge_microsoft_onedrive',
  name: 'Microsoft OneDrive',
  description: 'List, fetch and delete files; create folders in OneDrive.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'microsoft_onedrive' },
  actions: [
    {
      id: 'file_list',
      label: 'List root children',
      description: 'List files/folders at the OneDrive root.',
      fields: [],
      run: fileList,
    },
    {
      id: 'file_get',
      label: 'Get item',
      description: 'Get an item by ID.',
      fields: [{ id: 'itemId', label: 'Item ID', type: 'text', required: true }],
      run: fileGet,
    },
    {
      id: 'file_delete',
      label: 'Delete item',
      description: 'Delete a file or folder by ID.',
      fields: [{ id: 'itemId', label: 'Item ID', type: 'text', required: true }],
      run: fileDelete,
    },
    {
      id: 'folder_create',
      label: 'Create folder',
      description: 'Create a folder inside a parent (defaults to root).',
      fields: [
        { id: 'parentId', label: 'Parent ID (defaults to root)', type: 'text', defaultValue: 'root' },
        { id: 'name', label: 'Folder name', type: 'text', required: true },
      ],
      run: folderCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
