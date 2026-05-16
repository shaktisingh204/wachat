/**
 * Forge block: Send Email (SMTP)
 *
 * Source: n8n-master/packages/nodes-base/nodes/EmailSend/EmailSend.node.ts
 *
 * Uses nodemailer to dispatch an email via an inline SMTP server config.
 * All credentials (host, port, user, password) are inline password fields.
 *
 * Operations covered:
 *   - send-email   transports({...}).sendMail({ from, to, subject, text, html })
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asBoolean, asNumber, asString } from '../_shared/http';

type NodemailerLike = {
  createTransport: (opts: unknown) => {
    sendMail: (msg: unknown) => Promise<{ messageId?: string; response?: string }>;
  };
};

async function sendEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const host = asString(ctx.options.host);
  const port = asNumber(ctx.options.port) ?? 587;
  const user = asString(ctx.options.user);
  const password = asString(ctx.options.password);
  const secure = asBoolean(ctx.options.secure);
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const subject = asString(ctx.options.subject);
  const text = asString(ctx.options.text);
  const html = asString(ctx.options.html);

  if (!host) throw new Error('Send Email: host is required');
  if (!from) throw new Error('Send Email: from is required');
  if (!to) throw new Error('Send Email: to is required');
  if (!subject) throw new Error('Send Email: subject is required');

  let nodemailer: NodemailerLike;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nodemailer = require('nodemailer') as NodemailerLike;
  } catch {
    throw new Error(
      'Send Email: nodemailer is not installed in the runtime. Add "nodemailer" to dependencies.',
    );
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user || password ? { user, pass: password } : undefined,
  });

  const result = await transport.sendMail({
    from,
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
  });

  return {
    outputs: {
      messageId: result.messageId ?? null,
      response: result.response ?? null,
    },
    logs: [`Send Email → ${to} (${subject})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_send_email_n8n',
  name: 'Send Email (SMTP)',
  description: 'Send an email via an inline SMTP server using nodemailer.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send_email',
      label: 'Send email',
      description: 'Send an email via SMTP.',
      fields: [
        { id: 'host', label: 'SMTP host', type: 'text', required: true, placeholder: 'smtp.example.com' },
        { id: 'port', label: 'SMTP port', type: 'number', defaultValue: 587 },
        { id: 'secure', label: 'Secure (TLS)', type: 'toggle' },
        { id: 'user', label: 'SMTP user', type: 'password' },
        { id: 'password', label: 'SMTP password', type: 'password' },
        { id: 'from', label: 'From', type: 'text', required: true },
        { id: 'to', label: 'To (comma-separated)', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'text', label: 'Text body', type: 'textarea' },
        { id: 'html', label: 'HTML body', type: 'textarea' },
      ],
      run: sendEmail,
    },
  ],
};

registerForgeBlock(block);
export default block;
