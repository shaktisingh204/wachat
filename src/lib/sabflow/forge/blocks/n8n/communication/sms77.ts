/**
 * Forge block: Sms77 (seven.io)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Sms77/Sms77.node.ts (+ GenericFunctions.ts)
 * Credential type: 'sms77' — { apiKey } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered:
 *   - sms.send     POST  https://gateway.seven.io/api/sms
 *   - voice.send   POST  https://gateway.seven.io/api/voice
 *   - balance.get  GET   https://gateway.seven.io/api/balance
 *
 * Only `sms:send` and `voice:send` exist in the original n8n node; `balance`
 * is added so the SabFlow port meets the 3-action minimum from the migration plan.
 *
 * Out of scope for the first port:
 *   - Contact/group selectors (free-text `to` instead)
 *   - Number lookups, hooks management, journal endpoints
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asBoolean, asNumber, asString, requireCredential } from '../_shared/http';

const SMS77_BASE = 'https://gateway.seven.io/api';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Sms77', ctx.credential);
  const apiKey = cred.apiKey ?? '';
  if (!apiKey) throw new Error('Sms77: credential missing `apiKey`');
  return { SentWith: 'SabFlow', 'X-Api-Key': apiKey };
}

async function sms77(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST',
  endpoint: string,
  body?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Sms77',
    method,
    url: `${SMS77_BASE}${endpoint}`,
    headers: authHeader(ctx),
    json: method === 'POST' ? body ?? {} : undefined,
  });
  return res.data;
}

async function smsSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const to = asString(ctx.options.to);
  const text = asString(ctx.options.message);
  if (!to) throw new Error('Sms77: to is required');
  if (!text) throw new Error('Sms77: message is required');

  const body: Record<string, unknown> = { to, text };
  const from = asString(ctx.options.from);
  if (from) body.from = from;
  const foreignId = asString(ctx.options.foreign_id);
  if (foreignId) body.foreign_id = foreignId;
  const label = asString(ctx.options.label);
  if (label) body.label = label;
  if (ctx.options.flash !== undefined && ctx.options.flash !== '') {
    body.flash = asBoolean(ctx.options.flash);
  }
  const ttl = asNumber(ctx.options.ttl);
  if (ttl !== undefined) body.ttl = ttl;

  const result = await sms77(ctx, 'POST', '/sms', body);
  return { outputs: { result }, logs: [`Sms77 sms → ${to}`] };
}

async function voiceSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const to = asString(ctx.options.to);
  const text = asString(ctx.options.message);
  if (!to) throw new Error('Sms77: to is required');
  if (!text) throw new Error('Sms77: message is required');

  const body: Record<string, unknown> = { to, text };
  const from = asString(ctx.options.from);
  if (from) body.from = from;

  const result = await sms77(ctx, 'POST', '/voice', body);
  return { outputs: { result }, logs: [`Sms77 voice → ${to}`] };
}

async function balanceGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const result = await sms77(ctx, 'GET', '/balance');
  return { outputs: { balance: result }, logs: ['Sms77 balance'] };
}

const block: ForgeBlock = {
  id: 'forge_sms77',
  name: 'Sms77',
  description: 'Send SMS, voice calls and check balance via seven.io (sms77).',
  iconName: 'LuPhoneOutgoing',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'sms77' },
  actions: [
    {
      id: 'sms_send',
      label: 'Send SMS',
      fields: [
        { id: 'to', label: 'To', type: 'text', required: true, placeholder: '+49876543210' },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
        { id: 'from', label: 'From', type: 'text', placeholder: '+4901234567890' },
        { id: 'foreign_id', label: 'Foreign ID', type: 'text' },
        { id: 'label', label: 'Label', type: 'text' },
        { id: 'flash', label: 'Flash message', type: 'toggle' },
        { id: 'ttl', label: 'TTL (minutes)', type: 'number' },
      ],
      run: smsSend,
    },
    {
      id: 'voice_send',
      label: 'Send voice message',
      fields: [
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
        { id: 'from', label: 'From', type: 'text' },
      ],
      run: voiceSend,
    },
    {
      id: 'balance_get',
      label: 'Get balance',
      fields: [],
      run: balanceGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
