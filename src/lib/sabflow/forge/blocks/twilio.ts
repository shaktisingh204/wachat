/**
 * Forge block: Twilio.
 *
 * Auth: routed through SabFlow Connections (credentialType `twilio`).
 *   credential.accountSid + credential.authToken → HTTP Basic auth.
 * Actions: Send SMS.
 */

import { registerForgeBlock } from '../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../types';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

async function sendSms(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accountSid = ctx.credential?.accountSid;
  const authToken = ctx.credential?.authToken;
  if (!accountSid || !authToken) {
    throw new Error('Twilio: select a credential from SabFlow Connections');
  }
  const from = str(ctx.options.from);
  const to = str(ctx.options.to);
  const body = str(ctx.options.body);
  const outputVariable = str(ctx.options.outputVariable);

  const form = new URLSearchParams();
  form.set('From', from);
  form.set('To', to);
  form.set('Body', body);

  // Twilio uses HTTP Basic with accountSid:authToken — `basic-custom` lets the
  // helper own the header construction and base64 encoding.
  const res = await ctx.helpers!.requestWithAuthentication('basic-custom', {
    method: 'POST',
    url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    userField: 'accountSid',
    passField: 'authToken',
  });
  if (!res.ok) throw new Error(`Twilio send SMS failed: ${res.status}`);

  const outputs: Record<string, unknown> = {};
  if (outputVariable) outputs[outputVariable] = res.data;
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
    credentialType: 'twilio',
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
