/**
 * Forge block: Mautic
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mautic/Mautic.node.ts
 * Credential type: 'mautic' — { baseUrl, username, password } (Basic auth).
 *
 * Operations covered:
 *   - contact.create
 *   - contact.get
 *   - contact.update
 *   - campaign.list
 *   - form.list
 *
 * Out of scope (deferred):
 *   - OAuth2 flow (we only port the Basic-auth path)
 *   - Segment/company/campaign-contact membership ops
 *   - Paginated `getAll` — single page only for now
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

type MauticCred = { baseUrl: string; username: string; password: string };

function basic(username: string, password: string): string {
  const raw = `${username}:${password}`;
  if (typeof btoa === 'function') return btoa(raw);
  const B = (globalThis as { Buffer?: { from: (s: string) => { toString: (e: string) => string } } }).Buffer;
  if (B) return B.from(raw).toString('base64');
  throw new Error('Mautic: no base64 encoder available in runtime');
}

function getCred(ctx: ForgeActionContext): MauticCred {
  const cred = requireCredential('Mautic', ctx.credential);
  const baseUrl = (cred.baseUrl ?? '').replace(/\/$/, '');
  const username = cred.username ?? '';
  const password = cred.password ?? '';
  if (!baseUrl) throw new Error('Mautic: credential is missing `baseUrl`');
  if (!username || !password) throw new Error('Mautic: credential is missing `username` or `password`');
  return { baseUrl, username, password };
}

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
  query?: Record<string, string>,
): Promise<unknown> {
  const { baseUrl, username, password } = getCred(ctx);
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  const res = await apiRequest({
    service: 'Mautic',
    method,
    url: `${baseUrl}/api${path}${qs}`,
    headers: { Authorization: `Basic ${basic(username, password)}` },
    json,
  });
  return res.data;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Mautic: email is required');
  const body: Record<string, unknown> = { email };
  for (const k of ['firstname', 'lastname', 'company', 'phone', 'mobile']) {
    const v = asString(ctx.options[k]);
    if (v) body[k] = v;
  }
  const data = await call(ctx, 'POST', '/contacts/new', body);
  return { outputs: { contact: data }, logs: [`Mautic contact create → ${email}`] };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Mautic: contactId is required');
  const data = await call(ctx, 'GET', `/contacts/${encodeURIComponent(id)}`);
  return { outputs: { contact: data }, logs: [`Mautic contact get → ${id}`] };
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Mautic: contactId is required');
  const body: Record<string, unknown> = {};
  for (const k of ['email', 'firstname', 'lastname', 'company', 'phone', 'mobile']) {
    const v = asString(ctx.options[k]);
    if (v) body[k] = v;
  }
  if (Object.keys(body).length === 0) {
    throw new Error('Mautic: at least one updatable field must be set');
  }
  const data = await call(ctx, 'PATCH', `/contacts/${encodeURIComponent(id)}/edit`, body);
  return { outputs: { contact: data }, logs: [`Mautic contact update → ${id}`] };
}

async function campaignList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await call(ctx, 'GET', '/campaigns');
  return { outputs: { result: data }, logs: ['Mautic campaign list'] };
}

async function formList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await call(ctx, 'GET', '/forms');
  return { outputs: { result: data }, logs: ['Mautic form list'] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_mautic',
  name: 'Mautic',
  description: 'Manage contacts, campaigns and forms in a Mautic instance.',
  iconName: 'LuMegaphone',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'mautic',
  },
  actions: [
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Create a new contact in Mautic.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstname', label: 'First name', type: 'text' },
        { id: 'lastname', label: 'Last name', type: 'text' },
        { id: 'company', label: 'Company', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'mobile', label: 'Mobile', type: 'text' },
      ],
      run: contactCreate,
    },
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by id.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
      ],
      run: contactGet,
    },
    {
      id: 'contact_update',
      label: 'Update contact',
      description: 'Patch a contact. Only set fields are sent.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'firstname', label: 'First name', type: 'text' },
        { id: 'lastname', label: 'Last name', type: 'text' },
        { id: 'company', label: 'Company', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'mobile', label: 'Mobile', type: 'text' },
      ],
      run: contactUpdate,
    },
    {
      id: 'campaign_list',
      label: 'List campaigns',
      description: 'List campaigns from the Mautic instance.',
      fields: [],
      run: campaignList,
    },
    {
      id: 'form_list',
      label: 'List forms',
      description: 'List forms from the Mautic instance.',
      fields: [],
      run: formList,
    },
  ],
};

registerForgeBlock(block);
export default block;
