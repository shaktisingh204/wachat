/**
 * Forge block: Mailchimp
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mailchimp/Mailchimp.node.ts
 * Credential type: 'mailchimp' (apiKey + serverPrefix, e.g. "us1")
 *
 * Operations covered (member-centric subset of the 2205-LOC source):
 *   - member.get             GET    /3.0/lists/{listId}/members/{subscriberHash}
 *   - member.create          POST   /3.0/lists/{listId}/members
 *   - member.upsert          PUT    /3.0/lists/{listId}/members/{subscriberHash}
 *   - member.update          PATCH  /3.0/lists/{listId}/members/{subscriberHash}
 *   - member.delete          DELETE /3.0/lists/{listId}/members/{subscriberHash}
 *   - member.deletePermanent POST   /3.0/lists/{listId}/members/{subscriberHash}/actions/delete-permanent
 *   - memberTag.add          POST   /3.0/lists/{listId}/members/{subscriberHash}/tags  (status: active)
 *   - memberTag.remove       POST   /3.0/lists/{listId}/members/{subscriberHash}/tags  (status: inactive)
 *   - campaign.get           GET    /3.0/campaigns/{campaignId}
 *   - campaign.getAll        GET    /3.0/campaigns                                     (count/offset)
 *   - campaign.delete        DELETE /3.0/campaigns/{campaignId}
 *   - campaign.send          POST   /3.0/campaigns/{campaignId}/actions/send
 *   - campaign.replicate     POST   /3.0/campaigns/{campaignId}/actions/replicate
 *   - campaign.resend        POST   /3.0/campaigns/{campaignId}/actions/create-resend
 *
 * Out of scope for the first port:
 *   - LoadOptions (list/template/segment dropdowns)
 *   - Batch ops, campaign content/template create
 *   - Webhook lifecycle (handled by SabFlow trigger nodes)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';
import type { ForgeHttpRequest, ForgeHttpResponse } from '../../../helpers';

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

function baseUrl(c: MailchimpCred): string {
  return `https://${c.serverPrefix}.api.mailchimp.com/3.0`;
}

/** Mailchimp uses HTTP Basic with the fixed literal `anystring` as the
 *  username and the apiKey as the password — handled by `basic-custom` with
 *  userLiteral. We centralise the request so error shaping stays consistent. */
async function mcReq(
  ctx: ForgeActionContext,
  req: Omit<ForgeHttpRequest, 'userLiteral' | 'passField'>,
): Promise<ForgeHttpResponse> {
  const r = await ctx.helpers!.requestWithAuthentication('basic-custom', {
    ...req,
    userLiteral: 'anystring',
    passField: 'apiKey',
  });
  if (!r.ok) {
    const clip =
      typeof r.data === 'string'
        ? r.data.length > 300
          ? `${r.data.slice(0, 300)}…`
          : r.data
        : JSON.stringify(r.data ?? null).slice(0, 300);
    throw new Error(`Mailchimp ${req.method} ${req.url} failed (${r.status}): ${clip}`);
  }
  return r;
}

/** Lowercase-MD5 subscriber hash per Mailchimp docs. */
async function subscriberHash(email: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('md5').update(email.toLowerCase()).digest('hex');
}

async function memberGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  if (!listId) throw new Error('Mailchimp: listId is required');
  if (!email) throw new Error('Mailchimp: email is required');
  const hash = await subscriberHash(email);
  const res = await mcReq(ctx, {
    method: 'GET',
    url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members/${hash}`,
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

  const res = await mcReq(ctx, {
    method: 'POST',
    url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members`,
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
  const res = await mcReq(ctx, {
    method: 'PATCH',
    url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members/${hash}`,
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
  await mcReq(ctx, {
    method: 'DELETE',
    url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members/${hash}`,
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
      const res = await mcReq(ctx, {
        method: 'GET',
        url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members?${qs.toString()}`,
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

async function memberUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  const status = asString(ctx.options.status) || 'subscribed';
  if (!listId) throw new Error('Mailchimp: listId is required');
  if (!email) throw new Error('Mailchimp: email is required');

  const body: Record<string, unknown> = {
    email_address: email,
    status_if_new: status,
    status,
  };
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  if (firstName || lastName) {
    const merge_fields: Record<string, string> = {};
    if (firstName) merge_fields.FNAME = firstName;
    if (lastName) merge_fields.LNAME = lastName;
    body.merge_fields = merge_fields;
  }
  const hash = await subscriberHash(email);
  const res = await mcReq(ctx, {
    method: 'PUT',
    url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members/${hash}`,
    json: body,
  });
  return { outputs: { member: res.data }, logs: [`Mailchimp member upsert → ${email}`] };
}

async function memberDeletePermanent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  if (!listId) throw new Error('Mailchimp: listId is required');
  if (!email) throw new Error('Mailchimp: email is required');
  const hash = await subscriberHash(email);
  await mcReq(ctx, {
    method: 'POST',
    url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members/${hash}/actions/delete-permanent`,
  });
  return { outputs: { success: true }, logs: [`Mailchimp member delete-permanent → ${email}`] };
}

async function memberTagSet(ctx: ForgeActionContext, status: 'active' | 'inactive', label: string): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  const tagsRaw = asString(ctx.options.tags);
  if (!listId) throw new Error('Mailchimp: listId is required');
  if (!email) throw new Error('Mailchimp: email is required');
  if (!tagsRaw) throw new Error('Mailchimp: at least one tag is required');
  const tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name, status }));
  const hash = await subscriberHash(email);
  await mcReq(ctx, {
    method: 'POST',
    url: `${baseUrl(cred)}/lists/${encodeURIComponent(listId)}/members/${hash}/tags`,
    json: { tags },
  });
  return { outputs: { success: true, applied: tags.length }, logs: [`Mailchimp member tag ${label} → ${email}`] };
}

async function memberTagAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return memberTagSet(ctx, 'active', 'add');
}
async function memberTagRemove(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return memberTagSet(ctx, 'inactive', 'remove');
}

async function campaignGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const campaignId = asString(ctx.options.campaignId);
  if (!campaignId) throw new Error('Mailchimp: campaignId is required');
  const res = await mcReq(ctx, {
    method: 'GET',
    url: `${baseUrl(cred)}/campaigns/${encodeURIComponent(campaignId)}`,
  });
  return { outputs: { campaign: res.data }, logs: [`Mailchimp campaign get → ${campaignId}`] };
}

async function campaignDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const campaignId = asString(ctx.options.campaignId);
  if (!campaignId) throw new Error('Mailchimp: campaignId is required');
  await mcReq(ctx, {
    method: 'DELETE',
    url: `${baseUrl(cred)}/campaigns/${encodeURIComponent(campaignId)}`,
  });
  return { outputs: { success: true, campaignId }, logs: [`Mailchimp campaign delete → ${campaignId}`] };
}

async function campaignReplicate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const campaignId = asString(ctx.options.campaignId);
  if (!campaignId) throw new Error('Mailchimp: campaignId is required');
  const res = await mcReq(ctx, {
    method: 'POST',
    url: `${baseUrl(cred)}/campaigns/${encodeURIComponent(campaignId)}/actions/replicate`,
  });
  return { outputs: { campaign: res.data }, logs: [`Mailchimp campaign replicate → ${campaignId}`] };
}

async function campaignResend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const campaignId = asString(ctx.options.campaignId);
  if (!campaignId) throw new Error('Mailchimp: campaignId is required');
  const res = await mcReq(ctx, {
    method: 'POST',
    url: `${baseUrl(cred)}/campaigns/${encodeURIComponent(campaignId)}/actions/create-resend`,
  });
  return { outputs: { campaign: res.data }, logs: [`Mailchimp campaign resend → ${campaignId}`] };
}

async function campaignGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSizeNum = asNumber(ctx.options.pageSize) ?? 500;
  const status = asString(ctx.options.status);

  const campaigns = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const offset = cursor ?? '0';
      const qs = new URLSearchParams();
      qs.set('count', String(pageSizeNum));
      qs.set('offset', offset);
      if (status) qs.set('status', status);
      const res = await mcReq(ctx, {
        method: 'GET',
        url: `${baseUrl(cred)}/campaigns?${qs.toString()}`,
      });
      const body = res.data as { campaigns?: unknown[]; total_items?: number } | null;
      const items = (body?.campaigns ?? []) as unknown[];
      const consumed = Number(offset) + items.length;
      const total = typeof body?.total_items === 'number' ? body.total_items : undefined;
      const more = items.length === pageSizeNum && (total === undefined || consumed < total);
      return { items, nextCursor: more ? String(consumed) : undefined };
    },
  });
  return { outputs: { campaigns, count: campaigns.length }, logs: [`Mailchimp campaign list → ${campaigns.length}`] };
}

async function campaignSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const campaignId = asString(ctx.options.campaignId);
  if (!campaignId) throw new Error('Mailchimp: campaignId is required');
  await mcReq(ctx, {
    method: 'POST',
    url: `${baseUrl(cred)}/campaigns/${encodeURIComponent(campaignId)}/actions/send`,
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
      id: 'member_upsert',
      label: 'Add or update member',
      description: 'Insert a member or update if email already exists (PUT).',
      fields: [
        { id: 'listId', label: 'Audience (list) ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'status', label: 'Status (status_if_new + status)', type: 'select', options: STATUS_OPTIONS, defaultValue: 'subscribed' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
      ],
      run: memberUpsert,
    },
    {
      id: 'member_delete_permanent',
      label: 'Permanently delete member',
      description: 'Permanently delete a member (irreversible).',
      fields: [
        { id: 'listId', label: 'Audience (list) ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
      ],
      run: memberDeletePermanent,
    },
    {
      id: 'member_tag_add',
      label: 'Add tags to member',
      description: 'Apply one or more tags to a member (active status).',
      fields: [
        { id: 'listId', label: 'Audience (list) ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'tags', label: 'Tag names (comma separated)', type: 'text', required: true },
      ],
      run: memberTagAdd,
    },
    {
      id: 'member_tag_remove',
      label: 'Remove tags from member',
      description: 'Remove one or more tags from a member (inactive status).',
      fields: [
        { id: 'listId', label: 'Audience (list) ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'tags', label: 'Tag names (comma separated)', type: 'text', required: true },
      ],
      run: memberTagRemove,
    },
    {
      id: 'campaign_get',
      label: 'Get campaign',
      description: 'Fetch a campaign by id.',
      fields: [{ id: 'campaignId', label: 'Campaign ID', type: 'text', required: true }],
      run: campaignGet,
    },
    {
      id: 'campaign_get_all',
      label: 'List campaigns (paginated)',
      description: 'Walk Mailchimp\'s count/offset pagination over all campaigns.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (count)', type: 'number', defaultValue: '500' },
        {
          id: 'status',
          label: 'Status filter (optional)',
          type: 'select',
          options: [
            { label: 'Any', value: '' },
            { label: 'Save', value: 'save' },
            { label: 'Paused', value: 'paused' },
            { label: 'Schedule', value: 'schedule' },
            { label: 'Sending', value: 'sending' },
            { label: 'Sent', value: 'sent' },
          ],
        },
      ],
      run: campaignGetAll,
    },
    {
      id: 'campaign_delete',
      label: 'Delete campaign',
      description: 'Delete a campaign by id.',
      fields: [{ id: 'campaignId', label: 'Campaign ID', type: 'text', required: true }],
      run: campaignDelete,
    },
    {
      id: 'campaign_replicate',
      label: 'Replicate campaign',
      description: 'Create a copy of an existing campaign.',
      fields: [{ id: 'campaignId', label: 'Campaign ID', type: 'text', required: true }],
      run: campaignReplicate,
    },
    {
      id: 'campaign_resend',
      label: 'Resend campaign',
      description: 'Create a resend of a previously sent campaign to non-openers.',
      fields: [{ id: 'campaignId', label: 'Campaign ID', type: 'text', required: true }],
      run: campaignResend,
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
