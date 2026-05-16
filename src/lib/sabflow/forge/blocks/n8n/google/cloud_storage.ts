/**
 * Forge block: Google Cloud Storage
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/CloudStorage/GoogleCloudStorage.node.ts
 * Credential type: 'google_cloud_storage' — { clientId, clientSecret, refreshToken }
 *
 * Operations:
 *   - bucket.list   GET    /storage/v1/b?project={projectId}
 *   - object.list   GET    /storage/v1/b/{bucket}/o
 *   - object.upload POST   /upload/storage/v1/b/{bucket}/o?uploadType=media&name=...
 *   - object.get    GET    /storage/v1/b/{bucket}/o/{object}
 *   - object.delete DELETE /storage/v1/b/{bucket}/o/{object}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, GOOGLE_TOKEN_URL } from '../_shared/google_oauth';

const BASE = 'https://storage.googleapis.com/storage/v1';
const UPLOAD_BASE = 'https://storage.googleapis.com/upload/storage/v1';
const SERVICE = 'Google Cloud Storage';

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
  baseUrl: string = BASE,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, ctx.credential, GOOGLE_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method,
    url: `${baseUrl}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

async function bucketList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  if (!projectId) throw new Error(`${SERVICE}: projectId is required`);
  const data = await call(ctx, 'GET', `/b?project=${encodeURIComponent(projectId)}`);
  return { outputs: { result: data }, logs: [`GCS buckets list → ${projectId}`] };
}

async function objectList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const bucket = asString(ctx.options.bucket);
  if (!bucket) throw new Error(`${SERVICE}: bucket is required`);
  const prefix = asString(ctx.options.prefix);
  const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
  const data = await call(ctx, 'GET', `/b/${encodeURIComponent(bucket)}/o${qs}`);
  return { outputs: { result: data }, logs: [`GCS objects list → ${bucket}`] };
}

async function objectUpload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const bucket = asString(ctx.options.bucket);
  const name = asString(ctx.options.name);
  const content = asString(ctx.options.content);
  if (!bucket) throw new Error(`${SERVICE}: bucket is required`);
  if (!name) throw new Error(`${SERVICE}: name is required`);
  if (!content) throw new Error(`${SERVICE}: content is required`);
  const token = await getOrRefreshAccessToken(SERVICE, ctx.credential, GOOGLE_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: `${UPLOAD_BASE}/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(name)}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': asString(ctx.options.contentType) || 'text/plain',
    },
    body: content,
  });
  return { outputs: { result: res.data }, logs: [`GCS object upload → ${bucket}/${name}`] };
}

async function objectGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const bucket = asString(ctx.options.bucket);
  const object = asString(ctx.options.object);
  if (!bucket) throw new Error(`${SERVICE}: bucket is required`);
  if (!object) throw new Error(`${SERVICE}: object is required`);
  const data = await call(
    ctx,
    'GET',
    `/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(object)}`,
  );
  return { outputs: { result: data }, logs: [`GCS object get → ${object}`] };
}

async function objectDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const bucket = asString(ctx.options.bucket);
  const object = asString(ctx.options.object);
  if (!bucket) throw new Error(`${SERVICE}: bucket is required`);
  if (!object) throw new Error(`${SERVICE}: object is required`);
  const data = await call(
    ctx,
    'DELETE',
    `/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(object)}`,
  );
  return { outputs: { result: data }, logs: [`GCS object delete → ${object}`] };
}

const block: ForgeBlock = {
  id: 'forge_google_cloud_storage',
  name: 'Google Cloud Storage',
  description: 'Manage buckets and objects in Google Cloud Storage.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'google_cloud_storage' },
  actions: [
    {
      id: 'bucket_list',
      label: 'List buckets',
      description: 'List buckets in a project.',
      fields: [{ id: 'projectId', label: 'Project ID', type: 'text', required: true }],
      run: bucketList,
    },
    {
      id: 'object_list',
      label: 'List objects',
      description: 'List objects in a bucket (optional prefix).',
      fields: [
        { id: 'bucket', label: 'Bucket', type: 'text', required: true },
        { id: 'prefix', label: 'Prefix', type: 'text' },
      ],
      run: objectList,
    },
    {
      id: 'object_upload',
      label: 'Upload object',
      description: 'Upload a text/JSON object (inline body) to a bucket.',
      fields: [
        { id: 'bucket', label: 'Bucket', type: 'text', required: true },
        { id: 'name', label: 'Object name', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
        { id: 'contentType', label: 'Content-Type', type: 'text', defaultValue: 'text/plain' },
      ],
      run: objectUpload,
    },
    {
      id: 'object_get',
      label: 'Get object metadata',
      description: 'Get an object\'s metadata.',
      fields: [
        { id: 'bucket', label: 'Bucket', type: 'text', required: true },
        { id: 'object', label: 'Object name', type: 'text', required: true },
      ],
      run: objectGet,
    },
    {
      id: 'object_delete',
      label: 'Delete object',
      description: 'Delete an object from a bucket.',
      fields: [
        { id: 'bucket', label: 'Bucket', type: 'text', required: true },
        { id: 'object', label: 'Object name', type: 'text', required: true },
      ],
      run: objectDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
