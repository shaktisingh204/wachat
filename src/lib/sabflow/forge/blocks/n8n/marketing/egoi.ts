/**
 * Forge block: E-goi
 *
 * Source: n8n-master/packages/nodes-base/nodes/Egoi/Egoi.node.ts
 * Credential type: 'egoi' — { apiKey }; sent as `Apikey: <key>` header.
 *
 * Operations covered:
 *   - contact.create
 *   - contact.get
 *   - list.list
 *
 * Out of scope (deferred):
 *   - contact.update / contact.addToList
 *   - extra-fields / consent collections
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
