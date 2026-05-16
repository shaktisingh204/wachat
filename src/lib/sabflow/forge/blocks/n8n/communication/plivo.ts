/**
 * Forge block: Plivo
 *
 * Source: n8n-master/packages/nodes-base/nodes/Plivo/Plivo.node.ts (+ SmsDescription / CallDescription / MmsDescription)
 * Credential type: 'plivo' — { authId, authToken } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered:
 *   - sms.send    POST  /v1/Account/{authId}/Message/   (text)
 *   - mms.send    POST  /v1/Account/{authId}/Message/   (mms with media_urls)
 *   - call.make   POST  /v1/Account/{authId}/Call/
 *
 * Out of scope for the first port:
 *   - Number/Application/Endpoint resources, recording management
 *   - Sub-account auth, signature verification
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

type PlivoCred = { authId: string; authToken: string };

function credsOrThrow(ctx: ForgeActionContext): PlivoCred {
  const cred = requireCredential('Plivo', ctx.credential);
  const authId = cred.authId ?? '';
  const authToken = cred.authToken ?? '';
  if (!authId) throw new Error('Plivo: credential missing `authId`');
  if (!authToken) throw new Error('Plivo: credential missing `authToken`');
  return { authId, authToken };
}

async function plivo(
  ctx: ForgeActionContext,
  endpoint: 'Message' | 'Call',
  body: Record<string, unknown>,
): Promise<unknown> {
  const { authId, authToken } = credsOrThrow(ctx);
  const basic =
    typeof btoa === 'function'
      ? btoa(`${authId}:${authToken}`)
      : (globalThis as { Buffer?: { from: (s: string) => { toString: (e: string) => string } } })
          .Buffer!.from(`${authId}:${authToken}`)
          .toString('base64');
  const res = await apiRequest({
    service: 'Plivo',
    method: 'POST',
    url: `https://api.plivo.com/v1/Account/${encodeURIComponent(authId)}/${endpoint}/`,
    headers: { Authorization: `Basic ${basic}` },
    json: body,
  });
  return res.data;
}

async function smsSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const text = asString(ctx.options.text);
  if (!from) throw new Error('Plivo: from is required');
  if (!to) throw new Error('Plivo: to is required');
  if (!text) throw new Error('Plivo: text is required');

  const result = await plivo(ctx, 'Message', { src: from, dst: to, text });
  return { outputs: { result }, logs: [`Plivo sms → ${to}`] };
}

async function mmsSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const text = asString(ctx.options.text);
  const mediaUrls = asString(ctx.options.media_urls);
  if (!from) throw new Error('Plivo: from is required');
  if (!to) throw new Error('Plivo: to is required');
  if (!text) throw new Error('Plivo: text is required');
  if (!mediaUrls) throw new Error('Plivo: media_urls is required');

  const result = await plivo(ctx, 'Message', {
    src: from,
    dst: to,
    text,
    type: 'mms',
    media_urls: mediaUrls,
  });
  return { outputs: { result }, logs: [`Plivo mms → ${to}`] };
}

async function callMake(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const answerUrl = asString(ctx.options.answer_url);
  const answerMethod = asString(ctx.options.answer_method) || 'POST';
  if (!from) throw new Error('Plivo: from is required');
  if (!to) throw new Error('Plivo: to is required');
  if (!answerUrl) throw new Error('Plivo: answer_url is required');

  const result = await plivo(ctx, 'Call', {
    from,
    to,
    answer_url: answerUrl,
    answer_method: answerMethod,
  });
  return { outputs: { result }, logs: [`Plivo call → ${to}`] };
}

const block: ForgeBlock = {
  id: 'forge_plivo',
  name: 'Plivo',
  description: 'Send SMS/MMS and make voice calls via Plivo.',
  iconName: 'LuPhoneCall',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'plivo' },
  actions: [
    {
      id: 'sms_send',
      label: 'Send SMS',
      fields: [
        { id: 'from', label: 'From', type: 'text', required: true, placeholder: '+14156667777' },
        { id: 'to', label: 'To', type: 'text', required: true, placeholder: '+14156667778' },
        { id: 'text', label: 'Message', type: 'textarea', required: true },
      ],
      run: smsSend,
    },
    {
      id: 'mms_send',
      label: 'Send MMS',
      fields: [
        { id: 'from', label: 'From', type: 'text', required: true },
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'text', label: 'Message', type: 'textarea', required: true },
        {
          id: 'media_urls',
          label: 'Media URLs (comma-separated)',
          type: 'text',
          required: true,
          placeholder: 'https://example.com/a.png,https://example.com/b.jpg',
        },
      ],
      run: mmsSend,
    },
    {
      id: 'call_make',
      label: 'Make call',
      description: 'Initiate an outbound voice call.',
      fields: [
        { id: 'from', label: 'From', type: 'text', required: true },
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'answer_url', label: 'Answer URL', type: 'text', required: true },
        {
          id: 'answer_method',
          label: 'Answer method',
          type: 'select',
          defaultValue: 'POST',
          options: [
            { label: 'POST', value: 'POST' },
            { label: 'GET', value: 'GET' },
          ],
        },
      ],
      run: callMake,
    },
  ],
};

registerForgeBlock(block);
export default block;
