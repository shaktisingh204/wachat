/**
 * Forge block: Autopilot
 *
 * Source: n8n-master/packages/nodes-base/nodes/Autopilot/Autopilot.node.ts
 *
 * Auth: `autopilotapikey: <apiKey>` header against https://api2.autopilothq.com/v1.
 *
 * Operations covered:
 *   - contact.upsert       POST   /contact
 *   - contact.get          GET    /contact/{contactId}
 *   - contact.delete       DELETE /contact/{contactId}
 *   - list.list            GET    /lists
 *   - list.add_contact     POST   /list/{listId}/contact/{contactId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api2.autopilothq.com/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Autopilot: apiKey is required');
  return { autopilotapikey: apiKey, Accept: 'application/json' };
}

async function contactUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Autopilot: email is required');
  const contact: Record<string, unknown> = { Email: email };
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const company = asString(ctx.options.company);
  const phone = asString(ctx.options.phone);
  if (firstName) contact.FirstName = firstName;
  if (lastName) contact.LastName = lastName;
  if (company) contact.Company = company;
  if (phone) contact.Phone = phone;
  const res = await apiRequest({
    service: 'Autopilot',
    method: 'POST',
    url: `${API}/contact`,
    headers: authHeaders(ctx),
    json: { contact },
  });
  return { outputs: { contact: res.data }, logs: [`Autopilot contact upsert → ${email}`] };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  if (!contactId) throw new Error('Autopilot: contactId is required');
  const res = await apiRequest({
    service: 'Autopilot',
    method: 'GET',
    url: `${API}/contact/${encodeURIComponent(contactId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { contact: res.data }, logs: [`Autopilot contact get → ${contactId}`] };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  if (!contactId) throw new Error('Autopilot: contactId is required');
  await apiRequest({
    service: 'Autopilot',
    method: 'DELETE',
    url: `${API}/contact/${encodeURIComponent(contactId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true }, logs: [`Autopilot contact delete → ${contactId}`] };
}

async function listList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Autopilot',
    method: 'GET',
    url: `${API}/lists`,
    headers: authHeaders(ctx),
  });
  const data = res.data as { lists?: unknown } | unknown;
  return {
    outputs: { lists: (data as { lists?: unknown })?.lists ?? data },
    logs: ['Autopilot list list'],
  };
}

async function listAddContact(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const contactId = asString(ctx.options.contactId);
  if (!listId) throw new Error('Autopilot: listId is required');
  if (!contactId) throw new Error('Autopilot: contactId is required');
  const res = await apiRequest({
    service: 'Autopilot',
    method: 'POST',
    url: `${API}/list/${encodeURIComponent(listId)}/contact/${encodeURIComponent(contactId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { result: res.data, success: true }, logs: [`Autopilot list add contact → ${contactId} → ${listId}`] };
}

const block: ForgeBlock = {
  id: 'forge_autopilot',
  name: 'Autopilot',
  description: 'Manage Autopilot contacts and lists.',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'contact_upsert',
      label: 'Upsert contact',
      description: 'Create or update a contact by email.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'company', label: 'Company', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
      ],
      run: contactUpsert,
    },
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by id or email.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'contactId', label: 'Contact ID or email', type: 'text', required: true },
      ],
      run: contactGet,
    },
    {
      id: 'contact_delete',
      label: 'Delete contact',
      description: 'Delete a contact by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
      ],
      run: contactDelete,
    },
    {
      id: 'list_list',
      label: 'List lists',
      description: 'Fetch all lists.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: listList,
    },
    {
      id: 'list_add_contact',
      label: 'Add contact to list',
      description: 'Add an existing contact to a list.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
      ],
      run: listAddContact,
    },
  ],
};

registerForgeBlock(block);
export default block;
