/**
 * Forge block: Mailchimp
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mailchimp/Mailchimp.node.ts
 * Credential type: 'mailchimp' (apiKey + serverPrefix, e.g. "us1")
 *
 * Operations covered (member-centric subset of the 2205-LOC source):
 *   - member.get         GET    /3.0/lists/{listId}/members/{subscriberHash}
 *   - member.create      POST   /3.0/lists/{listId}/members
 *   - member.update      PATCH  /3.0/lists/{listId}/members/{subscriberHash}
 *   - member.delete      DELETE /3.0/lists/{listId}/members/{subscriberHash}
 *   - campaign.send      POST   /3.0/campaigns/{campaignId}/actions/send
 *
 * Out of scope for the first port:
 *   - LoadOptions (list/template/segment dropdowns)
 *   - Member tags add/remove, batch ops, campaign content/template create
 *   - Webhook lifecycle (handled by SabFlow trigger nodes)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

type MailchimpCred = { apiKey: string; serverPrefix: string };

function getCred(ctx: ForgeActionContext): MailchimpCred {
  const cred = requireCredential('Mailchimp', ctx.credential);
  const apiKey = cred.apiKey ?? '';
  let serverPrefix = cred.serverPrefix ?? '';
  if (!serverPrefix && apiKey.includes('-')) serverPrefix = apiKey.split('-').pop() ?? '';
  if (!apiKey) throw new Error('Mailchimp: credential is missing `apiKey`');
  if (!serverPrefix) throw new Error('Mailchimp: credential is missing `serverPrefix` (e.g. "us1")');
  return { apiKey, serverPrefix };
}

function authHeaders(c: MailchimpCred): Record<string, string> {
  const basic = btoa(`anystring:${c.apiKey}`);
  return { Authorization: `Basic ${basic}` };
}

function baseUrl(c: MailchimpCred): string {
  return `https://${c.serverPrefix}.api.mailchimp.com/3.0`;
}

/** Lowercase-MD5 subscriber hash per Mailchimp docs. */
async function subscriberHash(email: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cryptoMod = await (Function('m', 'return import(m)') as (m: string) => Promise<any>)('node:crypto');
  return cryptoMod.createHash('md5').update(email.toLowerCase()).digest('hex');
}

async function memberGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  if (!listId) throw new Error('Mailchimp: listId is required');
  if (!email) throw new Error('Mailchimp: email is required');
  const hash = await subscriberHash(email);
  const res = await apiRequest({
    service: 'Mailchimp',
    method: 'GET',
    url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members/${hash}`,
    headers: authHeaders(cred),
  });
  return { outputs: { member: res.data }, logs: [`Mailchimp member get → ${email}`] };
}

async function memberCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  const status = asString(ctx.options.status) || 'subscribed';
  if (!listId) throw new Error('Mailchimp: listId is required');
  if (!email) throw new Error('Mailchimp: email is required');

  const body: Record<string, unknown> = { email_address: email, status };
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const language = asString(ctx.options.language);
  if (firstName || lastName) {
    const merge_fields: Record<string, string> = {};
    if (firstName) merge_fields.FNAME = firstName;
    if (lastName) merge_fields.LNAME = lastName;
    body.merge_fields = merge_fields;
  }
  if (language) body.language = language;

  const res = await apiRequest({
    service: 'Mailchimp',
    method: 'POST',
    url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members`,
    headers: authHeaders(cred),
    json: body,
  });
  return { outputs: { member: res.data }, logs: [`Mailchimp member create → ${email}`] };
}

async function memberUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  if (!listId) throw new Error('Mailchimp: listId is required');
  if (!email) throw new Error('Mailchimp: email is required');

  const body: Record<string, unknown> = {};
  const status = asString(ctx.options.status);
  if (status) body.status = status;
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  if (firstName || lastName) {
    const merge_fields: Record<string, string> = {};
    if (firstName) merge_fields.FNAME = firstName;
    if (lastName) merge_fields.LNAME = lastName;
    body.merge_fields = merge_fields;
  }
  const language = asString(ctx.options.language);
  if (language) body.language = language;
  if (Object.keys(body).length === 0) {
    throw new Error('Mailchimp: at least one updatable field must be set');
  }

  const hash = await subscriberHash(email);
  const res = await apiRequest({
    service: 'Mailchimp',
    method: 'PATCH',
    url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members/${hash}`,
    headers: authHeaders(cred),
    json: body,
  });
  return { outputs: { member: res.data }, logs: [`Mailchimp member update → ${email}`] };
}

async function memberDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  if (!listId) throw new Error('Mailchimp: listId is required');
  if (!email) throw new Error('Mailchimp: email is required');
  const hash = await subscriberHash(email);
  await apiRequest({
    service: 'Mailchimp',
    method: 'DELETE',
    url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members/${hash}`,
    headers: authHeaders(cred),
  });
  return { outputs: { success: true }, logs: [`Mailchimp member delete → ${email}`] };
}

async function memberListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const listId = asString(ctx.options.listId);
  if (!listId) throw new Error('Mailchimp: listId is required');
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSizeNum = asNumber(ctx.options.pageSize) ?? 500;
  const status = asString(ctx.options.status);

  const members = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const offset = cursor ?? '0';
      const qs = new URLSearchParams();
      qs.set('count', String(pageSizeNum));
      qs.set('offset', offset);
      if (status) qs.set('status', status);
      const res = await apiRequest({
        service: 'Mailchimp',
        method: 'GET',
        url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members?${qs.toString()}`,
        headers: authHeaders(cred),
      });
      const body = res.data as {
        members?: unknown[];
        total_items?: number;
      } | null;
      const items = (body?.members ?? []) as unknown[];
      const consumed = Number(offset) + items.length;
      const total = typeof body?.total_items === 'number' ? body.total_items : undefined;
      const more = items.length === pageSizeNum && (total === undefined || consumed < total);
      const nextCursor = more ? String(consumed) : undefined;
      return { items, nextCursor };
    },
  });

  return {
    outputs: { members, count: members.length },
    logs: [`Mailchimp member list all → ${members.length}`],
  };
}

async function campaignSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const campaignId = asString(ctx.options.campaignId);
  if (!campaignId) throw new Error('Mailchimp: campaignId is required');
  await apiRequest({
    service: 'Mailchimp',
    method: 'POST',
    url: `${baseUrl(cred)}/campaigns/${encodeURIComponent(campaignId)}/actions/send`,
    headers: authHeaders(cred),
  });
  return { outputs: { success: true, campaignId }, logs: [`Mailchimp campaign send → ${campaignId}`] };
}

const STATUS_OPTIONS = [
  { label: 'Subscribed', value: 'subscribed' },
  { label: 'Unsubscribed', value: 'unsubscribed' },
  { label: 'Cleaned', value: 'cleaned' },
  { label: 'Pending', value: 'pending' },
  { label: 'Transactional', value: 'transactional' },
];

const block: ForgeBlock = {
  id: 'forge_mailchimp',
  name: 'Mailchimp',
  description: 'Manage Mailchimp audience members and send campaigns from a flow.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mailchimp' },
  actions: [
    {
      id: 'member_get',
      label: 'Get member',
      description: 'Fetch a single audience member by email.',
      fields: [
        { id: 'listId', label: 'Audience (list) ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
      ],
      run: memberGet,
    },
    {
      id: 'member_create',
      label: 'Add member',
      description: 'Add a new subscriber to an audience.',
      fields: [
        { id: 'listId', label: 'Audience (list) ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, defaultValue: 'subscribed' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'language', label: 'Language', type: 'text', placeholder: 'en' },
      ],
      run: memberCreate,
    },
    {
      id: 'member_update',
      label: 'Update member',
      description: 'Patch an existing audience member. Only set fields are sent.',
      fields: [
        { id: 'listId', label: 'Audience (list) ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'status', label: 'Status', type: 'select', options: [{ label: 'Unchanged', value: '' }, ...STATUS_OPTIONS] },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'language', label: 'Language', type: 'text' },
      ],
      run: memberUpdate,
    },
    {
      id: 'member_delete',
      label: 'Delete member',
      description: 'Permanently delete an audience member.',
      fields: [
        { id: 'listId', label: 'Audience (list) ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
      ],
      run: memberDelete,
    },
    {
      id: 'member_list_all',
      label: 'List all audience members (paginated)',
      description: 'Walk Mailchimp\'s count/offset pagination and return every member up to the cap.',
      fields: [
        { id: 'listId', label: 'Audience (list) ID', type: 'text', required: true },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (count, max 1000)', type: 'number', defaultValue: '500' },
        {
          id: 'status',
          label: 'Status filter (optional)',
          type: 'select',
          options: [{ label: 'Any', value: '' }, ...STATUS_OPTIONS],
        },
      ],
      run: memberListAll,
    },
    {
      id: 'campaign_send',
      label: 'Send campaign',
      description: 'Send a previously prepared campaign immediately.',
      fields: [
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
      ],
      run: campaignSend,
    },
  ],
};

registerForgeBlock(block);
export default block;
