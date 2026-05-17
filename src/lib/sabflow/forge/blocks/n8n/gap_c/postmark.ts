/**
 * Forge block: Postmark
 *
 * `https://api.postmarkapp.com` — transactional email send + batch send.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.postmarkapp.com';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.serverToken);
  if (!token) throw new Error('Postmark: serverToken is required');
  return {
    'X-Postmark-Server-Token': token,
    Accept: 'application/json',
  };
}

async function sendEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const subject = asString(ctx.options.subject);
  const htmlBody = asString(ctx.options.htmlBody);
  const textBody = asString(ctx.options.textBody);
  const stream = asString(ctx.options.messageStream) || 'outbound';
  if (!from || !to || !subject) {
    throw new Error('Postmark: from, to and subject are required');
  }
  const body: Record<string, unknown> = {
    From: from,
    To: to,
    Subject: subject,
    MessageStream: stream,
  };
  if (htmlBody) body.HtmlBody = htmlBody;
  if (textBody) body.TextBody = textBody;
  const res = await apiRequest({
    service: 'Postmark',
    method: 'POST',
    url: `${API}/email`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Postmark send → ${to}`] };
}

async function sendWithTemplate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const templateId = asString(ctx.options.templateId);
  const templateAlias = asString(ctx.options.templateAlias);
  const modelRaw = asString(ctx.options.templateModelJson);
  const stream = asString(ctx.options.messageStream) || 'outbound';
  if (!from || !to || (!templateId && !templateAlias)) {
    throw new Error('Postmark: from, to and templateId/templateAlias are required');
  }
  let model: unknown = {};
  if (modelRaw) {
    try {
      model = JSON.parse(modelRaw);
    } catch {
      throw new Error('Postmark: templateModelJson must be valid JSON');
    }
  }
  const body: Record<string, unknown> = {
    From: from,
    To: to,
    MessageStream: stream,
    TemplateModel: model,
  };
  if (templateId) body.TemplateId = Number(templateId);
  if (templateAlias) body.TemplateAlias = templateAlias;
  const res = await apiRequest({
    service: 'Postmark',
    method: 'POST',
    url: `${API}/email/withTemplate`,
    headers: authHeaders(ctx),
    json: body,
  });
  return {
    outputs: { result: res.data },
    logs: [`Postmark template send → ${to}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_postmark',
  name: 'Postmark',
  description: 'Send transactional emails via Postmark.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send_email',
      label: 'Send email',
      fields: [
        { id: 'serverToken', label: 'Server token', type: 'password', required: true },
        { id: 'from', label: 'From', type: 'text', required: true },
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'htmlBody', label: 'HTML body', type: 'textarea' },
        { id: 'textBody', label: 'Text body', type: 'textarea' },
        { id: 'messageStream', label: 'Message stream', type: 'text', defaultValue: 'outbound' },
      ],
      run: sendEmail,
    },
    {
      id: 'send_with_template',
      label: 'Send with template',
      fields: [
        { id: 'serverToken', label: 'Server token', type: 'password', required: true },
        { id: 'from', label: 'From', type: 'text', required: true },
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'templateId', label: 'Template ID', type: 'text' },
        { id: 'templateAlias', label: 'Template alias', type: 'text' },
        { id: 'templateModelJson', label: 'Template model (JSON)', type: 'json' },
        { id: 'messageStream', label: 'Message stream', type: 'text', defaultValue: 'outbound' },
      ],
      run: sendWithTemplate,
    },
  ],
};

registerForgeBlock(block);
export default block;
