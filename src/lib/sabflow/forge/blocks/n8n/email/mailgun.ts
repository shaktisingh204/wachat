/**
 * Forge block: Mailgun
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mailgun/Mailgun.node.ts
 * Credential type: 'mailgun' (apiKey, domain, region)
 *
 * Operations covered:
 *   - message.send             POST   /v3/{domain}/messages   (form-encoded)
 *   - suppression.unsubscribes POST   /v3/{domain}/unsubscribes
 *   - suppression.list         GET    /v3/{domain}/{kind}     (kind: unsubscribes|bounces|complaints)
 *
 * Out of scope for the first port:
 *   - Binary attachments (multipart). The send action accepts text/html only.
 *   - Stored message retrieval, mailing list management, route lifecycle.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

type MailgunCred = { apiKey: string; domain: string; apiDomain: string };

function getCred(ctx: ForgeActionContext): MailgunCred {
  const cred = requireCredential('Mailgun', ctx.credential);
  const apiKey = cred.apiKey ?? '';
  const domain = cred.domain ?? '';
  const region = (cred.region ?? 'us').toLowerCase();
  if (!apiKey) throw new Error('Mailgun: credential is missing `apiKey`');
  if (!domain) throw new Error('Mailgun: credential is missing `domain`');
  const apiDomain = region === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
  return { apiKey, domain, apiDomain };
}

function authHeader(c: MailgunCred): Record<string, string> {
  const basic = btoa(`api:${c.apiKey}`);
  return { Authorization: `Basic ${basic}` };
}

function form(data: Record<string, string | string[] | undefined>): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    const values = Array.isArray(v) ? v : [v];
    for (const value of values) {
      out.push(`${encodeURIComponent(k)}=${encodeURIComponent(value)}`);
    }
  }
  return out.join('&');
}

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const from = asString(ctx.options.fromEmail);
  const to = asString(ctx.options.toEmail);
  const subject = asString(ctx.options.subject);
  const text = asString(ctx.options.text);
  const html = asString(ctx.options.html);
  const cc = asString(ctx.options.ccEmail);
  const bcc = asString(ctx.options.bccEmail);
  if (!from) throw new Error('Mailgun: fromEmail is required');
  if (!to) throw new Error('Mailgun: toEmail is required');
  if (!subject && !text && !html) throw new Error('Mailgun: provide subject/text/html');

  const data: Record<string, string | string[] | undefined> = {
    from,
    to: to.split(',').map((s) => s.trim()).filter(Boolean),
    subject: subject || undefined,
    text: text || undefined,
    html: html || undefined,
  };
  if (cc) data.cc = cc.split(',').map((s) => s.trim()).filter(Boolean);
  if (bcc) data.bcc = bcc.split(',').map((s) => s.trim()).filter(Boolean);

  const res = await apiRequest({
    service: 'Mailgun',
    method: 'POST',
    url: `https://${cred.apiDomain}/v3/${encodeURIComponent(cred.domain)}/messages`,
    headers: { ...authHeader(cred), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form(data),
  });
  return { outputs: { result: res.data }, logs: [`Mailgun send → ${to}`] };
}

async function suppressionAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const address = asString(ctx.options.address);
  const tag = asString(ctx.options.tag) || '*';
  if (!address) throw new Error('Mailgun: address is required');
  const res = await apiRequest({
    service: 'Mailgun',
    method: 'POST',
    url: `https://${cred.apiDomain}/v3/${encodeURIComponent(cred.domain)}/unsubscribes`,
    headers: { ...authHeader(cred), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ address, tag }),
  });
  return { outputs: { result: res.data }, logs: [`Mailgun suppress → ${address}`] };
}

async function suppressionList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const kind = asString(ctx.options.kind) || 'unsubscribes';
  if (!['unsubscribes', 'bounces', 'complaints'].includes(kind)) {
    throw new Error('Mailgun: kind must be unsubscribes|bounces|complaints');
  }
  const res = await apiRequest({
    service: 'Mailgun',
    method: 'GET',
    url: `https://${cred.apiDomain}/v3/${encodeURIComponent(cred.domain)}/${kind}`,
    headers: authHeader(cred),
  });
  return { outputs: { results: res.data }, logs: [`Mailgun list ${kind}`] };
}

const block: ForgeBlock = {
  id: 'forge_mailgun',
  name: 'Mailgun',
  description: 'Send email and manage suppressions via Mailgun.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mailgun' },
  actions: [
    {
      id: 'message_send',
      label: 'Send message',
      description: 'Send a transactional email (text/html, no attachments).',
      fields: [
        { id: 'fromEmail', label: 'From email', type: 'text', required: true, placeholder: 'Admin <admin@example.com>' },
        { id: 'toEmail', label: 'To email (comma separated)', type: 'text', required: true },
        { id: 'ccEmail', label: 'Cc email (comma separated)', type: 'text' },
        { id: 'bccEmail', label: 'Bcc email (comma separated)', type: 'text' },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'text', label: 'Plain text body', type: 'textarea' },
        { id: 'html', label: 'HTML body', type: 'textarea' },
      ],
      run: messageSend,
    },
    {
      id: 'suppression_add',
      label: 'Add suppression (unsubscribe)',
      description: 'Add an address to the unsubscribes list.',
      fields: [
        { id: 'address', label: 'Email address', type: 'text', required: true },
        { id: 'tag', label: 'Tag', type: 'text', defaultValue: '*' },
      ],
      run: suppressionAdd,
    },
    {
      id: 'suppression_list',
      label: 'List suppressions',
      description: 'List unsubscribes, bounces, or complaints.',
      fields: [
        {
          id: 'kind',
          label: 'Kind',
          type: 'select',
          defaultValue: 'unsubscribes',
          options: [
            { label: 'Unsubscribes', value: 'unsubscribes' },
            { label: 'Bounces', value: 'bounces' },
            { label: 'Complaints', value: 'complaints' },
          ],
        },
      ],
      run: suppressionList,
    },
  ],
};

registerForgeBlock(block);
export default block;
