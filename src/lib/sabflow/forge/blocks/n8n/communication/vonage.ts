/**
 * Forge block: Vonage (formerly Nexmo)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Vonage/Vonage.node.ts
 * Credential type: 'vonage' — { apiKey, apiSecret } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered:
 *   - sms.send         POST  https://rest.nexmo.com/sms/json
 *   - number.lookup    GET   https://api.nexmo.com/ni/standard/json
 *   - account.balance  GET   https://rest.nexmo.com/account/get-balance
 *
 * Only `sms:send` exists in the original n8n node; lookup + balance are
 * added so the SabFlow port meets the 3-action minimum from the migration plan.
 *
 * Out of scope for the first port:
 *   - Voice / Verify / Messages API v1 (require JWT app authentication)
 *   - Binary / WAP push / unicode message types
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const REST_BASE = 'https://rest.nexmo.com';
const API_BASE = 'https://api.nexmo.com';

function credsOrThrow(ctx: ForgeActionContext): { apiKey: string; apiSecret: string } {
  const cred = requireCredential('Vonage', ctx.credential);
  const apiKey = cred.apiKey ?? '';
  const apiSecret = cred.apiSecret ?? '';
  if (!apiKey) throw new Error('Vonage: credential missing `apiKey`');
  if (!apiSecret) throw new Error('Vonage: credential missing `apiSecret`');
  return { apiKey, apiSecret };
}

async function smsSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { apiKey, apiSecret } = credsOrThrow(ctx);
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const text = asString(ctx.options.text);
  if (!from) throw new Error('Vonage: from is required');
  if (!to) throw new Error('Vonage: to is required');
  if (!text) throw new Error('Vonage: text is required');

  const res = await apiRequest({
    service: 'Vonage',
    method: 'POST',
    url: `${REST_BASE}/sms/json`,
    json: { api_key: apiKey, api_secret: apiSecret, from, to, text },
  });
  const data = res.data as { messages?: Array<{ status: string; 'error-text'?: string }> };
  const failed = data?.messages?.find((m) => m.status && m.status !== '0');
  if (failed) {
    throw new Error(`Vonage sms failed: ${failed['error-text'] ?? `status ${failed.status}`}`);
  }
  return { outputs: { result: data }, logs: [`Vonage sms → ${to}`] };
}

async function numberLookup(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { apiKey, apiSecret } = credsOrThrow(ctx);
  const number = asString(ctx.options.number);
  if (!number) throw new Error('Vonage: number is required');
  const country = asString(ctx.options.country);

  const params = new URLSearchParams({
    api_key: apiKey,
    api_secret: apiSecret,
    number,
  });
  if (country) params.set('country', country);

  const res = await apiRequest({
    service: 'Vonage',
    method: 'GET',
    url: `${API_BASE}/ni/standard/json?${params.toString()}`,
  });
  return { outputs: { result: res.data }, logs: [`Vonage lookup → ${number}`] };
}

async function accountBalance(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { apiKey, apiSecret } = credsOrThrow(ctx);
  const params = new URLSearchParams({ api_key: apiKey, api_secret: apiSecret });
  const res = await apiRequest({
    service: 'Vonage',
    method: 'GET',
    url: `${REST_BASE}/account/get-balance?${params.toString()}`,
  });
  return { outputs: { balance: res.data }, logs: ['Vonage balance'] };
}

const block: ForgeBlock = {
  id: 'forge_vonage',
  name: 'Vonage',
  description: 'Send SMS, look up numbers and check balance with the Vonage (Nexmo) API.',
  iconName: 'LuSmartphone',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'vonage' },
  actions: [
    {
      id: 'sms_send',
      label: 'Send SMS',
      description: 'Send a text message.',
      fields: [
        { id: 'from', label: 'From', type: 'text', required: true, placeholder: '+15551234567' },
        { id: 'to', label: 'To', type: 'text', required: true, placeholder: '+15557654321' },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
      ],
      run: smsSend,
    },
    {
      id: 'number_lookup',
      label: 'Number insight',
      description: 'Standard number insight (carrier/country) for a phone number.',
      fields: [
        { id: 'number', label: 'Phone number', type: 'text', required: true },
        { id: 'country', label: 'Country (ISO-2)', type: 'text', placeholder: 'US' },
      ],
      run: numberLookup,
    },
    {
      id: 'account_balance',
      label: 'Get account balance',
      fields: [],
      run: accountBalance,
    },
  ],
};

registerForgeBlock(block);
export default block;
