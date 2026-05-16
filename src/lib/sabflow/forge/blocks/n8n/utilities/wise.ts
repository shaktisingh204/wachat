/**
 * Forge block: Wise (TransferWise)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Wise/Wise.node.ts
 * Auth: `Authorization: Bearer <apiToken>` — inline as `password`.
 *
 * Operations covered:
 *   - profile.list   GET  /v1/profiles
 *   - quote.create   POST /v3/profiles/{profileId}/quotes
 *   - transfer.list  GET  /v1/transfers
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const LIVE = 'https://api.transferwise.com';
const SANDBOX = 'https://api.sandbox.transferwise.tech';

function rootUrl(ctx: ForgeActionContext): string {
  const env = asString(ctx.options.environment) || 'live';
  return env === 'sandbox' ? SANDBOX : LIVE;
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.apiToken);
  if (!token) throw new Error('Wise: apiToken is required');
  return { Authorization: `Bearer ${token}`, 'User-Agent': 'n8n-sabflow/forge' };
}

async function profileList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Wise',
    method: 'GET',
    url: `${rootUrl(ctx)}/v1/profiles`,
    headers: authHeader(ctx),
  });
  return { outputs: { profiles: res.data }, logs: ['Wise profile.list'] };
}

async function quoteCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const profileId = asString(ctx.options.profileId);
  if (!profileId) throw new Error('Wise: profileId is required');
  const sourceCurrency = asString(ctx.options.sourceCurrency);
  const targetCurrency = asString(ctx.options.targetCurrency);
  if (!sourceCurrency) throw new Error('Wise: sourceCurrency is required');
  if (!targetCurrency) throw new Error('Wise: targetCurrency is required');
  const sourceAmount = asNumber(ctx.options.sourceAmount);
  const targetAmount = asNumber(ctx.options.targetAmount);
  if (sourceAmount === undefined && targetAmount === undefined) {
    throw new Error('Wise: provide either sourceAmount or targetAmount');
  }
  const body: Record<string, unknown> = {
    sourceCurrency,
    targetCurrency,
  };
  if (sourceAmount !== undefined) body.sourceAmount = sourceAmount;
  if (targetAmount !== undefined) body.targetAmount = targetAmount;
  const res = await apiRequest({
    service: 'Wise',
    method: 'POST',
    url: `${rootUrl(ctx)}/v3/profiles/${encodeURIComponent(profileId)}/quotes`,
    headers: authHeader(ctx),
    json: body,
  });
  return {
    outputs: { quote: res.data },
    logs: [`Wise quote.create → ${sourceCurrency}→${targetCurrency}`],
  };
}

async function transferList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const profileId = asString(ctx.options.profileId);
  const status = asString(ctx.options.status);
  const limit = asString(ctx.options.limit);
  if (profileId) params.set('profile', profileId);
  if (status) params.set('status', status);
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Wise',
    method: 'GET',
    url: `${rootUrl(ctx)}/v1/transfers${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { transfers: res.data }, logs: ['Wise transfer.list'] };
}

const ENVIRONMENT_OPTIONS = [
  { label: 'Live', value: 'live' },
  { label: 'Sandbox', value: 'sandbox' },
];

const block: ForgeBlock = {
  id: 'forge_wise',
  name: 'Wise',
  description: 'Inspect Wise profiles, quotes, and transfers.',
  iconName: 'LuArrowLeftRight',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'profile_list',
      label: 'List profiles',
      description: 'List the profiles attached to the API token.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'environment', label: 'Environment', type: 'select', options: ENVIRONMENT_OPTIONS, defaultValue: 'live' },
      ],
      run: profileList,
    },
    {
      id: 'quote_create',
      label: 'Create quote',
      description: 'Create a quote between two currencies.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'environment', label: 'Environment', type: 'select', options: ENVIRONMENT_OPTIONS, defaultValue: 'live' },
        { id: 'profileId', label: 'Profile id', type: 'text', required: true },
        { id: 'sourceCurrency', label: 'Source currency', type: 'text', required: true, placeholder: 'USD' },
        { id: 'targetCurrency', label: 'Target currency', type: 'text', required: true, placeholder: 'EUR' },
        { id: 'sourceAmount', label: 'Source amount', type: 'number' },
        { id: 'targetAmount', label: 'Target amount', type: 'number' },
      ],
      run: quoteCreate,
    },
    {
      id: 'transfer_list',
      label: 'List transfers',
      description: 'List transfers with optional filters.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'environment', label: 'Environment', type: 'select', options: ENVIRONMENT_OPTIONS, defaultValue: 'live' },
        { id: 'profileId', label: 'Profile id', type: 'text' },
        { id: 'status', label: 'Status filter', type: 'text', placeholder: 'outgoing_payment_sent' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: transferList,
    },
  ],
};

registerForgeBlock(block);
export default block;
