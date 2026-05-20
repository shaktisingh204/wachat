/**
 * Forge block: Mautic
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mautic/Mautic.node.ts
 * Credential type: 'mautic' — { baseUrl, username, password } (Basic auth).
 *
 * Operations covered:
 *   - contact.create / get / update / delete
 *   - contact.sendEmail              (transactional, by campaign-email id)
 *   - contactSegment.add / remove
 *   - campaignContact.add / remove
 *   - segmentEmail.send              (broadcast to whole segment)
 *   - campaign.list
 *   - form.list
 *
 * Out of scope (deferred):
 *   - OAuth2 flow: n8n ships `MauticOAuth2Api.credentials.ts` as a separate
 *     credential type; sabflow would need a second credentialType binding,
 *     which is its own batch concern. Basic auth covers self-hosted Mautic.
 *   - Paginated `getAll` for contacts/companies — Mautic returns a `total`
 *     plus a page cursor; revisit once we have a real consumer with > 200
 *     records per query.
 *   - Company / contact-points / DNC mutations: covered by raw HTTP for now.
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

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Mautic: contactId is required');
  const data = await call(ctx, 'DELETE', `/contacts/${encodeURIComponent(id)}/delete`);
  return { outputs: { contact: data }, logs: [`Mautic contact delete → ${id}`] };
}

async function contactSendEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const campaignEmailId = asString(ctx.options.campaignEmailId);
  if (!contactId) throw new Error('Mautic: contactId is required');
  if (!campaignEmailId) throw new Error('Mautic: campaignEmailId is required');
  const data = await call(
    ctx,
    'POST',
    `/emails/${encodeURIComponent(campaignEmailId)}/contact/${encodeURIComponent(contactId)}/send`,
  );
  return { outputs: { result: data }, logs: [`Mautic contact sendEmail → ${contactId}`] };
}

async function contactSegmentAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const segmentId = asString(ctx.options.segmentId);
  if (!contactId) throw new Error('Mautic: contactId is required');
  if (!segmentId) throw new Error('Mautic: segmentId is required');
  const data = await call(
    ctx,
    'POST',
    `/segments/${encodeURIComponent(segmentId)}/contact/${encodeURIComponent(contactId)}/add`,
  );
  return { outputs: { result: data }, logs: [`Mautic segment add → ${contactId}@${segmentId}`] };
}

async function contactSegmentRemove(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const segmentId = asString(ctx.options.segmentId);
  if (!contactId) throw new Error('Mautic: contactId is required');
  if (!segmentId) throw new Error('Mautic: segmentId is required');
  const data = await call(
    ctx,
    'POST',
    `/segments/${encodeURIComponent(segmentId)}/contact/${encodeURIComponent(contactId)}/remove`,
  );
  return { outputs: { result: data }, logs: [`Mautic segment remove → ${contactId}@${segmentId}`] };
}

async function campaignContactAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const campaignId = asString(ctx.options.campaignId);
  if (!contactId) throw new Error('Mautic: contactId is required');
  if (!campaignId) throw new Error('Mautic: campaignId is required');
  const data = await call(
    ctx,
    'POST',
    `/campaigns/${encodeURIComponent(campaignId)}/contact/${encodeURIComponent(contactId)}/add`,
  );
  return { outputs: { result: data }, logs: [`Mautic campaign add → ${contactId}@${campaignId}`] };
}

async function campaignContactRemove(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const campaignId = asString(ctx.options.campaignId);
  if (!contactId) throw new Error('Mautic: contactId is required');
  if (!campaignId) throw new Error('Mautic: campaignId is required');
  const data = await call(
    ctx,
    'POST',
    `/campaigns/${encodeURIComponent(campaignId)}/contact/${encodeURIComponent(contactId)}/remove`,
  );
  return { outputs: { result: data }, logs: [`Mautic campaign remove → ${contactId}@${campaignId}`] };
}

async function segmentEmailSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const segmentEmailId = asString(ctx.options.segmentEmailId);
  if (!segmentEmailId) throw new Error('Mautic: segmentEmailId is required');
  const data = await call(ctx, 'POST', `/emails/${encodeURIComponent(segmentEmailId)}/send`);
  return { outputs: { result: data }, logs: [`Mautic segment-email send → ${segmentEmailId}`] };
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
      id: 'contact_delete',
      label: 'Delete contact',
      description: 'Delete a contact by id.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
      ],
      run: contactDelete,
    },
    {
      id: 'contact_send_email',
      label: 'Send transactional email to contact',
      description: 'Send a pre-built campaign email to a single contact.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'campaignEmailId', label: 'Campaign email ID', type: 'text', required: true },
      ],
      run: contactSendEmail,
    },
    {
      id: 'contact_segment_add',
      label: 'Add contact to segment',
      description: 'Add a contact to a Mautic segment.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'segmentId', label: 'Segment ID', type: 'text', required: true },
      ],
      run: contactSegmentAdd,
    },
    {
      id: 'contact_segment_remove',
      label: 'Remove contact from segment',
      description: 'Remove a contact from a Mautic segment.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'segmentId', label: 'Segment ID', type: 'text', required: true },
      ],
      run: contactSegmentRemove,
    },
    {
      id: 'campaign_contact_add',
      label: 'Add contact to campaign',
      description: 'Add a contact to a Mautic campaign.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
      ],
      run: campaignContactAdd,
    },
    {
      id: 'campaign_contact_remove',
      label: 'Remove contact from campaign',
      description: 'Remove a contact from a Mautic campaign.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
      ],
      run: campaignContactRemove,
    },
    {
      id: 'segment_email_send',
      label: 'Send segment email',
      description: 'Send a segment email to every member of the targeted segment.',
      fields: [
        { id: 'segmentEmailId', label: 'Segment email ID', type: 'text', required: true },
      ],
      run: segmentEmailSend,
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
