/**
 * Forge block: Box
 *
 * Source: n8n-master/packages/nodes-base/nodes/Box/Box.node.ts (+ Generic*.ts)
 * Credential type: 'box' (expects { accessToken }).
 *
 * Operations covered:
 *   - file.upload     POST  https://upload.box.com/api/2.0/files/content
 *   - file.download   GET   https://api.box.com/2.0/files/{id}/content
 *   - file.list       GET   https://api.box.com/2.0/folders/{id}/items
 *   - file.delete     DELETE https://api.box.com/2.0/files/{id}
 *   - folder.create   POST  https://api.box.com/2.0/folders
 *
 * Deferred:
 *   - Search, copy, move, sharing, comments, tasks (re-add as needed)
 *   - Multipart-form binary upload uses a small in-file boundary writer
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const API = 'https://api.box.com/2.0';
const UPLOAD = 'https://upload.box.com/api/2.0';

function bearer(ctx: ForgeActionContext): string {
  const cred = requireCredential('Box', ctx.credential);
  const token = cred.accessToken;
  if (!token) throw new Error('Box: credential is missing `accessToken`');
  return `Bearer ${token}`;
}

async function fileUpload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const parentId = asString(ctx.options.parentId) || '0';
  const name = asString(ctx.options.name);
  const body = asString(ctx.options.body);
  if (!name) throw new Error('Box: name is required');

  // Box accepts a multipart/form-data upload with two parts: `attributes`
  // (JSON metadata) and `file` (the binary content). Build the multipart
  // body by hand so we don't pull in another dependency.
  const boundary = `----SabFlowBox${Date.now()}`;
  const attributes = JSON.stringify({ name, parent: { id: parentId } });
  const parts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="attributes"',
    'Content-Type: application/json',
    '',
    attributes,
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${name.replace(/"/g, '')}"`,
    'Content-Type: application/octet-stream',
    '',
    body,
    `--${boundary}--`,
    '',
  ];
  const multipartBody = parts.join('\r\n');
  const res = await apiRequest({
    service: 'Box',
    method: 'POST',
    url: `${UPLOAD}/files/content`,
    headers: {
      Authorization: bearer(ctx),
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  return { outputs: { result: res.data }, logs: [`Box upload → ${name}`] };
}

async function fileDownload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fileId = asString(ctx.options.fileId);
  if (!fileId) throw new Error('Box: fileId is required');
  const res = await apiRequest({
    service: 'Box',
    method: 'GET',
    url: `${API}/files/${encodeURIComponent(fileId)}/content`,
    headers: { Authorization: bearer(ctx) },
  });
  return {
    outputs: { body: res.text, contentType: res.headers.get('content-type') ?? null },
    logs: [`Box download → ${fileId} (${res.text.length} bytes)`],
  };
}

async function fileDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fileId = asString(ctx.options.fileId);
  if (!fileId) throw new Error('Box: fileId is required');
  const res = await apiRequest({
    service: 'Box',
    method: 'DELETE',
    url: `${API}/files/${encodeURIComponent(fileId)}`,
    headers: { Authorization: bearer(ctx) },
  });
  return { outputs: { status: res.status }, logs: [`Box delete → ${fileId}`] };
}

async function fileList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const folderId = asString(ctx.options.folderId) || '0';
  const limit = Number(ctx.options.limit) || 100;
  const url = new URL(`${API}/folders/${encodeURIComponent(folderId)}/items`);
  url.searchParams.set('limit', String(limit));
  const res = await apiRequest({
    service: 'Box',
    method: 'GET',
    url: url.toString(),
    headers: { Authorization: bearer(ctx) },
  });
  const data = res.data as { entries?: unknown[]; total_count?: number } | null;
  return {
    outputs: { entries: data?.entries ?? [], totalCount: data?.total_count ?? 0 },
    logs: [`Box list → ${data?.entries?.length ?? 0} entries`],
  };
}

async function folderCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const parentId = asString(ctx.options.parentId) || '0';
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Box: name is required');
  const res = await apiRequest({
    service: 'Box',
    method: 'POST',
    url: `${API}/folders`,
    headers: { Authorization: bearer(ctx) },
    json: { name, parent: { id: parentId } },
  });
  return { outputs: { result: res.data }, logs: [`Box folder create → ${name}`] };
}

const block: ForgeBlock = {
  id: 'forge_box',
  name: 'Box',
  description: 'Upload, download and manage files in Box.com.',
  iconName: 'LuBox',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'box' },
  actions: [
    {
      id: 'file_upload',
      label: 'Upload file',
      description: 'Upload a new file to a folder ("0" is the All Files root).',
      fields: [
        { id: 'parentId', label: 'Parent folder ID', type: 'text', defaultValue: '0' },
        { id: 'name', label: 'File name', type: 'text', required: true },
        { id: 'body', label: 'File body', type: 'textarea', required: true },
      ],
      run: fileUpload,
    },
    {
      id: 'file_download',
      label: 'Download file',
      description: 'Download a file by id.',
      fields: [
        { id: 'fileId', label: 'File ID', type: 'text', required: true },
      ],
      run: fileDownload,
    },
    {
      id: 'file_list',
      label: 'List folder items',
      description: 'List immediate children of a folder.',
      fields: [
        { id: 'folderId', label: 'Folder ID', type: 'text', defaultValue: '0' },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 100 },
      ],
      run: fileList,
    },
    {
      id: 'file_delete',
      label: 'Delete file',
      description: 'Delete a file by id.',
      fields: [
        { id: 'fileId', label: 'File ID', type: 'text', required: true },
      ],
      run: fileDelete,
    },
    {
      id: 'folder_create',
      label: 'Create folder',
      description: 'Create a new folder.',
      fields: [
        { id: 'parentId', label: 'Parent folder ID', type: 'text', defaultValue: '0' },
        { id: 'name', label: 'Folder name', type: 'text', required: true },
      ],
      run: folderCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
