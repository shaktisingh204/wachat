/**
 * Forge block: HighLevel (LeadConnector)
 *
 * Source: n8n-master/packages/nodes-base/nodes/HighLevel/HighLevel.node.ts
 * Credential type: 'highlevel' — fields: { apiKey, locationId? }
 *
 * Operations (subset):
 *   - contact.create        POST  /contacts/
 *   - contact.get           GET   /contacts/{id}
 *   - contact.update        PUT   /contacts/{id}
 *   - opportunity.create    POST  /opportunities/
 *
 * Deferred: tasks, notes, calendar, appointment, conversation, pipelines list.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('HighLevel', ctx.credential);
  const token = cred.apiKey;
  if (!token) throw new Error('HighLevel: credential is missing `apiKey` field');
  return {
    Authorization: `Bearer ${token}`,
    Version: API_VERSION,
    Accept: 'application/json',
  };
}

async function hlApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'HighLevel',
    method,
    url: `${BASE}${path}`,
    headers: authHeaders(ctx),
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
  throw new Error('HighLevel: extra fields must be a JSON object');
}

function resolveLocationId(ctx: ForgeActionContext): string {
  const fromOptions = asString(ctx.options.locationId);
  if (fromOptions) return fromOptions;
  const cred = ctx.credential ?? {};
  if (cred.locationId) return cred.locationId;
  throw new Error('HighLevel: locationId is required (set in credential or per-action).');
}

// ── Contact actions ────────────────────────────────────────────────────────

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const locationId = resolveLocationId(ctx);
  const body: Record<string, unknown> = { locationId, ...parseJsonObject(ctx.options.extra) };
  const email = asString(ctx.options.email);
  const phone = asString(ctx.options.phone);
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  if (!email && !phone) throw new Error('HighLevel: provide email or phone');
  if (email) body.email = email;
  if (phone) body.phone = phone;
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;

  const data = (await hlApi(ctx, 'POST', '/contacts/', body)) as
    | { contact?: { id?: string } }
    | null;
  return {
    outputs: { contact: data, id: data?.contact?.id ?? null },
    logs: [`HighLevel contact create → ${data?.contact?.id ?? '?'}`],
  };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('HighLevel: contactId is required');
  const data = await hlApi(ctx, 'GET', `/contacts/${encodeURIComponent(id)}`);
  return { outputs: { contact: data }, logs: [`HighLevel contact get → ${id}`] };
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('HighLevel: contactId is required');
  const body: Record<string, unknown> = { ...parseJsonObject(ctx.options.extra) };
  const email = asString(ctx.options.email);
  const phone = asString(ctx.options.phone);
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  if (email) body.email = email;
  if (phone) body.phone = phone;
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;
  if (Object.keys(body).length === 0) {
    throw new Error('HighLevel: at least one updatable field must be set');
  }
  const data = await hlApi(ctx, 'PUT', `/contacts/${encodeURIComponent(id)}`, body);
  return { outputs: { contact: data }, logs: [`HighLevel contact update → ${id}`] };
}

// ── Opportunity actions ───────────────────────────────────────────────────

async function opportunityCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const locationId = resolveLocationId(ctx);
  const pipelineId = asString(ctx.options.pipelineId);
  const stageId = asString(ctx.options.stageId);
  const status = asString(ctx.options.status) || 'open';
  const name = asString(ctx.options.name);
  const contactId = asString(ctx.options.contactId);
  if (!pipelineId) throw new Error('HighLevel: pipelineId is required');
  if (!stageId) throw new Error('HighLevel: stageId is required');
  if (!name) throw new Error('HighLevel: name is required');
  if (!contactId) throw new Error('HighLevel: contactId is required');

  const body: Record<string, unknown> = {
    locationId,
    pipelineId,
    pipelineStageId: stageId,
    status,
    name,
    contactId,
    ...parseJsonObject(ctx.options.extra),
  };
  const monetaryValue = asString(ctx.options.monetaryValue);
  if (monetaryValue) body.monetaryValue = Number(monetaryValue);

  const data = (await hlApi(ctx, 'POST', '/opportunities/', body)) as
    | { opportunity?: { id?: string } }
    | null;
  return {
    outputs: { opportunity: data, id: data?.opportunity?.id ?? null },
    logs: [`HighLevel opportunity create → ${data?.opportunity?.id ?? '?'}`],
  };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_highlevel',
  name: 'HighLevel',
  description: 'Manage HighLevel (LeadConnector) contacts and opportunities.',
  iconName: 'LuGauge',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'highlevel' },
  actions: [
    {
      id: 'contact_create',
      label: 'Create contact',
      fields: [
        { id: 'locationId', label: 'Location ID', type: 'text', helperText: 'Overrides the locationId set on the credential.' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
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
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactUpdate,
    },
    {
      id: 'opportunity_create',
      label: 'Create opportunity',
      fields: [
        { id: 'locationId', label: 'Location ID', type: 'text' },
        { id: 'pipelineId', label: 'Pipeline ID', type: 'text', required: true },
        { id: 'stageId', label: 'Pipeline stage ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          defaultValue: 'open',
          options: [
            { label: 'Open', value: 'open' },
            { label: 'Won', value: 'won' },
            { label: 'Lost', value: 'lost' },
            { label: 'Abandoned', value: 'abandoned' },
          ],
        },
        { id: 'monetaryValue', label: 'Monetary value', type: 'number' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: opportunityCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
