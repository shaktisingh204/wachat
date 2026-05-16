/**
 * Forge block: Google Docs
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Docs/GoogleDocs.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline
 *   per action. Access token refreshed per call and cached via _shared/oauth.ts.
 *
 * Operations covered:
 *   - document.create       POST /v1/documents
 *   - document.get          GET  /v1/documents/{documentId}
 *   - document.batchUpdate  POST /v1/documents/{documentId}:batchUpdate
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

const SERVICE = 'Google Docs';
const CACHE = 'google_docs';

type OAuthCred = { clientId: string; clientSecret: string; refreshToken: string };

function readCred(ctx: ForgeActionContext): OAuthCred {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function getOrRefreshAccessToken(cred: OAuthCred): Promise<string> {
  const key = cacheKeyFor(CACHE, cred.refreshToken);
  const cached = getCachedToken(key);
  if (cached) return cached;
  const { accessToken, expiresIn } = await refreshAccessToken({
    service: SERVICE,
    tokenUrl: 'https://oauth2.googleapis.com/token',
    refreshToken: cred.refreshToken,
    clientId: cred.clientId,
    clientSecret: cred.clientSecret,
  });
  setCachedToken(key, accessToken, expiresIn);
  return accessToken;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

function parseJson(label: string, raw: unknown): unknown {
  const s = asString(raw).trim();
  if (!s) throw new Error(`${SERVICE}: ${label} is required`);
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`${SERVICE}: ${label} must be valid JSON`);
  }
}

// ── Actions ────────────────────────────────────────────────────────────────

async function documentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const title = asString(ctx.options.title);
  if (!title) throw new Error(`${SERVICE}: title is required`);
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: 'https://docs.googleapis.com/v1/documents',
    headers: { Authorization: `Bearer ${accessToken}` },
    json: { title },
  });
  return { outputs: { result: res.data }, logs: [`Docs create → ${title}`] };
}

async function documentGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const documentId = asString(ctx.options.documentId);
  if (!documentId) throw new Error(`${SERVICE}: documentId is required`);
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: [`Docs get → ${documentId}`] };
}

async function documentBatchUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const documentId = asString(ctx.options.documentId);
  if (!documentId) throw new Error(`${SERVICE}: documentId is required`);
  const requests = parseJson('requests', ctx.options.requests);
  if (!Array.isArray(requests)) throw new Error(`${SERVICE}: requests must be a JSON array`);
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    headers: { Authorization: `Bearer ${accessToken}` },
    json: { requests },
  });
  return { outputs: { result: res.data }, logs: [`Docs batchUpdate → ${documentId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_google_docs',
  name: 'Google Docs',
  description: 'Create, get and batch-update Google Docs documents.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'document_create',
      label: 'Create document',
      description: 'Create a new (empty) document with the given title.',
      fields: [
        ...authFields,
        { id: 'title', label: 'Title', type: 'text', required: true },
      ],
      run: documentCreate,
    },
    {
      id: 'document_get',
      label: 'Get document',
      description: 'Fetch a document by id.',
      fields: [
        ...authFields,
        { id: 'documentId', label: 'Document ID', type: 'text', required: true },
      ],
      run: documentGet,
    },
    {
      id: 'document_batch_update',
      label: 'Batch update',
      description: 'Apply a list of update requests. Pass the `requests` JSON array verbatim.',
      fields: [
        ...authFields,
        { id: 'documentId', label: 'Document ID', type: 'text', required: true },
        {
          id: 'requests',
          label: 'Requests (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{"insertText":{"location":{"index":1},"text":"Hello"}}]',
        },
      ],
      run: documentBatchUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
