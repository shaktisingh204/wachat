/**
 * Forge block: SendGrid.
 *
 * Auth: API key (Bearer).
 * Actions: Send transactional email.
 */

import { registerForgeBlock } from '../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../types';

const SENDGRID_API = 'https://api.sendgrid.com/v3';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

type Recipient = { email: string };

const parseRecipients = (raw: unknown): Recipient[] => {
  if (Array.isArray(raw)) {
    return raw
      .filter((v): v is string => typeof v === 'string')
      .map((email) => ({ email: email.trim() }))
      .filter((r) => r.email.length > 0);
  }
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((email) => ({ email }));
};

async function sendEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? str(ctx.options.apiKey);
  const fromEmail = str(ctx.options.fromEmail);
  const fromName = str(ctx.options.fromName);
  const subject = str(ctx.options.subject);
  const bodyText = str(ctx.options.bodyText);
  const bodyHtml = str(ctx.options.bodyHtml);
  const isHtml = Boolean(ctx.options.isHtml);

  const to = parseRecipients(ctx.options.to);
  if (to.length === 0) throw new Error('SendGrid: at least one recipient is required');

  const content = isHtml
    ? [{ type: 'text/html', value: bodyHtml || bodyText }]
    : [{ type: 'text/plain', value: bodyText }];

  const payload: Record<string, unknown> = {
    personalizations: [{ to }],
    from: fromName ? { email: fromEmail, name: fromName } : { email: fromEmail },
    subject,
    content,
  };

  const res = await fetch(`${SENDGRID_API}/mail/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendGrid send failed: ${res.status} ${text}`);
  }

  return { logs: [`SendGrid: email sent to ${to.map((r) => r.email).join(', ')}`] };
}

const block: ForgeBlock = {
  id: 'forge_sendgrid',
  name: 'SendGrid',
  description: 'Send transactional email through SendGrid.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    fields: [
      {
        id: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'SG.…',
        required: true,
      },
    ],
  },
  actions: [
    {
      id: 'send_email',
      label: 'Send Email',
      description: 'Send a transactional email via the SendGrid v3 API.',
      fields: [
        {
          id: 'fromEmail',
          label: 'From Email',
          type: 'text',
          placeholder: 'no-reply@example.com',
          required: true,
        },
        { id: 'fromName', label: 'From Name', type: 'text', placeholder: 'My App' },
        {
          id: 'to',
          label: 'To',
          type: 'text',
          placeholder: 'user@example.com, another@example.com',
          helperText: 'Comma-separated list of recipients. Supports {{variables}}.',
          required: true,
        },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        {
          id: 'isHtml',
          label: 'Send as HTML',
          type: 'toggle',
          defaultValue: false,
        },
        {
          id: 'bodyText',
          label: 'Plain-text Body',
          type: 'textarea',
          showIf: { field: 'isHtml', equals: false },
        },
        {
          id: 'bodyHtml',
          label: 'HTML Body',
          type: 'code',
          placeholder: '<p>Hello {{name}}</p>',
          showIf: { field: 'isHtml', equals: true },
        },
      ],
      run: sendEmail,
    },
  ],
};

registerForgeBlock(block);

export default block;
