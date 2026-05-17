/**
 * Forge block: Resend
 *
 * `https://api.resend.com` — send email, manage audiences and contacts.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.resend.com';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Resend: apiKey is required');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

async function sendEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const subject = asString(ctx.options.subject);
  const html = asString(ctx.options.html);
  const text = asString(ctx.options.text);
  const replyTo = asString(ctx.options.replyTo);
  if (!from || !to || !subject) {
    throw new Error('Resend: from, to and subject are required');
  }
  const body: Record<string, unknown> = { from, to, subject };
  if (html) body.html = html;
  if (text) body.text = text;
  if (replyTo) body.reply_to = replyTo;
  const res = await apiRequest({
    service: 'Resend',
    method: 'POST',
    url: `${API}/emails`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { email: res.data }, logs: [`Resend send → ${to}`] };
}

async function createAudience(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Resend: name is required');
  const res = await apiRequest({
    service: 'Resend',
    method: 'POST',
    url: `${API}/audiences`,
    headers: authHeaders(ctx),
    json: { name },
  });
  return { outputs: { audience: res.data }, logs: [`Resend create audience → ${name}`] };
}

async function addContact(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const audienceId = asString(ctx.options.audienceId);
  const email = asString(ctx.options.email);
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  if (!audienceId || !email) {
    throw new Error('Resend: audienceId and email are required');
  }
  const body: Record<string, unknown> = { email };
  if (firstName) body.first_name = firstName;
  if (lastName) body.last_name = lastName;
  const res = await apiRequest({
    service: 'Resend',
    method: 'POST',
    url: `${API}/audiences/${encodeURIComponent(audienceId)}/contacts`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { contact: res.data }, logs: [`Resend add contact → ${email}`] };
}

const block: ForgeBlock = {
  id: 'forge_resend',
  name: 'Resend',
  description: 'Send transactional email and manage audiences via Resend.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send_email',
      label: 'Send email',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'from', label: 'From', type: 'text', required: true },
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'html', label: 'HTML body', type: 'textarea' },
        { id: 'text', label: 'Text body', type: 'textarea' },
        { id: 'replyTo', label: 'Reply-To', type: 'text' },
      ],
      run: sendEmail,
    },
    {
      id: 'create_audience',
      label: 'Create audience',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
      ],
      run: createAudience,
    },
    {
      id: 'add_contact',
      label: 'Add contact',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'audienceId', label: 'Audience ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
      ],
      run: addContact,
    },
  ],
};

registerForgeBlock(block);
export default block;
