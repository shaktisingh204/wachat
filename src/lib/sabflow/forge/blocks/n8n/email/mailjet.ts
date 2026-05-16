/**
 * Forge block: Mailjet
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mailjet/Mailjet.node.ts
 * Credential type: 'mailjet' (apiKey + secretKey for email; reused for SMS via Bearer token if user supplies one as `secretKey`).
 *
 * Operations covered (subset of email + sms resources):
 *   - email.send        POST /v3.1/send                 (Basic auth)
 *   - email.sendTemplate POST /v3.1/send                (with TemplateID)
 *   - sms.send          POST /v4/sms-send               (Bearer token via `secretKey`)
 *
 * Out of scope for the first port:
 *   - Contact list management, segments, statistics
 *   - Attachments (binary pipes)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.mailjet.com';

type MailjetCred = { apiKey: string; secretKey: string };

function getCred(ctx: ForgeActionContext): MailjetCred {
  const cred = requireCredential('Mailjet', ctx.credential);
  const apiKey = cred.apiKey ?? '';
  const secretKey = cred.secretKey ?? '';
  if (!apiKey) throw new Error('Mailjet: credential is missing `apiKey`');
  if (!secretKey) throw new Error('Mailjet: credential is missing `secretKey`');
  return { apiKey, secretKey };
}

function basicHeader(c: MailjetCred): Record<string, string> {
  return { Authorization: `Basic ${btoa(`${c.apiKey}:${c.secretKey}`)}` };
}

function bearerHeader(c: MailjetCred): Record<string, string> {
  return { Authorization: `Bearer ${c.secretKey}` };
}

function parseRecipients(s: string): Array<{ Email: string; Name?: string }> {
  return s.split(',').map((p) => p.trim()).filter(Boolean).map((email) => ({ Email: email }));
}

async function emailSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const from = asString(ctx.options.fromEmail);
  const to = asString(ctx.options.toEmail);
  const subject = asString(ctx.options.subject);
  const text = asString(ctx.options.text);
  const html = asString(ctx.options.html);
  if (!from) throw new Error('Mailjet: fromEmail is required');
  if (!to) throw new Error('Mailjet: toEmail is required');
  if (!subject) throw new Error('Mailjet: subject is required');

  const message: Record<string, unknown> = {
    From: { Email: from },
    To: parseRecipients(to),
    Subject: subject,
  };
  const cc = asString(ctx.options.ccEmail);
  const bcc = asString(ctx.options.bccEmail);
  if (cc) message.Cc = parseRecipients(cc);
  if (bcc) message.Bcc = parseRecipients(bcc);
  if (text) message.TextPart = text;
  if (html) message.HTMLPart = html;

  const res = await apiRequest({
    service: 'Mailjet',
    method: 'POST',
    url: `${BASE}/v3.1/send`,
    headers: basicHeader(cred),
    json: { Messages: [message] },
  });
  return { outputs: { result: res.data }, logs: [`Mailjet email send → ${to}`] };
}

async function emailSendTemplate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const from = asString(ctx.options.fromEmail);
  const to = asString(ctx.options.toEmail);
  const templateId = asString(ctx.options.templateId);
  const variablesRaw = asString(ctx.options.variables);
  if (!from) throw new Error('Mailjet: fromEmail is required');
  if (!to) throw new Error('Mailjet: toEmail is required');
  if (!templateId) throw new Error('Mailjet: templateId is required');

  let variables: Record<string, unknown> | undefined;
  if (variablesRaw) {
    try {
      variables = JSON.parse(variablesRaw);
    } catch {
      throw new Error('Mailjet: variables must be valid JSON');
    }
  }

  const message: Record<string, unknown> = {
    From: { Email: from },
    To: parseRecipients(to),
    TemplateID: Number(templateId),
    TemplateLanguage: true,
  };
  if (variables) message.Variables = variables;
  const subject = asString(ctx.options.subject);
  if (subject) message.Subject = subject;

  const res = await apiRequest({
    service: 'Mailjet',
    method: 'POST',
    url: `${BASE}/v3.1/send`,
    headers: basicHeader(cred),
    json: { Messages: [message] },
  });
  return { outputs: { result: res.data }, logs: [`Mailjet template send → ${to}`] };
}

async function smsSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const text = asString(ctx.options.text);
  if (!from) throw new Error('Mailjet: from is required');
  if (!to) throw new Error('Mailjet: to is required');
  if (!text) throw new Error('Mailjet: text is required');
  const res = await apiRequest({
    service: 'Mailjet',
    method: 'POST',
    url: `${BASE}/v4/sms-send`,
    headers: bearerHeader(cred),
    json: { From: from, To: to, Text: text },
  });
  return { outputs: { result: res.data }, logs: [`Mailjet sms → ${to}`] };
}

const block: ForgeBlock = {
  id: 'forge_mailjet',
  name: 'Mailjet',
  description: 'Send email and SMS via Mailjet.',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mailjet' },
  actions: [
    {
      id: 'email_send',
      label: 'Send email',
      description: 'Send a transactional email via Mailjet v3.1.',
      fields: [
        { id: 'fromEmail', label: 'From email', type: 'text', required: true },
        { id: 'toEmail', label: 'To email (comma separated)', type: 'text', required: true },
        { id: 'ccEmail', label: 'Cc email (comma separated)', type: 'text' },
        { id: 'bccEmail', label: 'Bcc email (comma separated)', type: 'text' },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'text', label: 'Plain text body', type: 'textarea' },
        { id: 'html', label: 'HTML body', type: 'textarea' },
      ],
      run: emailSend,
    },
    {
      id: 'email_send_template',
      label: 'Send templated email',
      description: 'Send a templated email by ID with variable substitution.',
      fields: [
        { id: 'fromEmail', label: 'From email', type: 'text', required: true },
        { id: 'toEmail', label: 'To email (comma separated)', type: 'text', required: true },
        { id: 'templateId', label: 'Template ID', type: 'text', required: true },
        { id: 'subject', label: 'Subject override', type: 'text' },
        { id: 'variables', label: 'Variables (JSON)', type: 'json' },
      ],
      run: emailSendTemplate,
    },
    {
      id: 'sms_send',
      label: 'Send SMS',
      description: 'Send an SMS via Mailjet v4 (Bearer token in `secretKey`).',
      fields: [
        { id: 'from', label: 'Sender (alpha or number)', type: 'text', required: true },
        { id: 'to', label: 'Recipient (E.164)', type: 'text', required: true },
        { id: 'text', label: 'Message', type: 'textarea', required: true },
      ],
      run: smsSend,
    },
  ],
};

registerForgeBlock(block);
export default block;
