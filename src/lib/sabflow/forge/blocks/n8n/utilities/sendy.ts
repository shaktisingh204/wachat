/**
 * Forge block: Sendy
 *
 * Source: n8n-master/packages/nodes-base/nodes/Sendy/Sendy.node.ts
 *
 * Self-hosted Sendy. Requests use application/x-www-form-urlencoded.
 * The api_key is passed in the body. The Sendy installation URL is required
 * (e.g. https://your-sendy.com).
 *
 * Operations covered:
 *   - subscriber.add        POST {base}/subscribe
 *   - subscriber.remove     POST {base}/unsubscribe
 *   - subscriber.delete     POST {base}/api/subscribers/delete.php
 *   - subscriber.status     POST {base}/api/subscribers/subscription-status.php
 *   - subscriber.count      POST {base}/api/subscribers/active-subscriber-count.php
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function getBase(ctx: ForgeActionContext): string {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('Sendy: url is required');
  return url.replace(/\/$/, '');
}

function getApiKey(ctx: ForgeActionContext): string {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Sendy: apiKey is required');
  return apiKey;
}

function toForm(payload: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(payload)) sp.append(k, v);
  return sp.toString();
}

async function postForm(
  service: string,
  url: string,
  payload: Record<string, string>,
): Promise<unknown> {
  const res = await apiRequest({
    service,
    method: 'POST',
    url,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: toForm(payload),
  });
  return res.data;
}

async function subscriberAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = getBase(ctx);
  const apiKey = getApiKey(ctx);
  const email = asString(ctx.options.email);
  const listId = asString(ctx.options.listId);
  if (!email) throw new Error('Sendy: email is required');
  if (!listId) throw new Error('Sendy: listId is required');
  const payload: Record<string, string> = {
    api_key: apiKey,
    boolean: 'true',
    email,
    list: listId,
  };
  const name = asString(ctx.options.name);
  if (name) payload.name = name;
  const data = await postForm('Sendy', `${base}/subscribe`, payload);
  return { outputs: { result: data }, logs: [`Sendy subscriber add → ${email}`] };
}

async function subscriberRemove(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = getBase(ctx);
  const apiKey = getApiKey(ctx);
  const email = asString(ctx.options.email);
  const listId = asString(ctx.options.listId);
  if (!email) throw new Error('Sendy: email is required');
  if (!listId) throw new Error('Sendy: listId is required');
  const data = await postForm('Sendy', `${base}/unsubscribe`, {
    api_key: apiKey,
    boolean: 'true',
    email,
    list: listId,
  });
  return { outputs: { result: data }, logs: [`Sendy subscriber remove → ${email}`] };
}

async function subscriberDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = getBase(ctx);
  const apiKey = getApiKey(ctx);
  const email = asString(ctx.options.email);
  const listId = asString(ctx.options.listId);
  if (!email) throw new Error('Sendy: email is required');
  if (!listId) throw new Error('Sendy: listId is required');
  const data = await postForm('Sendy', `${base}/api/subscribers/delete.php`, {
    api_key: apiKey,
    boolean: 'true',
    email,
    list_id: listId,
  });
  return { outputs: { result: data }, logs: [`Sendy subscriber delete → ${email}`] };
}

async function subscriberStatus(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = getBase(ctx);
  const apiKey = getApiKey(ctx);
  const email = asString(ctx.options.email);
  const listId = asString(ctx.options.listId);
  if (!email) throw new Error('Sendy: email is required');
  if (!listId) throw new Error('Sendy: listId is required');
  const data = await postForm('Sendy', `${base}/api/subscribers/subscription-status.php`, {
    api_key: apiKey,
    boolean: 'true',
    email,
    list_id: listId,
  });
  return { outputs: { status: data }, logs: [`Sendy subscriber status → ${email}`] };
}

async function subscriberCount(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = getBase(ctx);
  const apiKey = getApiKey(ctx);
  const listId = asString(ctx.options.listId);
  if (!listId) throw new Error('Sendy: listId is required');
  const data = await postForm('Sendy', `${base}/api/subscribers/active-subscriber-count.php`, {
    api_key: apiKey,
    boolean: 'true',
    list_id: listId,
  });
  return { outputs: { count: data }, logs: [`Sendy subscriber count → list ${listId}`] };
}

const CREDENTIAL_FIELDS = [
  { id: 'url', label: 'Sendy URL', type: 'text' as const, required: true, placeholder: 'https://yourdomain.com' },
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_sendy',
  name: 'Sendy',
  description: 'Manage Sendy subscribers on your self-hosted installation.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'subscriber_add',
      label: 'Add subscriber',
      description: 'Subscribe an email to a list.',
      fields: [
        ...CREDENTIAL_FIELDS,
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
      ],
      run: subscriberAdd,
    },
    {
      id: 'subscriber_remove',
      label: 'Unsubscribe',
      description: 'Unsubscribe an email from a list.',
      fields: [
        ...CREDENTIAL_FIELDS,
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
      ],
      run: subscriberRemove,
    },
    {
      id: 'subscriber_delete',
      label: 'Delete subscriber',
      description: 'Permanently delete a subscriber from a list.',
      fields: [
        ...CREDENTIAL_FIELDS,
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
      ],
      run: subscriberDelete,
    },
    {
      id: 'subscriber_status',
      label: 'Get subscriber status',
      description: 'Get the subscription status of an email on a list.',
      fields: [
        ...CREDENTIAL_FIELDS,
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
      ],
      run: subscriberStatus,
    },
    {
      id: 'subscriber_count',
      label: 'Count subscribers',
      description: 'Get the active subscriber count for a list.',
      fields: [
        ...CREDENTIAL_FIELDS,
        { id: 'listId', label: 'List ID', type: 'text', required: true },
      ],
      run: subscriberCount,
    },
  ],
};

registerForgeBlock(block);
export default block;
