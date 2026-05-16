/**
 * Forge block: Google Cloud Firestore
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Firebase/CloudFirestore/GoogleFirebaseCloudFirestore.node.ts
 * Credential type: 'google_firestore' — { clientId, clientSecret, refreshToken }
 *
 * REST base: https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents/...
 *
 * Operations:
 *   - document.create POST   .../{collection}        (createDocument; body wraps `fields`)
 *   - document.get    GET    .../{collection}/{id}
 *   - document.list   GET    .../{collection}
 *   - document.delete DELETE .../{collection}/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, GOOGLE_TOKEN_URL } from '../_shared/google_oauth';

const BASE = 'https://firestore.googleapis.com/v1';
const SERVICE = 'Google Firestore';

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, ctx.credential, GOOGLE_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method,
    url: `${BASE}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

function basePath(projectId: string, database: string): string {
  return `/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(database)}/documents`;
}

function parseFieldsJson(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  let v: unknown;
  try {
    v = JSON.parse(s);
  } catch {
    throw new Error(`${SERVICE}: fields must be valid JSON`);
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error(`${SERVICE}: fields must be a JSON object`);
  }
  return v as Record<string, unknown>;
}

/** Convert a plain { key: value } map into Firestore's `{ key: { stringValue/.../mapValue } }` shape. */
function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = toFirestoreValue(v);
  }
  return out;
}
function toFirestoreValue(v: unknown): Record<string, unknown> {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map((x) => toFirestoreValue(x)) } };
  }
  if (typeof v === 'object') {
    return { mapValue: { fields: toFirestoreFields(v as Record<string, unknown>) } };
  }
  return { stringValue: String(v) };
}

async function documentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const database = asString(ctx.options.database) || '(default)';
  const collection = asString(ctx.options.collection);
  const documentId = asString(ctx.options.documentId);
  if (!projectId) throw new Error(`${SERVICE}: projectId is required`);
  if (!collection) throw new Error(`${SERVICE}: collection is required`);
  const raw = parseFieldsJson(ctx.options.fields);
  const body = { fields: toFirestoreFields(raw) };
  const qs = documentId ? `?documentId=${encodeURIComponent(documentId)}` : '';
  const data = await call(
    ctx,
    'POST',
    `${basePath(projectId, database)}/${encodeURIComponent(collection)}${qs}`,
    body,
  );
  return { outputs: { result: data }, logs: [`Firestore document create → ${collection}`] };
}

async function documentGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const database = asString(ctx.options.database) || '(default)';
  const collection = asString(ctx.options.collection);
  const documentId = asString(ctx.options.documentId);
  if (!projectId) throw new Error(`${SERVICE}: projectId is required`);
  if (!collection) throw new Error(`${SERVICE}: collection is required`);
  if (!documentId) throw new Error(`${SERVICE}: documentId is required`);
  const data = await call(
    ctx,
    'GET',
    `${basePath(projectId, database)}/${encodeURIComponent(collection)}/${encodeURIComponent(documentId)}`,
  );
  return { outputs: { result: data }, logs: [`Firestore document get → ${collection}/${documentId}`] };
}

async function documentList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const database = asString(ctx.options.database) || '(default)';
  const collection = asString(ctx.options.collection);
  if (!projectId) throw new Error(`${SERVICE}: projectId is required`);
  if (!collection) throw new Error(`${SERVICE}: collection is required`);
  const data = await call(
    ctx,
    'GET',
    `${basePath(projectId, database)}/${encodeURIComponent(collection)}`,
  );
  return { outputs: { result: data }, logs: [`Firestore document list → ${collection}`] };
}

async function documentDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const database = asString(ctx.options.database) || '(default)';
  const collection = asString(ctx.options.collection);
  const documentId = asString(ctx.options.documentId);
  if (!projectId) throw new Error(`${SERVICE}: projectId is required`);
  if (!collection) throw new Error(`${SERVICE}: collection is required`);
  if (!documentId) throw new Error(`${SERVICE}: documentId is required`);
  const data = await call(
    ctx,
    'DELETE',
    `${basePath(projectId, database)}/${encodeURIComponent(collection)}/${encodeURIComponent(documentId)}`,
  );
  return { outputs: { result: data }, logs: [`Firestore document delete → ${collection}/${documentId}`] };
}

const block: ForgeBlock = {
  id: 'forge_google_firestore',
  name: 'Google Firestore',
  description: 'Create, fetch, list and delete documents in Cloud Firestore.',
  iconName: 'LuFlame',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'google_firestore' },
  actions: [
    {
      id: 'document_create',
      label: 'Create document',
      description: 'Create a document. Fields is a plain JSON object — converted to Firestore typed values.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'database', label: 'Database', type: 'text', defaultValue: '(default)' },
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'documentId', label: 'Document ID (optional)', type: 'text' },
        { id: 'fields', label: 'Fields (JSON object)', type: 'json', required: true },
      ],
      run: documentCreate,
    },
    {
      id: 'document_get',
      label: 'Get document',
      description: 'Fetch a single document by ID.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'database', label: 'Database', type: 'text', defaultValue: '(default)' },
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'documentId', label: 'Document ID', type: 'text', required: true },
      ],
      run: documentGet,
    },
    {
      id: 'document_list',
      label: 'List documents',
      description: 'List documents in a collection.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'database', label: 'Database', type: 'text', defaultValue: '(default)' },
        { id: 'collection', label: 'Collection', type: 'text', required: true },
      ],
      run: documentList,
    },
    {
      id: 'document_delete',
      label: 'Delete document',
      description: 'Delete a document by ID.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'database', label: 'Database', type: 'text', defaultValue: '(default)' },
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'documentId', label: 'Document ID', type: 'text', required: true },
      ],
      run: documentDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
