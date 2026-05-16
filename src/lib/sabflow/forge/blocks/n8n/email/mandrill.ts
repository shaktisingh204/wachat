/**
 * Forge block: Mandrill
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mandrill/Mandrill.node.ts (906 LOC)
 * Credential type: 'mandrill' (apiKey)
 *
 * Operations covered (message subset — Mandrill's only resource here):
 *   - message.send           POST /api/1.0/messages/send.json
 *   - message.sendTemplate   POST /api/1.0/messages/send-template.json
 *
 * Out of scope for the first port:
 *   - Attachments (binary)
 *   - LoadOptions for template dropdown
 *   - Sub-account, webhook, tag analytics ops
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://mandrillapp.com/api/1.0';

function getApiKey(ctx: ForgeActionContext): string {
  const cred = requireCredential('Mandrill', ctx.credential);
  const apiKey = cred.apiKey ?? '';
  if (!apiKey) throw new Error('Mandrill: credential is missing `apiKey`');
  return apiKey;
}

function buildRecipients(to: string): Array<{ email: string; type: 'to' }> {
  return to.split(',').map((s) => s.trim()).filter(Boolean).map((email) => ({ email, type: 'to' as const }));
}

function buildMessage(ctx: ForgeActionContext): Record<string, unknown> {
  const from = asString(ctx.options.fromEmail);
  const fromName = asString(ctx.options.fromName);
  const to = asString(ctx.options.toEmail);
  const subject = asString(ctx.options.subject);
  const html = asString(ctx.options.html);
  const text = asString(ctx.options.text);
  if (!from) throw new Error('Mandrill: fromEmail is required');
  if (!to) throw new Error('Mandrill: toEmail is required');

  const message: Record<string, unknown> = {
    from_email: from,
    to: buildRecipients(to),
  };
  if (fromName) message.from_name = fromName;
  if (subject) message.subject = subject;
  if (html) message.html = html;
  if (text) message.text = text;
  const tagsRaw = asString(ctx.options.tags);
  if (tagsRaw) message.tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const trackOpens = asString(ctx.options.trackOpens);
  if (trackOpens) message.track_opens = trackOpens === 'true';
  const trackClicks = asString(ctx.options.trackClicks);
  if (trackClicks) message.track_clicks = trackClicks === 'true';
  return message;
}

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = getApiKey(ctx);
  const message = buildMessage(ctx);
  const subject = asString(ctx.options.subject);
  if (!subject) throw new Error('Mandrill: subject is required');
  const html = asString(ctx.options.html);
  const text = asString(ctx.options.text);
  if (!html && !text) throw new Error('Mandrill: html or text is required');

  const res = await apiRequest({
    service: 'Mandrill',
    method: 'POST',
    url: `${BASE}/messages/send.json`,
    json: { key, message, async: false },
  });
  return { outputs: { result: res.data }, logs: ['Mandrill message send'] };
}

async function messageSendTemplate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = getApiKey(ctx);
  const templateName = asString(ctx.options.templateName);
  if (!templateName) throw new Error('Mandrill: templateName is required');
  const message = buildMessage(ctx);

  const templateContentRaw = asString(ctx.options.templateContent);
  const mergeVarsRaw = asString(ctx.options.mergeVars);
  let templateContent: Array<{ name: string; content: string }> = [];
  if (templateContentRaw) {
    try {
      const parsed = JSON.parse(templateContentRaw);
      if (Array.isArray(parsed)) templateContent = parsed;
    } catch {
      throw new Error('Mandrill: templateContent must be a JSON array');
    }
  }
  if (mergeVarsRaw) {
    try {
      message.global_merge_vars = JSON.parse(mergeVarsRaw);
    } catch {
      throw new Error('Mandrill: mergeVars must be valid JSON');
    }
  }

  const res = await apiRequest({
    service: 'Mandrill',
    method: 'POST',
    url: `${BASE}/messages/send-template.json`,
    json: {
      key,
      template_name: templateName,
      template_content: templateContent,
      message,
      async: false,
    },
  });
  return { outputs: { result: res.data }, logs: [`Mandrill template send → ${templateName}`] };
}

const COMMON_FIELDS = [
  { id: 'fromEmail', label: 'From email', type: 'text' as const, required: true },
  { id: 'fromName', label: 'From name', type: 'text' as const },
  { id: 'toEmail', label: 'To email (comma separated)', type: 'text' as const, required: true },
  { id: 'subject', label: 'Subject', type: 'text' as const },
  { id: 'html', label: 'HTML body', type: 'textarea' as const },
  { id: 'text', label: 'Plain text body', type: 'textarea' as const },
  { id: 'tags', label: 'Tags (comma separated)', type: 'text' as const },
  {
    id: 'trackOpens',
    label: 'Track opens',
    type: 'select' as const,
    options: [
      { label: 'Default', value: '' },
      { label: 'On', value: 'true' },
      { label: 'Off', value: 'false' },
    ],
  },
  {
    id: 'trackClicks',
    label: 'Track clicks',
    type: 'select' as const,
    options: [
      { label: 'Default', value: '' },
      { label: 'On', value: 'true' },
      { label: 'Off', value: 'false' },
    ],
  },
];

const block: ForgeBlock = {
  id: 'forge_mandrill',
  name: 'Mandrill',
  description: 'Send raw or templated transactional email via Mandrill.',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mandrill' },
  actions: [
    {
      id: 'message_send',
      label: 'Send message',
      description: 'Send a raw transactional email.',
      fields: [...COMMON_FIELDS],
      run: messageSend,
    },
    {
      id: 'message_send_template',
      label: 'Send template',
      description: 'Send an email using a stored Mandrill template.',
      fields: [
        { id: 'templateName', label: 'Template name', type: 'text', required: true },
        ...COMMON_FIELDS,
        { id: 'templateContent', label: 'Template content (JSON array of {name,content})', type: 'json' },
        { id: 'mergeVars', label: 'Global merge vars (JSON array)', type: 'json' },
      ],
      run: messageSendTemplate,
    },
  ],
};

registerForgeBlock(block);
export default block;
