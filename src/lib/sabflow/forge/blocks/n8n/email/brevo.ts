/**
 * Forge block: Brevo (formerly SendinBlue)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Brevo/Brevo.node.ts
 * Credential type: 'brevo' (apiKey)
 *
 * Auth header: `api-key: <KEY>`.
 *
 * Operations covered:
 *   - contact.create        POST   /v3/contacts
 *   - contact.get           GET    /v3/contacts/{identifier}
 *   - contact.update        PUT    /v3/contacts/{identifier}
 *   - contact.delete        DELETE /v3/contacts/{identifier}
 *   - transactional.sendEmail POST /v3/smtp/email
 *   - campaign.create       POST   /v3/emailCampaigns
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
import { apiRequest, asString, requireCredential } from '../_shared/http';

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
