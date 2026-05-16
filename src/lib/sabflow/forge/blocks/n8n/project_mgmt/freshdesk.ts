/**
 * Forge block: Freshdesk
 *
 * Source: n8n-master/packages/nodes-base/nodes/Freshdesk/Freshdesk.node.ts
 * Credential type: 'freshdesk' (CREDENTIAL_FIELD_SCHEMAS → { domain, apiKey }).
 *
 * Operations covered (ticket + contact subset):
 *   - ticket.create   POST   /api/v2/tickets
 *   - ticket.get      GET    /api/v2/tickets/{id}
 *   - ticket.update   PUT    /api/v2/tickets/{id}
 *   - ticket.delete   DELETE /api/v2/tickets/{id}
 *   - ticket.addReply POST   /api/v2/tickets/{id}/reply
 *   - contact.create  POST   /api/v2/contacts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

type FdCred = { domain: string; apiKey: string };

function getCred(ctx: ForgeActionContext): FdCred {
  const cred = requireCredential('Freshdesk', ctx.credential);
  let domain = (cred.domain ?? '').trim().replace(/\/+$/, '');
  if (!domain) throw new Error('Freshdesk: credential is missing `domain`');
  if (!domain.includes('.')) domain += '.freshdesk.com';
  const apiKey = cred.apiKey;
  if (!apiKey) throw new Error('Freshdesk: credential is missing `apiKey`');
  return { domain, apiKey };
}

function baseUrl(c: FdCred): string {
  return `https://${c.domain}/api/v2`;
}

function authHeaders(c: FdCred): Record<string, string> {
  // Freshdesk uses API key as username, "X" as password (Basic auth).
  const basic = btoa(`${c.apiKey}:X`);
  return { Authorization: `Basic ${basic}` };
}

const STATUS_OPTIONS = [
  { label: '(none)', value: '' },
  { label: 'Open (2)', value: '2' },
  { label: 'Pending (3)', value: '3' },
  { label: 'Resolved (4)', value: '4' },
  { label: 'Closed (5)', value: '5' },
];

const PRIORITY_OPTIONS = [
  { label: '(none)', value: '' },
  { label: 'Low (1)', value: '1' },
  { label: 'Medium (2)', value: '2' },
  { label: 'High (3)', value: '3' },
  { label: 'Urgent (4)', value: '4' },
];

const SOURCE_OPTIONS = [
  { label: '(default)', value: '' },
  { label: 'Email (1)', value: '1' },
  { label: 'Portal (2)', value: '2' },
  { label: 'Phone (3)', value: '3' },
  { label: 'Chat (7)', value: '7' },
];

async function ticketCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const subject = asString(ctx.options.subject);
  const description = asString(ctx.options.description);
  const email = asString(ctx.options.email);
  if (!subject) throw new Error('Freshdesk: subject is required');
  if (!description) throw new Error('Freshdesk: description is required');
  if (!email) throw new Error('Freshdesk: email is required');

  const body: Record<string, unknown> = {
    subject,
    description,
    email,
    status: Number(asString(ctx.options.status) || '2'),
    priority: Number(asString(ctx.options.priority) || '1'),
  };
  const source = asString(ctx.options.source);
  if (source) body.source = Number(source);
  const name = asString(ctx.options.name);
  if (name) body.name = name;
  const tags = asString(ctx.options.tags);
  if (tags) body.tags = tags.split(',').map((s) => s.trim()).filter(Boolean);

  const res = await apiRequest({
    service: 'Freshdesk',
    method: 'POST',
    url: `${baseUrl(c)}/tickets`,
    headers: authHeaders(c),
    json: body,
  });
  return { outputs: { ticket: res.data }, logs: [`Freshdesk ticket create → ${(res.data as { id?: number })?.id}`] };
}

async function ticketGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Freshdesk: id is required');
  const res = await apiRequest({
    service: 'Freshdesk',
    method: 'GET',
    url: `${baseUrl(c)}/tickets/${encodeURIComponent(id)}`,
    headers: authHeaders(c),
  });
  return { outputs: { ticket: res.data }, logs: [`Freshdesk ticket get → ${id}`] };
}

async function ticketUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Freshdesk: id is required');

  const body: Record<string, unknown> = {};
  const subject = asString(ctx.options.subject);
  if (subject) body.subject = subject;
  const description = asString(ctx.options.description);
  if (description) body.description = description;
  const status = asString(ctx.options.status);
  if (status) body.status = Number(status);
  const priority = asString(ctx.options.priority);
  if (priority) body.priority = Number(priority);
  const responderId = asString(ctx.options.responderId);
  if (responderId) body.responder_id = Number(responderId);
  const tags = asString(ctx.options.tags);
  if (tags) body.tags = tags.split(',').map((s) => s.trim()).filter(Boolean);

  if (Object.keys(body).length === 0) {
    throw new Error('Freshdesk: at least one updatable field must be set');
  }

  const res = await apiRequest({
    service: 'Freshdesk',
    method: 'PUT',
    url: `${baseUrl(c)}/tickets/${encodeURIComponent(id)}`,
    headers: authHeaders(c),
    json: body,
  });
  return { outputs: { ticket: res.data }, logs: [`Freshdesk ticket update → ${id}`] };
}

async function ticketDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Freshdesk: id is required');
  await apiRequest({
    service: 'Freshdesk',
    method: 'DELETE',
    url: `${baseUrl(c)}/tickets/${encodeURIComponent(id)}`,
    headers: authHeaders(c),
  });
  return { outputs: { success: true }, logs: [`Freshdesk ticket delete → ${id}`] };
}

async function ticketReply(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const id = asString(ctx.options.id);
  const body = asString(ctx.options.body);
  if (!id) throw new Error('Freshdesk: id is required');
  if (!body) throw new Error('Freshdesk: body is required');
  const res = await apiRequest({
    service: 'Freshdesk',
    method: 'POST',
    url: `${baseUrl(c)}/tickets/${encodeURIComponent(id)}/reply`,
    headers: authHeaders(c),
    json: { body },
  });
  return { outputs: { reply: res.data }, logs: [`Freshdesk reply → ${id}`] };
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const name = asString(ctx.options.name);
  const email = asString(ctx.options.email);
  if (!name) throw new Error('Freshdesk: name is required');
  if (!email) throw new Error('Freshdesk: email is required');
  const body: Record<string, unknown> = { name, email };
  const phone = asString(ctx.options.phone);
  if (phone) body.phone = phone;
  const mobile = asString(ctx.options.mobile);
  if (mobile) body.mobile = mobile;

  const res = await apiRequest({
    service: 'Freshdesk',
    method: 'POST',
    url: `${baseUrl(c)}/contacts`,
    headers: authHeaders(c),
    json: body,
  });
  return { outputs: { contact: res.data }, logs: [`Freshdesk contact create → ${(res.data as { id?: number })?.id}`] };
}

const block: ForgeBlock = {
  id: 'forge_freshdesk',
  name: 'Freshdesk',
  description: 'Create, update and reply to Freshdesk tickets from a flow.',
  iconName: 'LuLifeBuoy',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'freshdesk' },
  actions: [
    {
      id: 'ticket_create',
      label: 'Create ticket',
      description: 'Create a new support ticket.',
      fields: [
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea', required: true },
        { id: 'email', label: 'Requester email', type: 'text', required: true },
        { id: 'name', label: 'Requester name', type: 'text' },
        { id: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, defaultValue: '2' },
        { id: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS, defaultValue: '1' },
        { id: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS },
        { id: 'tags', label: 'Tags (comma separated)', type: 'text' },
      ],
      run: ticketCreate,
    },
    {
      id: 'ticket_get',
      label: 'Get ticket',
      description: 'Fetch a single ticket by id.',
      fields: [{ id: 'id', label: 'Ticket ID', type: 'text', required: true }],
      run: ticketGet,
    },
    {
      id: 'ticket_update',
      label: 'Update ticket',
      description: 'Patch a ticket. Only set fields are sent.',
      fields: [
        { id: 'id', label: 'Ticket ID', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
        { id: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
        { id: 'responderId', label: 'Responder user ID', type: 'text' },
        { id: 'tags', label: 'Tags (comma separated)', type: 'text' },
      ],
      run: ticketUpdate,
    },
    {
      id: 'ticket_delete',
      label: 'Delete ticket',
      description: 'Permanently delete a ticket.',
      fields: [{ id: 'id', label: 'Ticket ID', type: 'text', required: true }],
      run: ticketDelete,
    },
    {
      id: 'ticket_reply',
      label: 'Reply to ticket',
      description: 'Post a reply on a ticket.',
      fields: [
        { id: 'id', label: 'Ticket ID', type: 'text', required: true },
        { id: 'body', label: 'Body (HTML allowed)', type: 'textarea', required: true },
      ],
      run: ticketReply,
    },
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Create a new Freshdesk contact.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'mobile', label: 'Mobile', type: 'text' },
      ],
      run: contactCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
