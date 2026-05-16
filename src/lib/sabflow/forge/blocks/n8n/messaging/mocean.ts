/**
 * Forge block: Mocean
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mocean/Mocean.node.ts
 *
 * API key + secret transmitted as form params on every call.
 *
 * Operations covered:
 *   - sms.send      POST  /rest/2/sms
 *   - voice.dial    POST  /rest/2/voice/dial
 *   - balance.get   GET   /rest/2/account/balance
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://rest.moceanapi.com';

function creds(ctx: ForgeActionContext): { apiKey: string; apiSecret: string } {
  const apiKey = asString(ctx.options.apiKey);
  const apiSecret = asString(ctx.options.apiSecret);
  if (!apiKey) throw new Error('Mocean: apiKey is required');
  if (!apiSecret) throw new Error('Mocean: apiSecret is required');
  return { apiKey, apiSecret };
}

function toForm(body: Record<string, string>): string {
  return Object.entries(body)
    .filter(([, v]) => v !== '' && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function smsSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = creds(ctx);
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const text = asString(ctx.options.message);
  if (!from) throw new Error('Mocean: from is required');
  if (!to) throw new Error('Mocean: to is required');
  if (!text) throw new Error('Mocean: message is required');
  const body: Record<string, string> = {
    'mocean-api-key': c.apiKey,
    'mocean-api-secret': c.apiSecret,
    'mocean-resp-format': 'JSON',
    'mocean-from': from,
    'mocean-to': to,
    'mocean-text': text,
  };
  const dlr = asString(ctx.options.dlrUrl);
  if (dlr) {
    body['mocean-dlr-url'] = dlr;
    body['mocean-dlr-mask'] = '1';
  }
  const res = await apiRequest({
    service: 'Mocean',
    method: 'POST',
    url: `${API}/rest/2/sms`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: toForm(body),
  });
  return { outputs: { result: res.data }, logs: [`Mocean sms → ${to}`] };
}

async function voiceDial(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = creds(ctx);
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const text = asString(ctx.options.message);
  const language = asString(ctx.options.language) || 'en-US';
  if (!from) throw new Error('Mocean: from is required');
  if (!to) throw new Error('Mocean: to is required');
  if (!text) throw new Error('Mocean: message is required');
  const command = [{ action: 'say', language, text }];
  const body: Record<string, string> = {
    'mocean-api-key': c.apiKey,
    'mocean-api-secret': c.apiSecret,
    'mocean-resp-format': 'JSON',
    'mocean-from': from,
    'mocean-to': to,
    'mocean-command': JSON.stringify(command),
  };
  const res = await apiRequest({
    service: 'Mocean',
    method: 'POST',
    url: `${API}/rest/2/voice/dial`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: toForm(body),
  });
  return { outputs: { result: res.data }, logs: [`Mocean voice → ${to}`] };
}

async function balanceGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = creds(ctx);
  const params = new URLSearchParams({
    'mocean-api-key': c.apiKey,
    'mocean-api-secret': c.apiSecret,
    'mocean-resp-format': 'JSON',
  });
  const res = await apiRequest({
    service: 'Mocean',
    method: 'GET',
    url: `${API}/rest/2/account/balance?${params.toString()}`,
  });
  return { outputs: { balance: res.data }, logs: ['Mocean balance'] };
}

const block: ForgeBlock = {
  id: 'forge_mocean',
  name: 'Mocean',
  description: 'Send SMS, place voice calls and check balance via Mocean.',
  iconName: 'LuPhoneOutgoing',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'sms_send',
      label: 'Send SMS',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'apiSecret', label: 'API secret', type: 'password', required: true },
        { id: 'from', label: 'From', type: 'text', required: true },
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
        { id: 'dlrUrl', label: 'Delivery report URL', type: 'text' },
      ],
      run: smsSend,
    },
    {
      id: 'voice_dial',
      label: 'Send voice call',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'apiSecret', label: 'API secret', type: 'password', required: true },
        { id: 'from', label: 'From', type: 'text', required: true },
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
        { id: 'language', label: 'Language', type: 'select', defaultValue: 'en-US', options: [
          { label: 'English (US)', value: 'en-US' },
          { label: 'English (UK)', value: 'en-GB' },
          { label: 'Chinese (CN)', value: 'cmn-CN' },
          { label: 'Japanese', value: 'ja-JP' },
          { label: 'Korean', value: 'ko-KR' },
        ] },
      ],
      run: voiceDial,
    },
    {
      id: 'balance_get',
      label: 'Get balance',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'apiSecret', label: 'API secret', type: 'password', required: true },
      ],
      run: balanceGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
