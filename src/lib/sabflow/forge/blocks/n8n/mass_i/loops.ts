/**
 * Forge block: Loops.so
 *
 * API: https://loops.so/docs/api-reference
 * Auth: `Authorization: Bearer <api_key>`.
 *
 * Operations covered:
 *   - contact.create            POST   /v1/contacts/create
 *   - contact.update            PUT    /v1/contacts/update
 *   - contact.find              GET    /v1/contacts/find
 *   - event.send                POST   /v1/events/send
 *   - transactional.send        POST   /v1/transactional
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://app.loops.so/api';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Loops: apiKey is required');
  return { Authorization: `Bearer ${key}` };
}

function maybeJson(s: string): Record<string, unknown> {
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error('Loops: properties must be valid JSON');
  }
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Loops: email is required');
  const body: Record<string, unknown> = { email, ...maybeJson(asString(ctx.options.properties)) };
  const res = await apiRequest({
    service: 'Loops',
    method: 'POST',
    url: `${API}/v1/contacts/create`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { contact: res.data }, logs: [`Loops contact create → ${email}`] };
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Loops: email is required');
  const body: Record<string, unknown> = { email, ...maybeJson(asString(ctx.options.properties)) };
  const res = await apiRequest({
    service: 'Loops',
    method: 'PUT',
    url: `${API}/v1/contacts/update`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { contact: res.data }, logs: [`Loops contact update → ${email}`] };
}

async function contactFind(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Loops: email is required');
  const res = await apiRequest({
    service: 'Loops',
    method: 'GET',
    url: `${API}/v1/contacts/find?email=${encodeURIComponent(email)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { contact: res.data }, logs: [`Loops contact find → ${email}`] };
}

async function eventSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const eventName = asString(ctx.options.eventName);
  if (!email || !eventName) throw new Error('Loops: email and eventName are required');
  const body: Record<string, unknown> = {
    email,
    eventName,
    eventProperties: maybeJson(asString(ctx.options.eventProperties)),
  };
  const res = await apiRequest({
    service: 'Loops',
    method: 'POST',
    url: `${API}/v1/events/send`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Loops event send → ${eventName}`] };
}

async function transactionalSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const transactionalId = asString(ctx.options.transactionalId);
  if (!email || !transactionalId) throw new Error('Loops: email and transactionalId are required');
  const body: Record<string, unknown> = {
    email,
    transactionalId,
    dataVariables: maybeJson(asString(ctx.options.dataVariables)),
  };
  const res = await apiRequest({
    service: 'Loops',
    method: 'POST',
    url: `${API}/v1/transactional`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Loops transactional send → ${transactionalId}`] };
}

const block: ForgeBlock = {
  id: 'forge_loops',
  name: 'Loops.so',
  description: 'Loops contacts, events and transactional emails.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Add a contact.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'properties', label: 'Properties JSON', type: 'textarea' },
      ],
      run: contactCreate,
    },
    {
      id: 'contact_update',
      label: 'Update contact',
      description: 'Update contact properties by email.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'properties', label: 'Properties JSON', type: 'textarea' },
      ],
      run: contactUpdate,
    },
    {
      id: 'contact_find',
      label: 'Find contact',
      description: 'Find a contact by email.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
      ],
      run: contactFind,
    },
    {
      id: 'event_send',
      label: 'Send event',
      description: 'Fire a Loops event for a contact.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'eventName', label: 'Event name', type: 'text', required: true },
        { id: 'eventProperties', label: 'Event properties JSON', type: 'textarea' },
      ],
      run: eventSend,
    },
    {
      id: 'transactional_send',
      label: 'Send transactional',
      description: 'Send a transactional email by template id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'transactionalId', label: 'Transactional template ID', type: 'text', required: true },
        { id: 'dataVariables', label: 'Data variables JSON', type: 'textarea' },
      ],
      run: transactionalSend,
    },
  ],
};

registerForgeBlock(block);
export default block;
