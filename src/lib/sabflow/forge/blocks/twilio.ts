/**
 * Forge block: Twilio.
 *
 * Auth: Account SID + Auth token (HTTP Basic).
 * Actions: Send SMS.
 */

import { registerForgeBlock } from '../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../types';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const basicAuth = (user: string, pass: string): string => {
  // Works in both Node.js and Edge runtimes.
  const payload = `${user}:${pass}`;
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(payload, 'utf-8').toString('base64');
  }
  // Fallback: btoa is available in Edge/Browser.
  return btoa(unescape(encodeURIComponent(payload)));
};

async function sendSms(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accountSid = ctx.credential?.accountSid ?? str(ctx.options.accountSid);
  const authToken = ctx.credential?.authToken ?? str(ctx.options.authToken);
  const from = str(ctx.options.from);
  const to = str(ctx.options.to);
  const body = str(ctx.options.body);
  const outputVariable = str(ctx.options.outputVariable);

  const form = new URLSearchParams();
  form.set('From', from);
  form.set('To', to);
  form.set('Body', body);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth(accountSid, authToken)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    },
  );
  const data: unknown = await res.json();
  if (!res.ok) throw new Error(`Twilio send SMS failed: ${res.status}`);

  const outputs: Record<string, unknown> = {};
  if (outputVariable) outputs[outputVariable] = data;
  return { outputs, logs: [`Twilio: SMS sent to ${to}`] };
}

const block: ForgeBlock = {
  id: 'forge_twilio',
  name: 'Twilio',
  description: 'Send SMS messages via the Twilio Programmable Messaging API.',
  iconName: 'LuPhone',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    fields: [
      {
        id: 'accountSid',
        label: 'Account SID',
        type: 'text',
        placeholder: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        required: true,
      },
      {
        id: 'authToken',
        label: 'Auth Token',
        type: 'password',
        required: true,
      },
    ],
  },
  actions: [
    {
      id: 'send_sms',
      label: 'Send SMS',
      description: 'Send a text message from a Twilio phone number.',
      fields: [
        {
          id: 'from',
          label: 'From Number',
          type: 'text',
          placeholder: '+15551234567',
          required: true,
          helperText: 'E.164 formatted Twilio phone number.',
        },
        {
          id: 'to',
          label: 'To Number',
          type: 'text',
          placeholder: '+15557654321 or {{phone}}',
          required: true,
        },
        { id: 'body', label: 'Message', type: 'textarea', required: true },
        { id: 'outputVariable', label: 'Save response to variable', type: 'variable' },
      ],
      run: sendSms,
    },
  ],
};

registerForgeBlock(block);

export default block;
