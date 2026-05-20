/**
 * Forge block: Mandrill
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mandrill/Mandrill.node.ts (906 LOC)
 * Credential type: 'mandrill' (apiKey)
 *
 * Operations covered (message subset — Mandrill's only resource here):
 *   - message.send           POST /api/1.0/messages/send.json
 *   - message.sendTemplate   POST /api/1.0/messages/send-template.json
 *   - template.list          POST /api/1.0/templates/list.json
 *   - template.info          POST /api/1.0/templates/info.json
 *
 * Send/sendTemplate accept JSON-array attachments + JSON headers (parity with
 * n8n's `attachmentsJson` and `headersJson` options).
 *
 * Out of scope for the first port:
 *   - Binary-property attachments (would require engine-level binary refs we
 *     don't expose through ForgeActionContext)
 *   - LoadOptions for template dropdown — sabflow forge supports loadOptions,
 *     but Mandrill's template list is a POST not a GET so it doesn't fit the
 *     simple loader contract; flow authors enter the template name directly.
 *   - Sub-account, webhook, tag analytics ops — distinct resources that
 *     belong in their own ports.
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

  const attachmentsRaw = asString(ctx.options.attachments);
  if (attachmentsRaw) {
    try {
      const parsed = JSON.parse(attachmentsRaw);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      message.attachments = parsed;
    } catch (err) {
      throw new Error(`Mandrill: attachments must be a JSON array — ${(err as Error).message}`);
    }
  }

  const headersRaw = asString(ctx.options.headers);
  if (headersRaw) {
    try {
      const parsed = JSON.parse(headersRaw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not an object');
      }
      message.headers = parsed;
    } catch (err) {
      throw new Error(`Mandrill: headers must be a JSON object — ${(err as Error).message}`);
    }
  }
  return message;
}

async function templateList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = getApiKey(ctx);
  const label = asString(ctx.options.label);
  const body: Record<string, unknown> = { key };
  if (label) body.label = label;
  const res = await apiRequest({
    service: 'Mandrill',
    method: 'POST',
    url: `${BASE}/templates/list.json`,
    json: body,
  });
  const items = Array.isArray(res.data) ? res.data : [];
  return { outputs: { templates: items, count: items.length }, logs: [`Mandrill template list → ${items.length}`] };
}

async function templateInfo(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = getApiKey(ctx);
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Mandrill: name is required');
  const res = await apiRequest({
    service: 'Mandrill',
    method: 'POST',
    url: `${BASE}/templates/info.json`,
    json: { key, name },
  });
  return { outputs: { template: res.data }, logs: [`Mandrill template info → ${name}`] };
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
  {
    id: 'attachments',
    label: 'Attachments (JSON array of {type,name,content-base64})',
    type: 'json' as const,
  },
  {
    id: 'headers',
    label: 'Custom headers (JSON object, e.g. { "Reply-To": "x@y.com" })',
    type: 'json' as const,
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
    {
      id: 'template_list',
      label: 'List templates',
      description: 'Return all stored templates, optionally filtered by label.',
      fields: [{ id: 'label', label: 'Label filter (optional)', type: 'text' }],
      run: templateList,
    },
    {
      id: 'template_info',
      label: 'Get template info',
      description: 'Return the stored template object by name (slug).',
      fields: [{ id: 'name', label: 'Template name (slug)', type: 'text', required: true }],
      run: templateInfo,
    },
  ],
};

registerForgeBlock(block);
export default block;
