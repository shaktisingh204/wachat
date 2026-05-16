/**
 * Forge block: Salesmate
 *
 * Source: n8n-master/packages/nodes-base/nodes/Salesmate/Salesmate.node.ts
 * Credential type: 'salesmate' — fields: { subdomain, sessionToken }
 *
 * Operations (subset):
 *   - contact.create     POST  /v1/contacts
 *   - contact.get        GET   /v1/contacts/{id}
 *   - contact.update     PUT   /v1/contacts/{id}
 *   - deal.create        POST  /v1/deals
 *
 * Deferred: company, activity, custom fields, pagination, deal stages search.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function getHeaders(ctx: ForgeActionContext): { headers: Record<string, string>; base: string } {
  const cred = requireCredential('Salesmate', ctx.credential);
  const subdomain = cred.subdomain;
  const sessionToken = cred.sessionToken;
  if (!subdomain) throw new Error('Salesmate: credential is missing `subdomain` field');
  if (!sessionToken) throw new Error('Salesmate: credential is missing `sessionToken` field');
  return {
    base: 'https://apis.salesmate.io',
    headers: {
      accessToken: sessionToken,
      'x-linkname': subdomain,
    },
  };
}

async function salesmateApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { base, headers } = getHeaders(ctx);
  const res = await apiRequest({
    service: 'Salesmate',
    method,
    url: `${base}${path}`,
    headers,
    json,
  });
  return res.data;
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error('Salesmate: extra fields must be a JSON object');
}

// ── Contact actions ────────────────────────────────────────────────────────

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const email = asString(ctx.options.email);
  const owner = asString(ctx.options.ownerId);
  if (!firstName && !lastName && !email) {
    throw new Error('Salesmate: provide at least firstName, lastName or email');
  }

  const body: Record<string, unknown> = { ...parseJsonObject(ctx.options.extra) };
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;
  if (email) body.email = email;
  if (owner) body.owner = Number(owner);

  const data = (await salesmateApi(ctx, 'POST', '/v1/contacts', body)) as
    | { Data?: { id?: number } }
    | null;
  return {
    outputs: { contact: data, id: data?.Data?.id ?? null },
    logs: [`Salesmate contact create → ${data?.Data?.id ?? '?'}`],
  };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Salesmate: contactId is required');
  const data = await salesmateApi(ctx, 'GET', `/v1/contacts/${encodeURIComponent(id)}`);
  return { outputs: { contact: data }, logs: [`Salesmate contact get → ${id}`] };
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Salesmate: contactId is required');
  const body: Record<string, unknown> = { ...parseJsonObject(ctx.options.extra) };
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const email = asString(ctx.options.email);
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;
  if (email) body.email = email;
  if (Object.keys(body).length === 0) {
    throw new Error('Salesmate: at least one updatable field must be set');
  }
  const data = await salesmateApi(ctx, 'PUT', `/v1/contacts/${encodeURIComponent(id)}`, body);
  return { outputs: { contact: data }, logs: [`Salesmate contact update → ${id}`] };
}

// ── Deal actions ───────────────────────────────────────────────────────────

async function dealCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const owner = asString(ctx.options.ownerId);
  const pipeline = asString(ctx.options.pipeline);
  if (!title) throw new Error('Salesmate: title is required');
  if (!owner) throw new Error('Salesmate: ownerId is required');
  if (!pipeline) throw new Error('Salesmate: pipeline is required');

  const body: Record<string, unknown> = {
    title,
    owner: Number(owner),
    pipeline,
    ...parseJsonObject(ctx.options.extra),
  };
  const primaryContact = asString(ctx.options.primaryContactId);
  if (primaryContact) body.primaryContact = Number(primaryContact);
  const dealValue = asString(ctx.options.dealValue);
  if (dealValue) body.dealValue = Number(dealValue);

  const data = (await salesmateApi(ctx, 'POST', '/v1/deals', body)) as
    | { Data?: { id?: number } }
    | null;
  return {
    outputs: { deal: data, id: data?.Data?.id ?? null },
    logs: [`Salesmate deal create → ${data?.Data?.id ?? '?'}`],
  };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_salesmate',
  name: 'Salesmate',
  description: 'Manage Salesmate contacts and deals.',
  iconName: 'LuBriefcase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'salesmate' },
  actions: [
    {
      id: 'contact_create',
      label: 'Create contact',
      fields: [
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'ownerId', label: 'Owner ID', type: 'number' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactCreate,
    },
    {
      id: 'contact_get',
      label: 'Get contact',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactGet,
    },
    {
      id: 'contact_update',
      label: 'Update contact',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactUpdate,
    },
    {
      id: 'deal_create',
      label: 'Create deal',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'ownerId', label: 'Owner ID', type: 'number', required: true },
        { id: 'pipeline', label: 'Pipeline', type: 'text', required: true },
        { id: 'primaryContactId', label: 'Primary contact ID', type: 'number' },
        { id: 'dealValue', label: 'Deal value', type: 'number' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: dealCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
