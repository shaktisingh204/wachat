/**
 * Forge block: Google Slides
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Slides/GoogleSlides.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline
 *   per action. Access token refreshed per call and cached via _shared/oauth.ts.
 *
 * Operations covered:
 *   - presentation.create       POST /v1/presentations
 *   - presentation.get          GET  /v1/presentations/{presentationId}
 *   - presentation.batchUpdate  POST /v1/presentations/{presentationId}:batchUpdate
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

const SERVICE = 'Google Slides';
const CACHE = 'google_slides';

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

async function presentationCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const title = asString(ctx.options.title);
  if (!title) throw new Error(`${SERVICE}: title is required`);
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: 'https://slides.googleapis.com/v1/presentations',
    headers: { Authorization: `Bearer ${accessToken}` },
    json: { title },
  });
  return { outputs: { result: res.data }, logs: [`Slides create → ${title}`] };
}

async function presentationGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const presentationId = asString(ctx.options.presentationId);
  if (!presentationId) throw new Error(`${SERVICE}: presentationId is required`);
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: [`Slides get → ${presentationId}`] };
}

async function presentationBatchUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const presentationId = asString(ctx.options.presentationId);
  if (!presentationId) throw new Error(`${SERVICE}: presentationId is required`);
  const requests = parseJson('requests', ctx.options.requests);
  if (!Array.isArray(requests)) throw new Error(`${SERVICE}: requests must be a JSON array`);
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}:batchUpdate`,
    headers: { Authorization: `Bearer ${accessToken}` },
    json: { requests },
  });
  return { outputs: { result: res.data }, logs: [`Slides batchUpdate → ${presentationId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_google_slides',
  name: 'Google Slides',
  description: 'Create, get and batch-update Google Slides presentations.',
  iconName: 'LuPresentation',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'presentation_create',
      label: 'Create presentation',
      description: 'Create a new presentation with the given title.',
      fields: [
        ...authFields,
        { id: 'title', label: 'Title', type: 'text', required: true },
      ],
      run: presentationCreate,
    },
    {
      id: 'presentation_get',
      label: 'Get presentation',
      description: 'Fetch a presentation by id.',
      fields: [
        ...authFields,
        { id: 'presentationId', label: 'Presentation ID', type: 'text', required: true },
      ],
      run: presentationGet,
    },
    {
      id: 'presentation_batch_update',
      label: 'Batch update',
      description: 'Apply a list of update requests. Pass the `requests` JSON array verbatim.',
      fields: [
        ...authFields,
        { id: 'presentationId', label: 'Presentation ID', type: 'text', required: true },
        {
          id: 'requests',
          label: 'Requests (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{"createSlide":{"insertionIndex":1,"slideLayoutReference":{"predefinedLayout":"TITLE_AND_BODY"}}}]',
        },
      ],
      run: presentationBatchUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
