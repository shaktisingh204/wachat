/**
 * Forge block: Keap (Infusionsoft)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Keap/Keap.node.ts
 * Credential type: 'keap' — fields: { accessToken, refreshToken? }
 *
 * Operations (subset):
 *   - contact.get          GET  /contacts/{id}
 *   - contact.create       POST /contacts
 *   - contact.update       PATCH /contacts/{id}
 *   - tag.list             GET  /tags
 *   - appointment.list     GET  /appointments
 *
 * Deferred: tag assignment, ecommerce, files, emails, pagination helper.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';

const BASE = 'https://api.infusionsoft.com/crm/rest/v1';

async function getKeapAccessToken(ctx: ForgeActionContext): Promise<string> {
  const cred = requireCredential('Keap', ctx.credential);
  const refreshToken = cred.refreshToken;

  // Prefer the refresh-token flow when one is configured; otherwise fall back
  // to the long-lived access token already in the credential.
  if (refreshToken) {
    const key = cacheKeyFor('keap', refreshToken);
    const cached = getCachedToken(key);
    if (cached) return cached;
    const { accessToken: refreshed, expiresIn } = await refreshAccessToken({
      service: 'Keap',
      tokenUrl: 'https://api.infusionsoft.com/token',
      refreshToken,
      clientId: cred.clientId,
      clientSecret: cred.clientSecret,
    });
    setCachedToken(key, refreshed, expiresIn);
    return refreshed;
  }

  const token = cred.accessToken;
  if (!token) throw new Error('Keap: credential is missing `accessToken` field');
  return token;
}

async function authHeaders(ctx: ForgeActionContext): Promise<Record<string, string>> {
  const token = await getKeapAccessToken(ctx);
  return { Authorization: `Bearer ${token}` };
}

async function keapApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Keap',
    method,
    url: `${BASE}${path}`,
    headers: await authHeaders(ctx),
    json,
  });
  return res.data;
}

function parseJsonObject(label: string, raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`Keap: ${label} must be a JSON object`);
}

// ── Contact actions ────────────────────────────────────────────────────────

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Keap: contactId is required');
  const data = await keapApi(ctx, 'GET', `/contacts/${encodeURIComponent(id)}`);
  return { outputs: { contact: data }, logs: [`Keap contact get → ${id}`] };
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Keap: email is required');

  const body: Record<string, unknown> = {
    email_addresses: [{ email, field: 'EMAIL1' }],
    ...parseJsonObject('extra', ctx.options.extra),
  };
  const given = asString(ctx.options.givenName);
  const family = asString(ctx.options.familyName);
  if (given) body.given_name = given;
  if (family) body.family_name = family;

  const data = (await keapApi(ctx, 'POST', '/contacts', body)) as { id?: number } | null;
  return {
    outputs: { contact: data, id: data?.id ?? null },
    logs: [`Keap contact create → ${data?.id ?? '?'}`],
  };
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Keap: contactId is required');

  const body: Record<string, unknown> = { ...parseJsonObject('extra', ctx.options.extra) };
  const given = asString(ctx.options.givenName);
  const family = asString(ctx.options.familyName);
  const email = asString(ctx.options.email);
  if (given) body.given_name = given;
  if (family) body.family_name = family;
  if (email) body.email_addresses = [{ email, field: 'EMAIL1' }];
  if (Object.keys(body).length === 0) {
    throw new Error('Keap: at least one updatable field must be set');
  }

  const data = await keapApi(ctx, 'PATCH', `/contacts/${encodeURIComponent(id)}`, body);
  return { outputs: { contact: data }, logs: [`Keap contact update → ${id}`] };
}

// ── Tag / appointment actions ──────────────────────────────────────────────

async function tagList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asString(ctx.options.limit) || '50';
  const data = await keapApi(ctx, 'GET', `/tags?limit=${encodeURIComponent(limit)}`);
  return { outputs: { result: data }, logs: ['Keap tag list'] };
}

async function appointmentList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asString(ctx.options.limit) || '50';
  const data = await keapApi(ctx, 'GET', `/appointments?limit=${encodeURIComponent(limit)}`);
  return { outputs: { result: data }, logs: ['Keap appointment list'] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_keap',
  name: 'Keap',
  description: 'Manage Keap (Infusionsoft) contacts, tags and appointments.',
  iconName: 'LuContact',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'keap' },
  actions: [
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by id.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactGet,
    },
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Create a new contact.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'givenName', label: 'Given name', type: 'text' },
        { id: 'familyName', label: 'Family name', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactCreate,
    },
    {
      id: 'contact_update',
      label: 'Update contact',
      description: 'Patch a contact.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'givenName', label: 'Given name', type: 'text' },
        { id: 'familyName', label: 'Family name', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactUpdate,
    },
    {
      id: 'tag_list',
      label: 'List tags',
      fields: [{ id: 'limit', label: 'Limit', type: 'number', defaultValue: 50 }],
      run: tagList,
    },
    {
      id: 'appointment_list',
      label: 'List appointments',
      fields: [{ id: 'limit', label: 'Limit', type: 'number', defaultValue: 50 }],
      run: appointmentList,
    },
  ],
};

registerForgeBlock(block);
export default block;
