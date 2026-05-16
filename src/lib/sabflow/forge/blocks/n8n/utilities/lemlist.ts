/**
 * Forge block: Lemlist
 *
 * Source: n8n-master/packages/nodes-base/nodes/Lemlist/v2/LemlistV2.node.ts
 *
 * Auth: HTTP Basic with empty username and API key as password.
 *
 * Operations covered:
 *   - campaign.list       GET    /campaigns
 *   - campaign.stats      GET    /campaigns/{id}/stats
 *   - lead.add            POST   /campaigns/{campaignId}/leads/{email}
 *   - lead.get            GET    /leads/{email}
 *   - unsubscribe.add     POST   /unsubscribes/{email}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.lemlist.com/api';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Lemlist: apiKey is required');
  const token = btoa(`:${apiKey}`);
  return {
    Authorization: `Basic ${token}`,
    'user-agent': 'sabflow',
    Accept: 'application/json',
  };
}

async function campaignList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Lemlist',
    method: 'GET',
    url: `${API}/campaigns${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { campaigns: res.data }, logs: ['Lemlist campaign list'] };
}

async function campaignStats(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const campaignId = asString(ctx.options.campaignId);
  if (!campaignId) throw new Error('Lemlist: campaignId is required');
  const params = new URLSearchParams();
  const startDate = asString(ctx.options.startDate);
  const endDate = asString(ctx.options.endDate);
  const timezone = asString(ctx.options.timezone);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (timezone) params.set('timezone', timezone);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Lemlist',
    method: 'GET',
    url: `${API}/campaigns/${encodeURIComponent(campaignId)}/stats${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { stats: res.data }, logs: [`Lemlist campaign stats → ${campaignId}`] };
}

async function leadAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const campaignId = asString(ctx.options.campaignId);
  const email = asString(ctx.options.email);
  if (!campaignId) throw new Error('Lemlist: campaignId is required');
  if (!email) throw new Error('Lemlist: email is required');
  const body: Record<string, unknown> = {};
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const companyName = asString(ctx.options.companyName);
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;
  if (companyName) body.companyName = companyName;
  const res = await apiRequest({
    service: 'Lemlist',
    method: 'POST',
    url: `${API}/campaigns/${encodeURIComponent(campaignId)}/leads/${encodeURIComponent(email)}`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { lead: res.data }, logs: [`Lemlist lead add → ${email}`] };
}

async function leadGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Lemlist: email is required');
  const res = await apiRequest({
    service: 'Lemlist',
    method: 'GET',
    url: `${API}/leads/${encodeURIComponent(email)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { lead: res.data }, logs: [`Lemlist lead get → ${email}`] };
}

async function unsubscribeAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Lemlist: email is required');
  const res = await apiRequest({
    service: 'Lemlist',
    method: 'POST',
    url: `${API}/unsubscribes/${encodeURIComponent(email)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { unsubscribe: res.data }, logs: [`Lemlist unsubscribe add → ${email}`] };
}

const block: ForgeBlock = {
  id: 'forge_lemlist',
  name: 'Lemlist',
  description: 'Manage Lemlist campaigns, leads and unsubscribes.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'campaign_list',
      label: 'List campaigns',
      description: 'List Lemlist campaigns.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: campaignList,
    },
    {
      id: 'campaign_stats',
      label: 'Get campaign stats',
      description: 'Get statistics for a campaign.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
        { id: 'startDate', label: 'Start date (YYYY-MM-DD)', type: 'text' },
        { id: 'endDate', label: 'End date (YYYY-MM-DD)', type: 'text' },
        { id: 'timezone', label: 'Timezone', type: 'text' },
      ],
      run: campaignStats,
    },
    {
      id: 'lead_add',
      label: 'Add lead to campaign',
      description: 'Add a lead to a campaign by email.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'companyName', label: 'Company name', type: 'text' },
      ],
      run: leadAdd,
    },
    {
      id: 'lead_get',
      label: 'Get lead',
      description: 'Fetch a lead by email.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
      ],
      run: leadGet,
    },
    {
      id: 'unsubscribe_add',
      label: 'Add unsubscribe',
      description: 'Add an email to the unsubscribes list.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
      ],
      run: unsubscribeAdd,
    },
  ],
};

registerForgeBlock(block);
export default block;
