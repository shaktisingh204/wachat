/**
 * Forge block: SendGrid (extended)
 *
 * Source: n8n-master/packages/nodes-base/nodes/SendGrid/SendGrid.node.ts
 * Credential type: 'sendgrid'
 *
 * Operations covered (mail + marketing contact + list subset):
 *   - mail.send         POST  /v3/mail/send
 *   - contact.upsert    PUT   /v3/marketing/contacts          (n8n "create"/"update")
 *   - contact.get       GET   /v3/marketing/contacts/{id}
 *   - contact.search    POST  /v3/marketing/contacts/search   (by email or query)
 *   - contact.delete    DELETE /v3/marketing/contacts?ids={id}
 *   - list.create       POST  /v3/marketing/lists
 *   - list.get          GET   /v3/marketing/lists/{id}
 *   - list.getAll       GET   /v3/marketing/lists             (paginated)
 *   - list.update       PATCH /v3/marketing/lists/{id}
 *   - list.delete       DELETE /v3/marketing/lists/{id}
 *
 * Out of scope for the first port:
 *   - LoadOptions for template dropdowns (templateId is a free-text field)
 *   - Suppression management, stats, single-sender verification
 *
 * Note: the original `forge/blocks/sendgrid.ts` only sends a single mail.
 * This port carries the id `forge_sendgrid_ext` so both can coexist.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asBoolean, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

const BASE = 'https://api.sendgrid.com/v3';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('SendGrid', ctx.credential);
  const apiKey = cred.apiKey ?? '';
  if (!apiKey) throw new Error('SendGrid: credential is missing `apiKey`');
  return { Authorization: `Bearer ${apiKey}` };
}

async function mailSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const from = asString(ctx.options.fromEmail);
  const to = asString(ctx.options.toEmail);
  const subject = asString(ctx.options.subject);
  const text = asString(ctx.options.text);
  const html = asString(ctx.options.html);
  const templateId = asString(ctx.options.templateId);
  const dynamicDataRaw = asString(ctx.options.dynamicTemplateData);
  if (!from) throw new Error('SendGrid: fromEmail is required');
  if (!to) throw new Error('SendGrid: toEmail is required');

  const toList = to.split(',').map((s) => s.trim()).filter(Boolean).map((email) => ({ email }));
  const personalization: Record<string, unknown> = { to: toList };
  if (subject && !templateId) personalization.subject = subject;
  if (templateId && dynamicDataRaw) {
    try {
      personalization.dynamic_template_data = JSON.parse(dynamicDataRaw);
    } catch {
      throw new Error('SendGrid: dynamicTemplateData must be valid JSON');
    }
  }

  const body: Record<string, unknown> = {
    from: { email: from },
    personalizations: [personalization],
  };
  if (templateId) body.template_id = templateId;
  else {
    if (subject) body.subject = subject;
    const content: Array<{ type: string; value: string }> = [];
    if (text) content.push({ type: 'text/plain', value: text });
    if (html) content.push({ type: 'text/html', value: html });
    if (content.length === 0) throw new Error('SendGrid: provide text, html or templateId');
    body.content = content;
  }

  const res = await apiRequest({
    service: 'SendGrid',
    method: 'POST',
    url: `${BASE}/mail/send`,
    headers: authHeaders(ctx),
    json: body,
  });
  return {
    outputs: { success: true, messageId: res.headers.get('x-message-id') ?? undefined },
    logs: [`SendGrid mail send → ${to}`],
  };
}

async function contactUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('SendGrid: email is required');
  const contact: Record<string, unknown> = { email };
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const city = asString(ctx.options.city);
  const country = asString(ctx.options.country);
  if (firstName) contact.first_name = firstName;
  if (lastName) contact.last_name = lastName;
  if (city) contact.city = city;
  if (country) contact.country = country;

  const listIdsRaw = asString(ctx.options.listIds);
  const body: Record<string, unknown> = { contacts: [contact] };
  if (listIdsRaw) {
    body.list_ids = listIdsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const res = await apiRequest({
    service: 'SendGrid',
    method: 'PUT',
    url: `${BASE}/marketing/contacts`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`SendGrid contact upsert → ${email}`] };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  if (!contactId) throw new Error('SendGrid: contactId is required');
  const res = await apiRequest({
    service: 'SendGrid',
    method: 'GET',
    url: `${BASE}/marketing/contacts/${encodeURIComponent(contactId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { contact: res.data }, logs: [`SendGrid contact get → ${contactId}`] };
}

async function contactSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const query = asString(ctx.options.query);
  const sql = query || (email ? `email LIKE '${email.replace(/'/g, "''")}'` : '');
  if (!sql) throw new Error('SendGrid: email or query is required');
  const res = await apiRequest({
    service: 'SendGrid',
    method: 'POST',
    url: `${BASE}/marketing/contacts/search`,
    headers: authHeaders(ctx),
    json: { query: sql },
  });
  return { outputs: { results: res.data }, logs: ['SendGrid contact search'] };
}

async function listCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('SendGrid: name is required');
  const res = await apiRequest({
    service: 'SendGrid',
    method: 'POST',
    url: `${BASE}/marketing/lists`,
    headers: authHeaders(ctx),
    json: { name },
  });
  return { outputs: { list: res.data }, logs: [`SendGrid list create → ${name}`] };
}

async function listGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  if (!listId) throw new Error('SendGrid: listId is required');
  const contactSample = asBoolean(ctx.options.contactSample);
  const qs = contactSample ? '?contact_sample=true' : '';
  const res = await apiRequest({
    service: 'SendGrid',
    method: 'GET',
    url: `${BASE}/marketing/lists/${encodeURIComponent(listId)}${qs}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { list: res.data }, logs: [`SendGrid list get → ${listId}`] };
}

async function listGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const headers = authHeaders(ctx);
  const limit = asNumber(ctx.options.limit);
  // SendGrid uses _metadata.next as an absolute URL — paginateAll lets us
  // hand it back unchanged on the next fetch instead of munging cursors.
  const all = await paginateAll<unknown>({
    fetchPage: async (cursor) => {
      const url = cursor ?? `${BASE}/marketing/lists?page_size=100`;
      const page = await apiRequest({ service: 'SendGrid', method: 'GET', url, headers });
      const body = page.data as { result?: unknown[]; _metadata?: { next?: string } };
      return { items: body.result ?? [], nextCursor: body._metadata?.next };
    },
    maxItems: limit && limit > 0 ? limit : undefined,
  });
  return { outputs: { lists: all, count: all.length }, logs: [`SendGrid list getAll → ${all.length}`] };
}

async function listUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const name = asString(ctx.options.name);
  if (!listId) throw new Error('SendGrid: listId is required');
  if (!name) throw new Error('SendGrid: name is required');
  const res = await apiRequest({
    service: 'SendGrid',
    method: 'PATCH',
    url: `${BASE}/marketing/lists/${encodeURIComponent(listId)}`,
    headers: authHeaders(ctx),
    json: { name },
  });
  return { outputs: { list: res.data }, logs: [`SendGrid list update → ${listId}`] };
}

async function listDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  if (!listId) throw new Error('SendGrid: listId is required');
  const deleteContacts = asBoolean(ctx.options.deleteContacts);
  const qs = deleteContacts ? '?delete_contacts=true' : '';
  await apiRequest({
    service: 'SendGrid',
    method: 'DELETE',
    url: `${BASE}/marketing/lists/${encodeURIComponent(listId)}${qs}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true }, logs: [`SendGrid list delete → ${listId}`] };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  if (!contactId) throw new Error('SendGrid: contactId is required');
  const url = `${BASE}/marketing/contacts?ids=${encodeURIComponent(contactId)}`;
  const res = await apiRequest({
    service: 'SendGrid',
    method: 'DELETE',
    url,
    headers: authHeaders(ctx),
  });
  return { outputs: { result: res.data, success: true }, logs: [`SendGrid contact delete → ${contactId}`] };
}

const block: ForgeBlock = {
  id: 'forge_sendgrid_ext',
  name: 'SendGrid (extended)',
  description: 'Send mail and manage marketing contacts in SendGrid.',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'sendgrid' },
  actions: [
    {
      id: 'mail_send',
      label: 'Send mail',
      description: 'Send a transactional or templated email.',
      fields: [
        { id: 'fromEmail', label: 'From email', type: 'text', required: true },
        { id: 'toEmail', label: 'To email (comma separated)', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'text', label: 'Plain text body', type: 'textarea' },
        { id: 'html', label: 'HTML body', type: 'textarea' },
        { id: 'templateId', label: 'Template ID (overrides subject/body)', type: 'text' },
        { id: 'dynamicTemplateData', label: 'Dynamic template data (JSON)', type: 'json' },
      ],
      run: mailSend,
    },
    {
      id: 'contact_upsert',
      label: 'Upsert contact',
      description: 'Create or update a marketing contact (PUT semantics).',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'city', label: 'City', type: 'text' },
        { id: 'country', label: 'Country', type: 'text' },
        { id: 'listIds', label: 'List IDs (comma separated)', type: 'text' },
      ],
      run: contactUpsert,
    },
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by ID.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactGet,
    },
    {
      id: 'contact_search',
      label: 'Search contacts',
      description: 'Query marketing contacts by email or full SGQL.',
      fields: [
        { id: 'email', label: 'Email (LIKE query)', type: 'text' },
        { id: 'query', label: 'Custom SGQL query (overrides email)', type: 'textarea' },
      ],
      run: contactSearch,
    },
    {
      id: 'contact_delete',
      label: 'Delete contact',
      description: 'Delete a contact by ID.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactDelete,
    },
    {
      id: 'list_create',
      label: 'Create list',
      description: 'Create a new marketing list.',
      fields: [{ id: 'name', label: 'List name', type: 'text', required: true }],
      run: listCreate,
    },
    {
      id: 'list_get',
      label: 'Get list',
      description: 'Fetch a marketing list by ID.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'contactSample', label: 'Include contact sample', type: 'toggle' },
      ],
      run: listGet,
    },
    {
      id: 'list_get_all',
      label: 'List all lists',
      description: 'Return every marketing list (paginated).',
      fields: [{ id: 'limit', label: 'Max results (blank = all)', type: 'number' }],
      run: listGetAll,
    },
    {
      id: 'list_update',
      label: 'Update list',
      description: 'Rename a marketing list.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'name', label: 'New name', type: 'text', required: true },
      ],
      run: listUpdate,
    },
    {
      id: 'list_delete',
      label: 'Delete list',
      description: 'Delete a marketing list, optionally cascading to its contacts.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'deleteContacts', label: 'Also delete contained contacts', type: 'toggle' },
      ],
      run: listDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
