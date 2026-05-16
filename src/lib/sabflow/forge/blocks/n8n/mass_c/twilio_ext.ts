/**
 * Forge block: Twilio (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Twilio/Twilio.node.ts
 *
 * Uses HTTP Basic auth: <accountSid>:<authToken>.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function api(ctx: ForgeActionContext, path: string): string {
  const sid = asString(ctx.options.accountSid);
  if (!sid) throw new Error('Twilio: accountSid is required');
  return `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}${path}`;
}

function headers(ctx: ForgeActionContext): Record<string, string> {
  const sid = asString(ctx.options.accountSid);
  const token = asString(ctx.options.authToken);
  if (!sid || !token) throw new Error('Twilio: accountSid and authToken are required');
  return {
    Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

async function callCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const to = asString(ctx.options.to);
  const from = asString(ctx.options.from);
  const url = asString(ctx.options.twimlUrl);
  if (!to || !from || !url) throw new Error('Twilio: to, from and twimlUrl are required');
  const form = new URLSearchParams({ To: to, From: from, Url: url });
  const res = await apiRequest({
    service: 'Twilio',
    method: 'POST',
    url: api(ctx, '/Calls.json'),
    headers: headers(ctx),
    body: form.toString(),
  });
  return { outputs: { call: res.data }, logs: [`Twilio call → ${to}`] };
}

async function messageList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const to = asString(ctx.options.to);
  const from = asString(ctx.options.from);
  if (to) params.set('To', to);
  if (from) params.set('From', from);
  const path = `/Messages.json${params.size ? `?${params.toString()}` : ''}`;
  const res = await apiRequest({
    service: 'Twilio',
    method: 'GET',
    url: api(ctx, path),
    headers: headers(ctx),
  });
  return { outputs: { messages: res.data }, logs: ['Twilio messages list'] };
}

async function incomingNumbersList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Twilio',
    method: 'GET',
    url: api(ctx, '/IncomingPhoneNumbers.json'),
    headers: headers(ctx),
  });
  return { outputs: { numbers: res.data }, logs: ['Twilio incoming numbers list'] };
}

const block: ForgeBlock = {
  id: 'forge_twilio_ext',
  name: 'Twilio (extended)',
  description: 'Twilio ops (call create, messages list, incoming numbers).',
  iconName: 'LuPhone',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'call_create',
      label: 'Place a call',
      fields: [
        { id: 'accountSid', label: 'Account SID', type: 'password', required: true },
        { id: 'authToken', label: 'Auth token', type: 'password', required: true },
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'from', label: 'From', type: 'text', required: true },
        { id: 'twimlUrl', label: 'TwiML URL', type: 'text', required: true },
      ],
      run: callCreate,
    },
    {
      id: 'message_list',
      label: 'List messages',
      fields: [
        { id: 'accountSid', label: 'Account SID', type: 'password', required: true },
        { id: 'authToken', label: 'Auth token', type: 'password', required: true },
        { id: 'to', label: 'To (filter)', type: 'text' },
        { id: 'from', label: 'From (filter)', type: 'text' },
      ],
      run: messageList,
    },
    {
      id: 'incoming_numbers_list',
      label: 'List incoming numbers',
      fields: [
        { id: 'accountSid', label: 'Account SID', type: 'password', required: true },
        { id: 'authToken', label: 'Auth token', type: 'password', required: true },
      ],
      run: incomingNumbersList,
    },
  ],
};

registerForgeBlock(block);
export default block;
