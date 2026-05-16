/**
 * Forge block: MessageBird
 *
 * Source: n8n-master/packages/nodes-base/nodes/MessageBird/MessageBird.node.ts
 * Credential type: 'messagebird' — { accessKey } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered:
 *   - sms.send       POST  https://rest.messagebird.com/messages
 *   - balance.get    GET   https://rest.messagebird.com/balance
 *   - hlr.lookup     POST  https://rest.messagebird.com/hlr  (carrier lookup)
 *
 * Only `sms:send` and `balance:get` exist in the original n8n node; `hlr` is
 * added so the SabFlow port meets the 3-action minimum from the migration plan.
 *
 * Out of scope for the first port:
 *   - Voice/Conversation/Verify APIs (separate MessageBird products)
 *   - Group routing and scheduledDatetime UI (single SMS only)
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const MB_BASE = 'https://rest.messagebird.com';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('MessageBird', ctx.credential);
  const key = cred.accessKey ?? cred.apiKey;
  if (!key) throw new Error('MessageBird: credential missing `accessKey`');
  return { Authorization: `AccessKey ${key}` };
}

async function mb(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST',
  endpoint: string,
  body?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'MessageBird',
    method,
    url: `${MB_BASE}${endpoint}`,
    headers: authHeader(ctx),
    json: body,
  });
  return res.data;
}

async function smsSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const originator = asString(ctx.options.originator);
  const recipientsRaw = asString(ctx.options.recipients);
  const body = asString(ctx.options.body);
  if (!originator) throw new Error('MessageBird: originator is required');
  if (!recipientsRaw) throw new Error('MessageBird: recipients are required');
  if (!body) throw new Error('MessageBird: body is required');

  const recipients = recipientsRaw
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  const reference = asString(ctx.options.reference);
  const datacoding = asString(ctx.options.datacoding);
  const payload: Record<string, unknown> = { originator, recipients, body };
  if (reference) payload.reference = reference;
  if (datacoding) payload.datacoding = datacoding;

  const result = await mb(ctx, 'POST', '/messages', payload);
  return { outputs: { result }, logs: [`MessageBird sms → ${recipients.length} recipient(s)`] };
}

async function balanceGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const result = await mb(ctx, 'GET', '/balance');
  return { outputs: { balance: result }, logs: ['MessageBird balance'] };
}

async function hlrLookup(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const msisdn = asString(ctx.options.msisdn);
  if (!msisdn) throw new Error('MessageBird: msisdn is required');
  const reference = asString(ctx.options.reference);
  const payload: Record<string, unknown> = { msisdn };
  if (reference) payload.reference = reference;
  const result = await mb(ctx, 'POST', '/hlr', payload);
  return { outputs: { result }, logs: [`MessageBird hlr → ${msisdn}`] };
}

const block: ForgeBlock = {
  id: 'forge_messagebird',
  name: 'MessageBird',
  description: 'Send SMS, look up phone carriers and check balance via MessageBird.',
  iconName: 'LuPhone',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'messagebird' },
  actions: [
    {
      id: 'sms_send',
      label: 'Send SMS',
      description: 'Send a text message to one or more recipients.',
      fields: [
        { id: 'originator', label: 'From (originator)', type: 'text', required: true, placeholder: '14155238886' },
        {
          id: 'recipients',
          label: 'To (comma-separated)',
          type: 'text',
          required: true,
          placeholder: '14155238886,14155238887',
        },
        { id: 'body', label: 'Message', type: 'textarea', required: true },
        { id: 'reference', label: 'Client reference', type: 'text' },
        {
          id: 'datacoding',
          label: 'Datacoding',
          type: 'select',
          options: [
            { label: 'Auto', value: '' },
            { label: 'Plain', value: 'plain' },
            { label: 'Unicode', value: 'unicode' },
          ],
        },
      ],
      run: smsSend,
    },
    {
      id: 'balance_get',
      label: 'Get account balance',
      description: 'Fetch the current MessageBird account balance.',
      fields: [],
      run: balanceGet,
    },
    {
      id: 'hlr_lookup',
      label: 'HLR carrier lookup',
      description: 'Look up the carrier for a phone number.',
      fields: [
        { id: 'msisdn', label: 'Phone number', type: 'text', required: true, placeholder: '14155238886' },
        { id: 'reference', label: 'Client reference', type: 'text' },
      ],
      run: hlrLookup,
    },
  ],
};

registerForgeBlock(block);
export default block;
