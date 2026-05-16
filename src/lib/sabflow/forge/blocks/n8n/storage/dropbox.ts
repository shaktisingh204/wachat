/**
 * Forge block: Dropbox
 *
 * Source: n8n-master/packages/nodes-base/nodes/Dropbox/Dropbox.node.ts
 * Credential type: 'dropbox' (expects { accessToken }).
 *
 * Operations covered:
 *   - file.upload     POST https://content.dropboxapi.com/2/files/upload
 *   - file.download   POST https://content.dropboxapi.com/2/files/download
 *   - file.delete     POST https://api.dropboxapi.com/2/files/delete_v2
 *   - file.list       POST https://api.dropboxapi.com/2/files/list_folder
 *   - folder.create   POST https://api.dropboxapi.com/2/files/create_folder_v2
 *
 * Deferred:
 *   - move/copy/search and team-scoped operations (re-add when needed)
 *   - Binary body upload — text bodies only in the first port
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const API = 'https://api.dropboxapi.com/2';
const CONTENT_API = 'https://content.dropboxapi.com/2';

function bearer(ctx: ForgeActionContext): string {
  const cred = requireCredential('Dropbox', ctx.credential);
  const token = cred.accessToken;
  if (!token) throw new Error('Dropbox: credential is missing `accessToken`');
  return `Bearer ${token}`;
}

function normalizePath(p: string): string {
  if (!p) return '';
  return p.startsWith('/') ? p : `/${p}`;
}

async function fileUpload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = normalizePath(asString(ctx.options.path));
  const body = asString(ctx.options.body);
  if (!path) throw new Error('Dropbox: path is required');
  const mode = asString(ctx.options.mode) || 'add';
  const res = await apiRequest({
    service: 'Dropbox',
    method: 'POST',
    url: `${CONTENT_API}/files/upload`,
    headers: {
      Authorization: bearer(ctx),
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode, autorename: true, mute: false }),
    },
    body,
  });
  return { outputs: { result: res.data }, logs: [`Dropbox upload → ${path}`] };
}

async function fileDownload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = normalizePath(asString(ctx.options.path));
  if (!path) throw new Error('Dropbox: path is required');
  const res = await apiRequest({
    service: 'Dropbox',
    method: 'POST',
    url: `${CONTENT_API}/files/download`,
    headers: {
      Authorization: bearer(ctx),
      'Dropbox-API-Arg': JSON.stringify({ path }),
    },
  });
  const meta = res.headers.get('dropbox-api-result');
  return {
    outputs: { body: res.text, meta: meta ? JSON.parse(meta) : null },
    logs: [`Dropbox download → ${path} (${res.text.length} bytes)`],
  };
}

async function fileDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = normalizePath(asString(ctx.options.path));
  if (!path) throw new Error('Dropbox: path is required');
  const res = await apiRequest({
    service: 'Dropbox',
    method: 'POST',
    url: `${API}/files/delete_v2`,
    headers: { Authorization: bearer(ctx) },
    json: { path },
  });
  return { outputs: { result: res.data }, logs: [`Dropbox delete → ${path}`] };
}

async function fileList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = asString(ctx.options.path);
  // Dropbox uses "" for the root of the user's Dropbox.
  const dropboxPath = path === '/' || path === '' ? '' : normalizePath(path);
  const recursive = ctx.options.recursive === true;
  const res = await apiRequest({
    service: 'Dropbox',
    method: 'POST',
    url: `${API}/files/list_folder`,
    headers: { Authorization: bearer(ctx) },
    json: { path: dropboxPath, recursive },
  });
  const data = res.data as { entries?: unknown[] } | null;
  return {
    outputs: { entries: data?.entries ?? [], result: data },
    logs: [`Dropbox list → ${data?.entries?.length ?? 0} entries`],
  };
}

async function folderCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = normalizePath(asString(ctx.options.path));
  if (!path) throw new Error('Dropbox: path is required');
  const res = await apiRequest({
    service: 'Dropbox',
    method: 'POST',
    url: `${API}/files/create_folder_v2`,
    headers: { Authorization: bearer(ctx) },
    json: { path, autorename: false },
  });
  return { outputs: { result: res.data }, logs: [`Dropbox folder create → ${path}`] };
}

const block: ForgeBlock = {
  id: 'forge_dropbox',
  name: 'Dropbox',
  description: 'Upload, download and manage files in Dropbox.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'dropbox' },
  actions: [
    {
      id: 'file_upload',
      label: 'Upload file',
      description: 'Upload a file to Dropbox at the given path.',
      fields: [
        { id: 'path', label: 'Path', type: 'text', required: true, placeholder: '/folder/file.txt' },
        { id: 'body', label: 'File body', type: 'textarea', required: true },
        {
          id: 'mode',
          label: 'Write mode',
          type: 'select',
          defaultValue: 'add',
          options: [
            { label: 'Add (fail if exists)', value: 'add' },
            { label: 'Overwrite', value: 'overwrite' },
          ],
        },
      ],
      run: fileUpload,
    },
    {
      id: 'file_download',
      label: 'Download file',
      description: 'Download a file by Dropbox path.',
      fields: [
        { id: 'path', label: 'Path', type: 'text', required: true },
      ],
      run: fileDownload,
    },
    {
      id: 'file_list',
      label: 'List folder',
      description: 'List entries in a folder.',
      fields: [
        { id: 'path', label: 'Folder path (empty for root)', type: 'text', placeholder: '/' },
        { id: 'recursive', label: 'Recursive', type: 'toggle', defaultValue: false },
      ],
      run: fileList,
    },
    {
      id: 'file_delete',
      label: 'Delete file or folder',
      description: 'Delete the entry at the given path.',
      fields: [
        { id: 'path', label: 'Path', type: 'text', required: true },
      ],
      run: fileDelete,
    },
    {
      id: 'folder_create',
      label: 'Create folder',
      description: 'Create a folder at the given path.',
      fields: [
        { id: 'path', label: 'Path', type: 'text', required: true, placeholder: '/new-folder' },
      ],
      run: folderCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
