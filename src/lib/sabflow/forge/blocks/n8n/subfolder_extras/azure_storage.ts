/**
 * Forge block: Azure Storage (Blob)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/Storage/AzureStorage.node.ts
 *
 * Auth (v1 port): a pre-generated **SAS URL** for the container is passed
 *   inline. SAS keeps the runtime small (no SharedKey HMAC signing) while
 *   letting users perform list/upload/delete against a container.
 *
 *   SAS URL format example:
 *     https://{account}.blob.core.windows.net/{container}?<sas-query>
 *
 * Operations:
 *   - blob.list   GET    {sasUrl}&restype=container&comp=list
 *   - blob.upload PUT    {container}/{blob}?<sas>  + x-ms-blob-type: BlockBlob
 *   - blob.delete DELETE {container}/{blob}?<sas>
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const SERVICE = 'Azure Storage';

type ParsedSas = {
  origin: string; // https://{account}.blob.core.windows.net
  containerPath: string; // /{container}
  query: string; // sas query string (no leading ?)
};

function parseSas(ctx: ForgeActionContext): ParsedSas {
  const sasUrl = asString(ctx.options.sasUrl);
  if (!sasUrl) throw new Error(`${SERVICE}: sasUrl is required`);
  let u: URL;
  try {
    u = new URL(sasUrl);
  } catch {
    throw new Error(`${SERVICE}: sasUrl is not a valid URL`);
  }
  if (!u.hostname.endsWith('.blob.core.windows.net')) {
    throw new Error(`${SERVICE}: sasUrl must point at *.blob.core.windows.net`);
  }
  const path = u.pathname.replace(/\/+$/, '');
  if (!path || path === '/') {
    throw new Error(`${SERVICE}: sasUrl must include a container path (e.g. /{container})`);
  }
  return { origin: u.origin, containerPath: path, query: u.search.replace(/^\?/, '') };
}

function buildBlobUrl(sas: ParsedSas, blob: string, extraQs?: string): string {
  const qs = [sas.query, extraQs].filter(Boolean).join('&');
  return `${sas.origin}${sas.containerPath}/${encodeURIComponent(blob)}${qs ? `?${qs}` : ''}`;
}

const authFields = [
  {
    id: 'sasUrl',
    label: 'Container SAS URL',
    type: 'password' as const,
    required: true,
    placeholder: 'https://{account}.blob.core.windows.net/{container}?<sas>',
  },
];

async function blobList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sas = parseSas(ctx);
  const prefix = asString(ctx.options.prefix);
  const params = new URLSearchParams(sas.query);
  params.set('restype', 'container');
  params.set('comp', 'list');
  if (prefix) params.set('prefix', prefix);
  const url = `${sas.origin}${sas.containerPath}?${params.toString()}`;
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url,
    headers: { 'x-ms-version': '2020-10-02' },
  });
  return { outputs: { result: res.data }, logs: [`Azure blob list${prefix ? ` (prefix=${prefix})` : ''}`] };
}

async function blobUpload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sas = parseSas(ctx);
  const blob = asString(ctx.options.blob);
  const contentBase64 = asString(ctx.options.contentBase64);
  const contentType = asString(ctx.options.contentType) || 'application/octet-stream';
  if (!blob) throw new Error(`${SERVICE}: blob name is required`);
  if (!contentBase64) throw new Error(`${SERVICE}: contentBase64 is required`);
  // Decode base64 → Buffer so fetch sends the binary bytes (not a base64 string).
  let bodyBytes: Buffer;
  try {
    bodyBytes = Buffer.from(contentBase64, 'base64');
  } catch {
    throw new Error(`${SERVICE}: contentBase64 is not valid base64`);
  }
  // apiRequest accepts `body: string`; pass the binary as a latin1 string to keep bytes intact.
  const bodyStr = bodyBytes.toString('binary');
  const res = await apiRequest({
    service: SERVICE,
    method: 'PUT',
    url: buildBlobUrl(sas, blob),
    headers: {
      'x-ms-version': '2020-10-02',
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': contentType,
      'Content-Length': String(bodyBytes.length),
    },
    body: bodyStr,
  });
  return { outputs: { result: res.data }, logs: [`Azure blob upload → ${blob}`] };
}

async function blobDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sas = parseSas(ctx);
  const blob = asString(ctx.options.blob);
  if (!blob) throw new Error(`${SERVICE}: blob name is required`);
  const res = await apiRequest({
    service: SERVICE,
    method: 'DELETE',
    url: buildBlobUrl(sas, blob),
    headers: { 'x-ms-version': '2020-10-02' },
  });
  return { outputs: { result: res.data }, logs: [`Azure blob delete → ${blob}`] };
}

const block: ForgeBlock = {
  id: 'forge_azure_storage',
  name: 'Azure Storage (Blob)',
  description: 'List, upload, and delete blobs in an Azure Blob Storage container via SAS URL.',
  iconName: 'LuHardDrive',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'blob_list',
      label: 'List blobs',
      description: 'List blobs in the container, optionally filtered by prefix.',
      fields: [
        ...authFields,
        { id: 'prefix', label: 'Prefix filter', type: 'text' },
      ],
      run: blobList,
    },
    {
      id: 'blob_upload',
      label: 'Upload blob',
      description: 'Upload a base64-encoded blob.',
      fields: [
        ...authFields,
        { id: 'blob', label: 'Blob name', type: 'text', required: true },
        { id: 'contentType', label: 'Content-Type', type: 'text', placeholder: 'application/octet-stream' },
        { id: 'contentBase64', label: 'Content (base64)', type: 'textarea', required: true },
      ],
      run: blobUpload,
    },
    {
      id: 'blob_delete',
      label: 'Delete blob',
      description: 'Delete a blob from the container.',
      fields: [
        ...authFields,
        { id: 'blob', label: 'Blob name', type: 'text', required: true },
      ],
      run: blobDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
