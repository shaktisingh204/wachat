/**
 * Forge block: Google Drive
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Drive/GoogleDrive.node.ts
 *   (with v2 schema under /Drive/v2)
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline
 *   per action. Access token refreshed per call and cached via _shared/oauth.ts.
 *
 * Operations covered:
 *   - file.list           GET    /drive/v3/files
 *   - file.get            GET    /drive/v3/files/{id}
 *   - file.upload         POST   /upload/drive/v3/files (multipart, base64 input)
 *   - file.create-folder  POST   /drive/v3/files (mimeType=application/vnd.google-apps.folder)
 *   - file.delete         DELETE /drive/v3/files/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';

type OAuthCred = { clientId: string; clientSecret: string; refreshToken: string };

function readCred(service: string, ctx: ForgeActionContext): OAuthCred {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${service}: clientId is required`);
  if (!clientSecret) throw new Error(`${service}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${service}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function getOrRefreshAccessToken(
  cred: OAuthCred,
  service: string,
  cacheTag: string,
): Promise<string> {
  const key = cacheKeyFor(cacheTag, cred.refreshToken);
  const cached = getCachedToken(key);
  if (cached) return cached;
  const { accessToken, expiresIn } = await refreshAccessToken({
    service,
    tokenUrl: 'https://oauth2.googleapis.com/token',
    refreshToken: cred.refreshToken,
    clientId: cred.clientId,
    clientSecret: cred.clientSecret,
  });
  setCachedToken(key, accessToken, expiresIn);
  return accessToken;
}

const SERVICE = 'Google Drive';
const CACHE = 'google_drive';

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

// ── Actions ────────────────────────────────────────────────────────────────

async function fileList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(SERVICE, ctx), SERVICE, CACHE);
  const params = new URLSearchParams();
  const q = asString(ctx.options.q);
  const pageSize = asString(ctx.options.pageSize);
  const pageToken = asString(ctx.options.pageToken);
  const fields = asString(ctx.options.fields);
  if (q) params.set('q', q);
  if (pageSize) params.set('pageSize', pageSize);
  if (pageToken) params.set('pageToken', pageToken);
  if (fields) params.set('fields', fields);
  const qs = params.toString();
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://www.googleapis.com/drive/v3/files${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: ['Drive file list'] };
}

async function fileGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(SERVICE, ctx), SERVICE, CACHE);
  const fileId = asString(ctx.options.fileId);
  if (!fileId) throw new Error(`${SERVICE}: fileId is required`);
  const fields = asString(ctx.options.fields);
  const qs = fields ? `?fields=${encodeURIComponent(fields)}` : '';
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}${qs}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: [`Drive file get → ${fileId}`] };
}

async function fileUpload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(SERVICE, ctx), SERVICE, CACHE);
  const name = asString(ctx.options.name);
  const mimeType = asString(ctx.options.mimeType) || 'application/octet-stream';
  const contentBase64 = asString(ctx.options.contentBase64);
  const parentId = asString(ctx.options.parentId);
  if (!name) throw new Error(`${SERVICE}: name is required`);
  if (!contentBase64) throw new Error(`${SERVICE}: contentBase64 is required`);

  const metadata: Record<string, unknown> = { name, mimeType };
  if (parentId) metadata.parents = [parentId];

  const boundary = `forge_drive_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify(metadata);
  const parts =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${meta}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${contentBase64}\r\n` +
    `--${boundary}--`;

  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: parts,
  });
  return { outputs: { result: res.data }, logs: [`Drive file upload → ${name}`] };
}

async function folderCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(SERVICE, ctx), SERVICE, CACHE);
  const name = asString(ctx.options.name);
  const parentId = asString(ctx.options.parentId);
  if (!name) throw new Error(`${SERVICE}: name is required`);
  const body: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) body.parents = [parentId];
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: 'https://www.googleapis.com/drive/v3/files',
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Drive folder create → ${name}`] };
}

async function fileDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(SERVICE, ctx), SERVICE, CACHE);
  const fileId = asString(ctx.options.fileId);
  if (!fileId) throw new Error(`${SERVICE}: fileId is required`);
  await apiRequest({
    service: SERVICE,
    method: 'DELETE',
    url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { fileId }, logs: [`Drive file delete → ${fileId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_google_drive',
  name: 'Google Drive',
  description: 'List, get, upload, delete files and create folders in Google Drive.',
  iconName: 'LuFolderOpen',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'file_list',
      label: 'List files',
      description: 'List files matching an optional `q` query.',
      fields: [
        ...authFields,
        { id: 'q', label: "Query (Drive `q`)", type: 'text', placeholder: "name contains 'report'" },
        { id: 'pageSize', label: 'Page size', type: 'number' },
        { id: 'pageToken', label: 'Page token', type: 'text' },
        { id: 'fields', label: 'Fields mask', type: 'text', placeholder: 'nextPageToken, files(id,name,mimeType)' },
      ],
      run: fileList,
    },
    {
      id: 'file_get',
      label: 'Get file',
      description: 'Fetch file metadata by id.',
      fields: [
        ...authFields,
        { id: 'fileId', label: 'File ID', type: 'text', required: true },
        { id: 'fields', label: 'Fields mask', type: 'text' },
      ],
      run: fileGet,
    },
    {
      id: 'file_upload',
      label: 'Upload file',
      description: 'Upload a base64-encoded file (multipart). MimeType optional.',
      fields: [
        ...authFields,
        { id: 'name', label: 'File name', type: 'text', required: true },
        { id: 'mimeType', label: 'MIME type', type: 'text', placeholder: 'application/pdf' },
        { id: 'contentBase64', label: 'Content (base64)', type: 'textarea', required: true },
        { id: 'parentId', label: 'Parent folder ID', type: 'text' },
      ],
      run: fileUpload,
    },
    {
      id: 'folder_create',
      label: 'Create folder',
      description: 'Create a new folder, optionally nested under a parent folder.',
      fields: [
        ...authFields,
        { id: 'name', label: 'Folder name', type: 'text', required: true },
        { id: 'parentId', label: 'Parent folder ID', type: 'text' },
      ],
      run: folderCreate,
    },
    {
      id: 'file_delete',
      label: 'Delete file',
      description: 'Permanently delete a file or folder by id.',
      fields: [
        ...authFields,
        { id: 'fileId', label: 'File ID', type: 'text', required: true },
      ],
      run: fileDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
