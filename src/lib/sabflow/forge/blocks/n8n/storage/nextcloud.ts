/**
 * Forge block: NextCloud (WebDAV)
 *
 * Source: n8n-master/packages/nodes-base/nodes/NextCloud/NextCloud.node.ts
 * Credential type: 'nextcloud' (expects { baseUrl, username, password }).
 *
 * Operations covered (WebDAV verbs against /remote.php/webdav):
 *   - file.upload     PUT  /remote.php/webdav/<path>
 *   - file.download   GET  /remote.php/webdav/<path>
 *   - file.delete     DELETE /remote.php/webdav/<path>
 *   - file.list       PROPFIND /remote.php/webdav/<path> (Depth: 1)
 *   - folder.create   MKCOL /remote.php/webdav/<path>
 *
 * Deferred:
 *   - User / share / OCS API endpoints (only the WebDAV file surface for now)
 *   - Sharelink generation, calendar/contacts, search
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function endpoint(ctx: ForgeActionContext, path: string): { url: string; auth: string } {
  const cred = requireCredential('NextCloud', ctx.credential);
  const baseUrl = (cred.baseUrl ?? '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error('NextCloud: credential is missing `baseUrl`');
  const username = cred.username ?? '';
  const password = cred.password ?? '';
  if (!username || !password) throw new Error('NextCloud: credential is missing username/password');
  const clean = path.replace(/^\/+/, '');
  const url = `${baseUrl}/remote.php/webdav/${clean}`;
  // Node's atob/btoa is global in modern runtimes — Buffer used for clarity.
  const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  return { url, auth };
}

async function fileUpload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = asString(ctx.options.path);
  if (!path) throw new Error('NextCloud: path is required');
  const body = asString(ctx.options.body);
  const { url, auth } = endpoint(ctx, path);
  const res = await apiRequest({
    service: 'NextCloud',
    method: 'PUT',
    url,
    headers: { Authorization: auth, 'Content-Type': 'application/octet-stream' },
    body,
  });
  return { outputs: { status: res.status, path }, logs: [`NextCloud upload → ${path}`] };
}

async function fileDownload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = asString(ctx.options.path);
  if (!path) throw new Error('NextCloud: path is required');
  const { url, auth } = endpoint(ctx, path);
  const res = await apiRequest({
    service: 'NextCloud',
    method: 'GET',
    url,
    headers: { Authorization: auth },
  });
  return {
    outputs: { body: res.text, contentType: res.headers.get('content-type') ?? null },
    logs: [`NextCloud download → ${path} (${res.text.length} bytes)`],
  };
}

async function fileDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = asString(ctx.options.path);
  if (!path) throw new Error('NextCloud: path is required');
  const { url, auth } = endpoint(ctx, path);
  const res = await apiRequest({
    service: 'NextCloud',
    method: 'DELETE',
    url,
    headers: { Authorization: auth },
  });
  return { outputs: { status: res.status }, logs: [`NextCloud delete → ${path}`] };
}

async function fileList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = asString(ctx.options.path) || '';
  const { url, auth } = endpoint(ctx, path);
  // PROPFIND is the WebDAV way to enumerate a directory.
  const res = await apiRequest({
    service: 'NextCloud',
    // apiRequest's HttpMethod doesn't include PROPFIND; we pass through fetch via raw body
    // by reusing POST is wrong — instead route through the underlying fetch using a tiny
    // local helper. Keep the cast tight to satisfy the typing.
    method: 'GET',
    url,
    headers: { Authorization: auth, Depth: '1' },
  });
  // Fall back: if the server returned an HTML error for GET on a directory,
  // attempt PROPFIND directly via fetch (apiRequest doesn't model it).
  if (res.status >= 400 || !res.text.startsWith('<?xml')) {
    const propRes = await fetch(url, {
      method: 'PROPFIND',
      headers: { Authorization: auth, Depth: '1' },
    });
    const propText = await propRes.text();
    if (!propRes.ok) {
      throw new Error(`NextCloud PROPFIND failed (${propRes.status}): ${propText.slice(0, 200)}`);
    }
    return { outputs: { body: propText, status: propRes.status }, logs: [`NextCloud list → ${path || '/'}`] };
  }
  return {
    outputs: { body: res.text, status: res.status },
    logs: [`NextCloud list → ${path || '/'}`],
  };
}

async function folderCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = asString(ctx.options.path);
  if (!path) throw new Error('NextCloud: path is required');
  const { url, auth } = endpoint(ctx, path);
  // MKCOL is the WebDAV verb for "create collection (folder)".
  const res = await fetch(url, { method: 'MKCOL', headers: { Authorization: auth } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`NextCloud MKCOL failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return { outputs: { status: res.status, path }, logs: [`NextCloud folder create → ${path}`] };
}

const block: ForgeBlock = {
  id: 'forge_nextcloud',
  name: 'NextCloud',
  description: 'Upload, download and manage NextCloud files via WebDAV.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'nextcloud' },
  actions: [
    {
      id: 'file_upload',
      label: 'Upload file',
      description: 'PUT a file to a path under the user\'s NextCloud root.',
      fields: [
        { id: 'path', label: 'Path', type: 'text', required: true, placeholder: 'folder/file.txt' },
        { id: 'body', label: 'File body', type: 'textarea', required: true },
      ],
      run: fileUpload,
    },
    {
      id: 'file_download',
      label: 'Download file',
      description: 'GET a file by path.',
      fields: [
        { id: 'path', label: 'Path', type: 'text', required: true },
      ],
      run: fileDownload,
    },
    {
      id: 'file_list',
      label: 'List folder',
      description: 'PROPFIND a folder (Depth: 1) and return the raw WebDAV XML.',
      fields: [
        { id: 'path', label: 'Folder path (empty for root)', type: 'text' },
      ],
      run: fileList,
    },
    {
      id: 'file_delete',
      label: 'Delete file or folder',
      description: 'DELETE the entry at the given path.',
      fields: [
        { id: 'path', label: 'Path', type: 'text', required: true },
      ],
      run: fileDelete,
    },
    {
      id: 'folder_create',
      label: 'Create folder',
      description: 'MKCOL a folder at the given path.',
      fields: [
        { id: 'path', label: 'Path', type: 'text', required: true, placeholder: 'new-folder' },
      ],
      run: folderCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
