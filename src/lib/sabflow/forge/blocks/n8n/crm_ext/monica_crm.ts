/**
 * Forge block: Monica CRM
 *
 * Source: n8n-master/packages/nodes-base/nodes/MonicaCrm/MonicaCrm.node.ts
 * Credential type: 'monica_crm' — fields: { baseUrl?, apiToken }
 *
 * Operations (subset):
 *   - contact.create       POST   /contacts
 *   - contact.get          GET    /contacts/{id}
 *   - contact.update       PUT    /contacts/{id}
 *   - contact.delete       DELETE /contacts/{id}
 *
 * Deferred: activities, notes, reminders, custom fields, pagination.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function getBase(ctx: ForgeActionContext): { base: string; token: string } {
  const cred = requireCredential('Monica CRM', ctx.credential);
  const token = cred.apiToken;
  if (!token) throw new Error('Monica CRM: credential is missing `apiToken` field');
  const baseUrl = (cred.baseUrl || 'https://app.monicahq.com').replace(/\/+$/, '');
  const base = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
  return { base, token };
}

async function monicaApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { base, token } = getBase(ctx);
  const res = await apiRequest({
    service: 'Monica CRM',
    method,
    url: `${base}${path}`,
    headers: { Authorization: `Bearer ${token}` },
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
  throw new Error('Monica CRM: extra fields must be a JSON object');
}

// ── Actions ────────────────────────────────────────────────────────────────

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const genderId = asString(ctx.options.genderId) || '1';
  if (!firstName) throw new Error('Monica CRM: firstName is required');

  const body: Record<string, unknown> = {
    first_name: firstName,
    gender_id: Number(genderId),
    is_birthdate_known: false,
    is_deceased: false,
    is_deceased_date_known: false,
    ...parseJsonObject(ctx.options.extra),
  };
  if (lastName) body.last_name = lastName;

  const data = (await monicaApi(ctx, 'POST', '/contacts', body)) as { data?: { id?: number } } | null;
  const id = data?.data?.id ?? null;
  return {
    outputs: { contact: data, id },
    logs: [`Monica contact create → ${id ?? '?'}`],
  };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Monica CRM: contactId is required');
  const data = await monicaApi(ctx, 'GET', `/contacts/${encodeURIComponent(id)}`);
  return { outputs: { contact: data }, logs: [`Monica contact get → ${id}`] };
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Monica CRM: contactId is required');
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  if (!firstName) throw new Error('Monica CRM: firstName is required');

  const body: Record<string, unknown> = {
    first_name: firstName,
    gender_id: Number(asString(ctx.options.genderId) || '1'),
    is_birthdate_known: false,
    is_deceased: false,
    is_deceased_date_known: false,
    ...parseJsonObject(ctx.options.extra),
  };
  if (lastName) body.last_name = lastName;

  const data = await monicaApi(ctx, 'PUT', `/contacts/${encodeURIComponent(id)}`, body);
  return { outputs: { contact: data }, logs: [`Monica contact update → ${id}`] };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Monica CRM: contactId is required');
  const data = await monicaApi(ctx, 'DELETE', `/contacts/${encodeURIComponent(id)}`);
  return { outputs: { result: data, success: true }, logs: [`Monica contact delete → ${id}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_monica_crm',
  name: 'Monica CRM',
  description: 'Manage Monica CRM contacts.',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'monica_crm' },
  actions: [
    {
      id: 'contact_create',
      label: 'Create contact',
      fields: [
        { id: 'firstName', label: 'First name', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text' },
        {
          id: 'genderId',
          label: 'Gender ID',
          type: 'text',
          defaultValue: '1',
          helperText: 'Numeric gender id from your Monica instance (defaults to 1).',
        },
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
        { id: 'firstName', label: 'First name', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'genderId', label: 'Gender ID', type: 'text', defaultValue: '1' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactUpdate,
    },
    {
      id: 'contact_delete',
      label: 'Delete contact',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
