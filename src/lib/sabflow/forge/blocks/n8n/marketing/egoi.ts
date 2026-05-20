/**
 * Forge block: E-goi
 *
 * Source: n8n-master/packages/nodes-base/nodes/Egoi/Egoi.node.ts
 * Credential type: 'egoi' — { apiKey }; sent as `Apikey: <key>` header.
 *
 * Operations covered:
 *   - contact.create
 *   - contact.get
 *   - contact.update
 *   - contact.attach_tag (n8n folds this into create/update; sabflow exposes it
 *     as a first-class op so flow authors can tag without re-PATCHing the base
 *     fields)
 *   - list.list
 *
 * Out of scope (deferred):
 *   - extra-fields / consent collections: each E-goi list has a custom schema
 *     so a generic forge UI can't pre-fill them; revisit once sabflow has
 *     dynamic field discovery.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.egoiapp.com';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('E-goi', ctx.credential);
  const key = cred.apiKey ?? '';
  if (!key) throw new Error('E-goi: credential is missing `apiKey`');
  return { Apikey: key };
}

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'E-goi',
    method,
    url: `${BASE}${path}`,
    headers: authHeader(ctx),
    json,
  });
  return res.data;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  if (!listId) throw new Error('E-goi: listId is required');
  if (!email) throw new Error('E-goi: email is required');
  const body: Record<string, unknown> = {
    base: {
      email,
      first_name: asString(ctx.options.firstName) || undefined,
      last_name: asString(ctx.options.lastName) || undefined,
      cellphone: asString(ctx.options.cellphone) || undefined,
    },
  };
  const data = await call(ctx, 'POST', `/v3/lists/${encodeURIComponent(listId)}/contacts`, body);
  return { outputs: { contact: data }, logs: [`E-goi contact create → ${email}`] };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const contactId = asString(ctx.options.contactId);
  if (!listId) throw new Error('E-goi: listId is required');
  if (!contactId) throw new Error('E-goi: contactId is required');
  const data = await call(
    ctx,
    'GET',
    `/v3/lists/${encodeURIComponent(listId)}/contacts/${encodeURIComponent(contactId)}`,
  );
  return { outputs: { contact: data }, logs: [`E-goi contact get → ${contactId}`] };
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const contactId = asString(ctx.options.contactId);
  if (!listId) throw new Error('E-goi: listId is required');
  if (!contactId) throw new Error('E-goi: contactId is required');
  const base: Record<string, unknown> = {};
  for (const k of ['email', 'firstName', 'lastName', 'cellphone'] as const) {
    const v = asString(ctx.options[k]);
    if (!v) continue;
    // E-goi API field names use snake_case; map ours.
    base[k === 'firstName' ? 'first_name' : k === 'lastName' ? 'last_name' : k] = v;
  }
  if (Object.keys(base).length === 0) {
    throw new Error('E-goi: at least one base field must be set');
  }
  const data = await call(
    ctx,
    'PATCH',
    `/v3/lists/${encodeURIComponent(listId)}/contacts/${encodeURIComponent(contactId)}`,
    { base },
  );
  return { outputs: { contact: data }, logs: [`E-goi contact update → ${contactId}`] };
}

async function contactAttachTag(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const tagId = asString(ctx.options.tagId);
  const contactId = asString(ctx.options.contactId);
  if (!listId) throw new Error('E-goi: listId is required');
  if (!tagId) throw new Error('E-goi: tagId is required');
  if (!contactId) throw new Error('E-goi: contactId is required');
  const data = await call(
    ctx,
    'POST',
    `/v3/lists/${encodeURIComponent(listId)}/contacts/actions/attach-tag`,
    { tag_id: tagId, contacts: [contactId] },
  );
  return { outputs: { result: data }, logs: [`E-goi attach tag ${tagId} → ${contactId}`] };
}

async function listList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await call(ctx, 'GET', '/v3/lists');
  return { outputs: { result: data }, logs: ['E-goi list list'] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_egoi',
  name: 'E-goi',
  description: 'Manage contacts and lists in an E-goi account.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'egoi',
  },
  actions: [
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Add a contact to a list.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'cellphone', label: 'Cellphone', type: 'text' },
      ],
      run: contactCreate,
    },
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact within a list.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
      ],
      run: contactGet,
    },
    {
      id: 'contact_update',
      label: 'Update contact',
      description: 'Patch a contact within a list. Only set base fields are sent.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'cellphone', label: 'Cellphone', type: 'text' },
      ],
      run: contactUpdate,
    },
    {
      id: 'contact_attach_tag',
      label: 'Attach tag to contact',
      description: 'Attach an existing tag to a contact within a list.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'tagId', label: 'Tag ID', type: 'text', required: true },
      ],
      run: contactAttachTag,
    },
    {
      id: 'list_list',
      label: 'List lists',
      description: 'List all lists in the E-goi account.',
      fields: [],
      run: listList,
    },
  ],
};

registerForgeBlock(block);
export default block;
