/**
 * Forge block: Brevo (formerly SendinBlue)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Brevo/Brevo.node.ts
 * Credential type: 'brevo' (apiKey)
 *
 * Auth header: `api-key: <KEY>`.
 *
 * Operations covered:
 *   - contact.create          POST   /v3/contacts
 *   - contact.upsert          POST   /v3/contacts                  (updateEnabled=true)
 *   - contact.get             GET    /v3/contacts/{identifier}
 *   - contact.getAll          GET    /v3/contacts                  (paginated)
 *   - contact.update          PUT    /v3/contacts/{identifier}
 *   - contact.delete          DELETE /v3/contacts/{identifier}
 *   - transactional.sendEmail POST   /v3/smtp/email
 *   - transactional.sendTemplate POST /v3/smtp/email               (templateId only)
 *   - campaign.create         POST   /v3/emailCampaigns
 *   - sender.create           POST   /v3/senders
 *   - sender.delete           DELETE /v3/senders/{id}
 *   - sender.getAll           GET    /v3/senders
 *   - attribute.create        POST   /v3/contacts/attributes/{category}/{name}
 *   - attribute.delete        DELETE /v3/contacts/attributes/{category}/{name}
 *   - attribute.getAll        GET    /v3/contacts/attributes
 *
 * Out of scope for the first port:
 *   - LoadOptions for list/template IDs
 *   - SMS, WhatsApp templates, statistics
 *   - Attachments (binary)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

const BASE = 'https://api.brevo.com/v3';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Brevo', ctx.credential);
  const apiKey = cred.apiKey ?? '';
  if (!apiKey) throw new Error('Brevo: credential is missing `apiKey`');
  return { 'api-key': apiKey, Accept: 'application/json' };
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Brevo: email is required');
  const body: Record<string, unknown> = { email };
  const attributesRaw = asString(ctx.options.attributes);
  if (attributesRaw) {
    try {
      body.attributes = JSON.parse(attributesRaw);
    } catch {
      throw new Error('Brevo: attributes must be valid JSON');
    }
  }
  const listIdsRaw = asString(ctx.options.listIds);
  if (listIdsRaw) {
    body.listIds = listIdsRaw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  }
  const updateEnabled = asString(ctx.options.updateEnabled);
  if (updateEnabled === 'true') body.updateEnabled = true;

  const res = await apiRequest({
    service: 'Brevo',
    method: 'POST',
    url: `${BASE}/contacts`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data, success: true }, logs: [`Brevo contact create → ${email}`] };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const identifier = asString(ctx.options.identifier);
  if (!identifier) throw new Error('Brevo: identifier (email or id) is required');
  const res = await apiRequest({
    service: 'Brevo',
    method: 'GET',
    url: `${BASE}/contacts/${encodeURIComponent(identifier)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { contact: res.data }, logs: [`Brevo contact get → ${identifier}`] };
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const identifier = asString(ctx.options.identifier);
  if (!identifier) throw new Error('Brevo: identifier is required');
  const body: Record<string, unknown> = {};
  const emailBlacklisted = asString(ctx.options.emailBlacklisted);
  const smsBlacklisted = asString(ctx.options.smsBlacklisted);
  const attributesRaw = asString(ctx.options.attributes);
  if (emailBlacklisted) body.emailBlacklisted = emailBlacklisted === 'true';
  if (smsBlacklisted) body.smsBlacklisted = smsBlacklisted === 'true';
  if (attributesRaw) {
    try {
      body.attributes = JSON.parse(attributesRaw);
    } catch {
      throw new Error('Brevo: attributes must be valid JSON');
    }
  }
  const listIdsRaw = asString(ctx.options.listIds);
  if (listIdsRaw) {
    body.listIds = listIdsRaw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  }
  if (Object.keys(body).length === 0) {
    throw new Error('Brevo: at least one updatable field must be set');
  }
  await apiRequest({
    service: 'Brevo',
    method: 'PUT',
    url: `${BASE}/contacts/${encodeURIComponent(identifier)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { success: true, identifier }, logs: [`Brevo contact update → ${identifier}`] };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const identifier = asString(ctx.options.identifier);
  if (!identifier) throw new Error('Brevo: identifier is required');
  await apiRequest({
    service: 'Brevo',
    method: 'DELETE',
    url: `${BASE}/contacts/${encodeURIComponent(identifier)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true }, logs: [`Brevo contact delete → ${identifier}`] };
}

async function transactionalSendEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fromEmail = asString(ctx.options.fromEmail);
  const fromName = asString(ctx.options.fromName);
  const toEmail = asString(ctx.options.toEmail);
  const subject = asString(ctx.options.subject);
  const htmlContent = asString(ctx.options.htmlContent);
  const textContent = asString(ctx.options.textContent);
  const templateId = asString(ctx.options.templateId);
  const paramsRaw = asString(ctx.options.params);
  if (!fromEmail && !templateId) throw new Error('Brevo: fromEmail is required (unless using template)');
  if (!toEmail) throw new Error('Brevo: toEmail is required');

  const body: Record<string, unknown> = {
    to: toEmail.split(',').map((s) => s.trim()).filter(Boolean).map((email) => ({ email })),
  };
  if (fromEmail) body.sender = fromName ? { email: fromEmail, name: fromName } : { email: fromEmail };
  if (templateId) body.templateId = Number(templateId);
  if (subject) body.subject = subject;
  if (htmlContent) body.htmlContent = htmlContent;
  if (textContent) body.textContent = textContent;
  if (paramsRaw) {
    try {
      body.params = JSON.parse(paramsRaw);
    } catch {
      throw new Error('Brevo: params must be valid JSON');
    }
  }
  const res = await apiRequest({
    service: 'Brevo',
    method: 'POST',
    url: `${BASE}/smtp/email`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Brevo send → ${toEmail}`] };
}

async function contactUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Brevo: email is required');
  const body: Record<string, unknown> = { email, updateEnabled: true };
  const attributesRaw = asString(ctx.options.attributes);
  if (attributesRaw) {
    try {
      body.attributes = JSON.parse(attributesRaw);
    } catch {
      throw new Error('Brevo: attributes must be valid JSON');
    }
  }
  const listIdsRaw = asString(ctx.options.listIds);
  if (listIdsRaw) {
    body.listIds = listIdsRaw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  }
  const res = await apiRequest({
    service: 'Brevo',
    method: 'POST',
    url: `${BASE}/contacts`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data, success: true }, logs: [`Brevo contact upsert → ${email}`] };
}

async function contactGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asNumber(ctx.options.pageSize) ?? 50;
  const listId = asString(ctx.options.listId);
  // Brevo uses offset+limit pagination; total is in `count`. Walk until items drain or cap hit.
  const contacts = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const offset = cursor ?? '0';
      const qs = new URLSearchParams();
      qs.set('limit', String(pageSize));
      qs.set('offset', offset);
      const url = listId
        ? `${BASE}/contacts/lists/${encodeURIComponent(listId)}/contacts?${qs.toString()}`
        : `${BASE}/contacts?${qs.toString()}`;
      const res = await apiRequest({
        service: 'Brevo',
        method: 'GET',
        url,
        headers: authHeaders(ctx),
      });
      const body = res.data as { contacts?: unknown[]; count?: number } | null;
      const items = (body?.contacts ?? []) as unknown[];
      const consumed = Number(offset) + items.length;
      const total = typeof body?.count === 'number' ? body.count : undefined;
      const more = items.length === pageSize && (total === undefined || consumed < total);
      return { items, nextCursor: more ? String(consumed) : undefined };
    },
  });
  return { outputs: { contacts, count: contacts.length }, logs: [`Brevo contact list → ${contacts.length}`] };
}

async function transactionalSendTemplate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const toEmail = asString(ctx.options.toEmail);
  const templateId = asString(ctx.options.templateId);
  const paramsRaw = asString(ctx.options.params);
  if (!toEmail) throw new Error('Brevo: toEmail is required');
  if (!templateId) throw new Error('Brevo: templateId is required');
  const body: Record<string, unknown> = {
    to: toEmail.split(',').map((s) => s.trim()).filter(Boolean).map((email) => ({ email })),
    templateId: Number(templateId),
  };
  if (paramsRaw) {
    try {
      body.params = JSON.parse(paramsRaw);
    } catch {
      throw new Error('Brevo: params must be valid JSON');
    }
  }
  const res = await apiRequest({
    service: 'Brevo',
    method: 'POST',
    url: `${BASE}/smtp/email`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Brevo template send → ${toEmail}`] };
}

async function senderCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  const email = asString(ctx.options.email);
  if (!name) throw new Error('Brevo: name is required');
  if (!email) throw new Error('Brevo: email is required');
  const res = await apiRequest({
    service: 'Brevo',
    method: 'POST',
    url: `${BASE}/senders`,
    headers: authHeaders(ctx),
    json: { name, email },
  });
  return { outputs: { result: res.data }, logs: [`Brevo sender create → ${email}`] };
}

async function senderDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Brevo: sender id is required');
  await apiRequest({
    service: 'Brevo',
    method: 'DELETE',
    url: `${BASE}/senders/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true, id }, logs: [`Brevo sender delete → ${id}`] };
}

async function senderGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Brevo',
    method: 'GET',
    url: `${BASE}/senders`,
    headers: authHeaders(ctx),
  });
  const body = res.data as { senders?: unknown[] } | null;
  const senders = body?.senders ?? [];
  return { outputs: { senders, count: Array.isArray(senders) ? senders.length : 0 }, logs: ['Brevo sender list'] };
}

async function attributeCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const category = asString(ctx.options.category);
  const name = asString(ctx.options.name);
  const type = asString(ctx.options.type);
  if (!category) throw new Error('Brevo: category is required');
  if (!name) throw new Error('Brevo: name is required');
  const body: Record<string, unknown> = {};
  if (type) body.type = type;
  const value = asString(ctx.options.value);
  if (value) body.value = value;
  const res = await apiRequest({
    service: 'Brevo',
    method: 'POST',
    url: `${BASE}/contacts/attributes/${encodeURIComponent(category)}/${encodeURIComponent(name)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data, success: true }, logs: [`Brevo attribute create → ${category}/${name}`] };
}

async function attributeDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const category = asString(ctx.options.category);
  const name = asString(ctx.options.name);
  if (!category) throw new Error('Brevo: category is required');
  if (!name) throw new Error('Brevo: name is required');
  await apiRequest({
    service: 'Brevo',
    method: 'DELETE',
    url: `${BASE}/contacts/attributes/${encodeURIComponent(category)}/${encodeURIComponent(name)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true }, logs: [`Brevo attribute delete → ${category}/${name}`] };
}

async function attributeGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Brevo',
    method: 'GET',
    url: `${BASE}/contacts/attributes`,
    headers: authHeaders(ctx),
  });
  const body = res.data as { attributes?: unknown[] } | null;
  const attributes = body?.attributes ?? [];
  return {
    outputs: { attributes, count: Array.isArray(attributes) ? attributes.length : 0 },
    logs: ['Brevo attribute list'],
  };
}

async function campaignCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  const subject = asString(ctx.options.subject);
  const senderEmail = asString(ctx.options.senderEmail);
  const senderName = asString(ctx.options.senderName);
  const htmlContent = asString(ctx.options.htmlContent);
  const listIdsRaw = asString(ctx.options.listIds);
  if (!name) throw new Error('Brevo: name is required');
  if (!subject) throw new Error('Brevo: subject is required');
  if (!senderEmail) throw new Error('Brevo: senderEmail is required');
  if (!htmlContent) throw new Error('Brevo: htmlContent is required');

  const body: Record<string, unknown> = {
    name,
    subject,
    sender: senderName ? { name: senderName, email: senderEmail } : { email: senderEmail },
    htmlContent,
    recipients: listIdsRaw
      ? { listIds: listIdsRaw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)) }
      : undefined,
  };
  const res = await apiRequest({
    service: 'Brevo',
    method: 'POST',
    url: `${BASE}/emailCampaigns`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Brevo campaign create → ${name}`] };
}

const block: ForgeBlock = {
  id: 'forge_brevo',
  name: 'Brevo',
  description: 'Manage Brevo (SendinBlue) contacts and send transactional email.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'brevo' },
  actions: [
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Create a new Brevo contact.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'attributes', label: 'Attributes (JSON)', type: 'json' },
        { id: 'listIds', label: 'List IDs (comma separated)', type: 'text' },
        {
          id: 'updateEnabled',
          label: 'Update if exists',
          type: 'select',
          options: [
            { label: 'No', value: 'false' },
            { label: 'Yes', value: 'true' },
          ],
          defaultValue: 'false',
        },
      ],
      run: contactCreate,
    },
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by email or id.',
      fields: [{ id: 'identifier', label: 'Email or ID', type: 'text', required: true }],
      run: contactGet,
    },
    {
      id: 'contact_update',
      label: 'Update contact',
      description: 'Patch a contact.',
      fields: [
        { id: 'identifier', label: 'Email or ID', type: 'text', required: true },
        { id: 'attributes', label: 'Attributes (JSON)', type: 'json' },
        { id: 'listIds', label: 'List IDs (comma separated)', type: 'text' },
        {
          id: 'emailBlacklisted',
          label: 'Email blacklisted',
          type: 'select',
          options: [
            { label: 'Unchanged', value: '' },
            { label: 'Yes', value: 'true' },
            { label: 'No', value: 'false' },
          ],
        },
        {
          id: 'smsBlacklisted',
          label: 'SMS blacklisted',
          type: 'select',
          options: [
            { label: 'Unchanged', value: '' },
            { label: 'Yes', value: 'true' },
            { label: 'No', value: 'false' },
          ],
        },
      ],
      run: contactUpdate,
    },
    {
      id: 'contact_delete',
      label: 'Delete contact',
      description: 'Delete a contact.',
      fields: [{ id: 'identifier', label: 'Email or ID', type: 'text', required: true }],
      run: contactDelete,
    },
    {
      id: 'transactional_send_email',
      label: 'Send transactional email',
      description: 'Send a transactional email (or template).',
      fields: [
        { id: 'fromEmail', label: 'From email', type: 'text' },
        { id: 'fromName', label: 'From name', type: 'text' },
        { id: 'toEmail', label: 'To email (comma separated)', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'htmlContent', label: 'HTML content', type: 'textarea' },
        { id: 'textContent', label: 'Text content', type: 'textarea' },
        { id: 'templateId', label: 'Template ID', type: 'text' },
        { id: 'params', label: 'Template params (JSON)', type: 'json' },
      ],
      run: transactionalSendEmail,
    },
    {
      id: 'contact_upsert',
      label: 'Create or update contact',
      description: 'Insert a contact, or update if email already exists.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'attributes', label: 'Attributes (JSON)', type: 'json' },
        { id: 'listIds', label: 'List IDs (comma separated)', type: 'text' },
      ],
      run: contactUpsert,
    },
    {
      id: 'contact_get_all',
      label: 'List contacts (paginated)',
      description: 'Walk Brevo contact pagination (optionally inside a list).',
      fields: [
        { id: 'listId', label: 'List ID (optional)', type: 'text' },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 50)', type: 'number', defaultValue: '50' },
      ],
      run: contactGetAll,
    },
    {
      id: 'transactional_send_template',
      label: 'Send transactional template',
      description: 'Send a pre-saved Brevo template by id.',
      fields: [
        { id: 'toEmail', label: 'To email (comma separated)', type: 'text', required: true },
        { id: 'templateId', label: 'Template ID', type: 'text', required: true },
        { id: 'params', label: 'Template params (JSON)', type: 'json' },
      ],
      run: transactionalSendTemplate,
    },
    {
      id: 'sender_create',
      label: 'Create sender',
      description: 'Register a new sender email address.',
      fields: [
        { id: 'name', label: 'Sender name', type: 'text', required: true },
        { id: 'email', label: 'Sender email', type: 'text', required: true },
      ],
      run: senderCreate,
    },
    {
      id: 'sender_delete',
      label: 'Delete sender',
      description: 'Remove a sender by id.',
      fields: [{ id: 'id', label: 'Sender ID', type: 'text', required: true }],
      run: senderDelete,
    },
    {
      id: 'sender_get_all',
      label: 'List senders',
      description: 'List all registered senders.',
      fields: [],
      run: senderGetAll,
    },
    {
      id: 'attribute_create',
      label: 'Create contact attribute',
      description: 'Create a new contact attribute under a category (normal | category | calculated | global | transactional).',
      fields: [
        {
          id: 'category', label: 'Category', type: 'select', required: true,
          options: [
            { label: 'Normal', value: 'normal' },
            { label: 'Category', value: 'category' },
            { label: 'Calculated', value: 'calculated' },
            { label: 'Global', value: 'global' },
            { label: 'Transactional', value: 'transactional' },
          ],
        },
        { id: 'name', label: 'Attribute name', type: 'text', required: true },
        {
          id: 'type', label: 'Type (normal/transactional only)', type: 'select',
          options: [
            { label: '(unset)', value: '' },
            { label: 'Text', value: 'text' },
            { label: 'Date', value: 'date' },
            { label: 'Float', value: 'float' },
            { label: 'Boolean', value: 'boolean' },
          ],
        },
        { id: 'value', label: 'Value (calculated/global only)', type: 'text' },
      ],
      run: attributeCreate,
    },
    {
      id: 'attribute_delete',
      label: 'Delete contact attribute',
      description: 'Delete a contact attribute by category + name.',
      fields: [
        {
          id: 'category', label: 'Category', type: 'select', required: true,
          options: [
            { label: 'Normal', value: 'normal' },
            { label: 'Category', value: 'category' },
            { label: 'Calculated', value: 'calculated' },
            { label: 'Global', value: 'global' },
            { label: 'Transactional', value: 'transactional' },
          ],
        },
        { id: 'name', label: 'Attribute name', type: 'text', required: true },
      ],
      run: attributeDelete,
    },
    {
      id: 'attribute_get_all',
      label: 'List contact attributes',
      description: 'List every contact attribute.',
      fields: [],
      run: attributeGetAll,
    },
    {
      id: 'campaign_create',
      label: 'Create email campaign',
      description: 'Create a draft email campaign.',
      fields: [
        { id: 'name', label: 'Internal name', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'senderEmail', label: 'Sender email', type: 'text', required: true },
        { id: 'senderName', label: 'Sender name', type: 'text' },
        { id: 'htmlContent', label: 'HTML content', type: 'textarea', required: true },
        { id: 'listIds', label: 'List IDs (comma separated)', type: 'text' },
      ],
      run: campaignCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
