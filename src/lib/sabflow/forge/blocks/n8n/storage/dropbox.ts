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
import { asString, requireCredential } from '../_shared/http';
import { uploadStreamToSabFiles } from '../_shared/sabfiles';

const API = 'https://api.dropboxapi.com/2';
const CONTENT_API = 'https://content.dropboxapi.com/2';

async function dbxRequest(
  ctx: ForgeActionContext,
  url: string,
  init: { headers?: Record<string, string>; json?: unknown; body?: string },
): Promise<{ ok: boolean; status: number; data: unknown; headers: Record<string, string> }> {
  requireCredential('Dropbox', ctx.credential);
  const r = await ctx.helpers!.requestWithAuthentication('bearer', {
    method: 'POST',
    url,
    tokenField: 'accessToken',
    headers: init.headers,
    json: init.json,
    body: init.body,
  });
  if (!r.ok) {
    const clip =
      typeof r.data === 'string'
        ? r.data.length > 300
          ? `${r.data.slice(0, 300)}…`
          : r.data
        : JSON.stringify(r.data ?? null).slice(0, 300);
    throw new Error(`Dropbox POST ${url} failed (${r.status}): ${clip}`);
  }
  return r;
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
  const res = await dbxRequest(ctx, `${CONTENT_API}/files/upload`, {
    headers: {
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
  const res = await dbxRequest(ctx, `${CONTENT_API}/files/download`, {
    headers: {
      'Dropbox-API-Arg': JSON.stringify({ path }),
    },
  });
  const meta = res.headers['dropbox-api-result'];
  const metaObj = meta ? JSON.parse(meta) : null;
  const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
  
  const buf = Buffer.from(text);
  const name = metaObj?.name || path.split('/').pop() || 'download';
  const sabFile = await uploadStreamToSabFiles(
    ctx,
    name,
    'application/octet-stream',
    buf,
    buf.length
  );

  return {
    outputs: { 
      fileId: sabFile.id,
      fileName: sabFile.name,
      contentType: sabFile.mime,
      contentLength: sabFile.size,
      meta: metaObj 
    },
    logs: [`Dropbox download → SabFiles ${sabFile.id} (${buf.length} bytes)`],
  };
}

async function fileDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = normalizePath(asString(ctx.options.path));
  if (!path) throw new Error('Dropbox: path is required');
  const res = await dbxRequest(ctx, `${API}/files/delete_v2`, { json: { path } });
  return { outputs: { result: res.data }, logs: [`Dropbox delete → ${path}`] };
}

async function fileList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = asString(ctx.options.path);
  // Dropbox uses "" for the root of the user's Dropbox.
  const dropboxPath = path === '/' || path === '' ? '' : normalizePath(path);
  const recursive = ctx.options.recursive === true;
  const res = await dbxRequest(ctx, `${API}/files/list_folder`, {
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
  const res = await dbxRequest(ctx, `${API}/files/create_folder_v2`, {
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
