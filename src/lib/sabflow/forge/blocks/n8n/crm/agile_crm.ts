/**
 * Forge block: Agile CRM
 *
 * Source: n8n-master/packages/nodes-base/nodes/AgileCrm/AgileCrm.node.ts
 *   (+ GenericFunctions.ts, ContactInterface.ts)
 * Credential type: 'agile_crm' — fields: { domain, email, apiKey }
 *   `domain` is the subdomain (e.g. "yourcompany" → yourcompany.agilecrm.com).
 *   Auth: HTTP Basic with `<email>:<apiKey>`.
 *
 * Operations covered:
 *   - contact.get          GET    /dev/api/contacts/{id}
 *   - contact.create       POST   /dev/api/contacts
 *   - contact.delete       DELETE /dev/api/contacts/{id}
 *   - company.create       POST   /dev/api/contacts (with type=COMPANY)
 *   - deal.create          POST   /dev/api/opportunity
 *
 * Out of scope: tasks, events, notes, custom field upsert, tag operations.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

// btoa is available in modern Node.js runtimes and the Edge runtime.
declare const btoa: (raw: string) => string;
function toBase64(s: string): string {
  if (typeof btoa === 'function') return btoa(s);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const B = (globalThis as any).Buffer as { from: (input: string) => { toString: (enc: string) => string } } | undefined;
  if (B) return B.from(s).toString('base64');
  throw new Error('No base64 encoder available in this runtime');
}

function resolveAuth(ctx: ForgeActionContext): { baseUrl: string; basic: string } {
  const cred = requireCredential('Agile CRM', ctx.credential);
  const domain = cred.domain;
  const email = cred.email;
  const apiKey = cred.apiKey;
  if (!domain) throw new Error('Agile CRM: credential is missing `domain`');
  if (!email) throw new Error('Agile CRM: credential is missing `email`');
  if (!apiKey) throw new Error('Agile CRM: credential is missing `apiKey`');
  const basic = toBase64(`${email}:${apiKey}`);
  return { baseUrl: `https://${domain}.agilecrm.com/dev`, basic };
}

async function acrmApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { baseUrl, basic } = resolveAuth(ctx);
  const res = await apiRequest({
    service: 'Agile CRM',
    method,
    url: `${baseUrl}${path}`,
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' },
    json,
  });
  return res.data;
}

function buildProperties(ctx: ForgeActionContext, type: 'PERSON' | 'COMPANY'): Record<string, unknown> {
  const properties: Array<{ type: string; name: string; value: string }> = [];
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const email = asString(ctx.options.email);
  const phone = asString(ctx.options.phone);
  const companyName = asString(ctx.options.companyName);

  if (firstName) properties.push({ type: 'SYSTEM', name: 'first_name', value: firstName });
  if (lastName) properties.push({ type: 'SYSTEM', name: 'last_name', value: lastName });
  if (email) properties.push({ type: 'SYSTEM', name: 'email', value: email });
  if (phone) properties.push({ type: 'SYSTEM', name: 'phone', value: phone });
  if (companyName) properties.push({ type: 'SYSTEM', name: 'name', value: companyName });

  const body: Record<string, unknown> = { type, properties };
  const tagsRaw = asString(ctx.options.tags);
  if (tagsRaw) body.tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
  if (asString(ctx.options.starValue)) body.star_value = Number(asString(ctx.options.starValue));
  if (asString(ctx.options.leadScore)) body.lead_score = Number(asString(ctx.options.leadScore));
  return body;
}

// ── Contact ────────────────────────────────────────────────────────────────

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Agile CRM: contactId is required');
  const data = await acrmApi(ctx, 'GET', `/api/contacts/${encodeURIComponent(id)}`);
  return { outputs: { contact: data }, logs: [`Agile CRM contact get → ${id}`] };
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  if (!asString(ctx.options.email) && !asString(ctx.options.firstName) && !asString(ctx.options.lastName)) {
    throw new Error('Agile CRM: at least one of email, firstName or lastName is required');
  }
  const body = buildProperties(ctx, 'PERSON');
  const data = (await acrmApi(ctx, 'POST', '/api/contacts', body)) as { id?: number | string } | null;
  return {
    outputs: { contact: data, id: data?.id ?? null },
    logs: [`Agile CRM contact create → ${data?.id ?? '?'}`],
  };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Agile CRM: contactId is required');
  await acrmApi(ctx, 'DELETE', `/api/contacts/${encodeURIComponent(id)}`);
  return { outputs: { success: true, id }, logs: [`Agile CRM contact delete → ${id}`] };
}

// ── Company ────────────────────────────────────────────────────────────────

async function companyCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const companyName = asString(ctx.options.companyName);
  if (!companyName) throw new Error('Agile CRM: companyName is required');
  const body = buildProperties(ctx, 'COMPANY');
  const data = (await acrmApi(ctx, 'POST', '/api/contacts', body)) as { id?: number | string } | null;
  return {
    outputs: { company: data, id: data?.id ?? null },
    logs: [`Agile CRM company create → ${data?.id ?? '?'}`],
  };
}

// ── Deal ───────────────────────────────────────────────────────────────────

async function dealCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  const expectedValue = asString(ctx.options.expectedValue);
  const probability = asString(ctx.options.probability);
  const closeDate = asString(ctx.options.closeDate);
  if (!name) throw new Error('Agile CRM: name is required');
  if (!expectedValue) throw new Error('Agile CRM: expectedValue is required');
  if (!probability) throw new Error('Agile CRM: probability is required');
  if (!closeDate) throw new Error('Agile CRM: closeDate (epoch ms) is required');

  const body: Record<string, unknown> = {
    name,
    expected_value: Number(expectedValue),
    probability: Number(probability),
    close_date: Number(closeDate),
  };
  if (asString(ctx.options.milestone)) body.milestone = asString(ctx.options.milestone);
  if (asString(ctx.options.description)) body.description = asString(ctx.options.description);

  const data = (await acrmApi(ctx, 'POST', '/api/opportunity', body)) as { id?: number | string } | null;
  return {
    outputs: { deal: data, id: data?.id ?? null },
    logs: [`Agile CRM deal create → ${data?.id ?? '?'}`],
  };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_agile_crm',
  name: 'Agile CRM',
  description: 'Manage Agile CRM contacts, companies and deals.',
  iconName: 'LuContact',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'agile_crm' },
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
      description: 'Create a new contact (person).',
      fields: [
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'tags', label: 'Tags (comma-separated)', type: 'text' },
        { id: 'starValue', label: 'Star value (0-5)', type: 'number' },
        { id: 'leadScore', label: 'Lead score', type: 'number' },
      ],
      run: contactCreate,
    },
    {
      id: 'contact_delete',
      label: 'Delete contact',
      description: 'Permanently delete a contact.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactDelete,
    },
    {
      id: 'company_create',
      label: 'Create company',
      description: 'Create a new company record.',
      fields: [
        { id: 'companyName', label: 'Company name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'tags', label: 'Tags (comma-separated)', type: 'text' },
      ],
      run: companyCreate,
    },
    {
      id: 'deal_create',
      label: 'Create deal',
      description: 'Create a new opportunity (deal).',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'expectedValue', label: 'Expected value', type: 'number', required: true },
        { id: 'probability', label: 'Probability (0-100)', type: 'number', required: true },
        { id: 'closeDate', label: 'Close date (epoch ms)', type: 'text', required: true },
        { id: 'milestone', label: 'Milestone', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
      ],
      run: dealCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
