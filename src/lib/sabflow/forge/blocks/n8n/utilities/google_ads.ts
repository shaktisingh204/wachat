/**
 * Forge block: Google Ads
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Ads/GoogleAds.node.ts
 *
 * Auth: OAuth Bearer access token + developer-token header (inline password fields).
 *
 * OAuth deferred: user must paste an access token obtained out-of-band. A
 * future revision should integrate the SabFlow OAuth credential type for
 * Google Ads with automatic refresh.
 *
 * Operations covered:
 *   - customer.list      GET  /v17/customers:listAccessibleCustomers
 *   - campaign.list      POST /v17/customers/{customerId}/googleAds:search
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://googleads.googleapis.com/v17';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  const dev = asString(ctx.options.developerToken);
  if (!token) throw new Error('Google Ads: accessToken is required');
  if (!dev) throw new Error('Google Ads: developerToken is required');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'developer-token': dev,
  };
  const loginCustomerId = asString(ctx.options.loginCustomerId);
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId.replace(/-/g, '');
  return headers;
}

async function customerList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Google Ads',
    method: 'GET',
    url: `${API}/customers:listAccessibleCustomers`,
    headers: authHeaders(ctx),
  });
  return { outputs: { customers: res.data }, logs: ['Google Ads customer list'] };
}

async function campaignList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const customerId = asString(ctx.options.customerId).replace(/-/g, '');
  if (!customerId) throw new Error('Google Ads: customerId is required');
  const query =
    asString(ctx.options.gaqlQuery) ||
    'SELECT campaign.id, campaign.name, campaign.status FROM campaign LIMIT 100';
  const res = await apiRequest({
    service: 'Google Ads',
    method: 'POST',
    url: `${API}/customers/${encodeURIComponent(customerId)}/googleAds:search`,
    headers: authHeaders(ctx),
    json: { query },
  });
  return { outputs: { campaigns: res.data }, logs: [`Google Ads campaign list → ${customerId}`] };
}

const block: ForgeBlock = {
  id: 'forge_google_ads',
  name: 'Google Ads',
  description: 'List accessible customers and run GAQL queries on Google Ads.',
  iconName: 'LuMegaphone',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'customer_list',
      label: 'List customers',
      description: 'List accessible customers for the authenticated user.',
      fields: [
        { id: 'accessToken', label: 'OAuth access token', type: 'password', required: true },
        { id: 'developerToken', label: 'Developer token', type: 'password', required: true },
        { id: 'loginCustomerId', label: 'Login customer ID', type: 'text' },
      ],
      run: customerList,
    },
    {
      id: 'campaign_list',
      label: 'Query campaigns',
      description: 'Run a GAQL query against a customer account.',
      fields: [
        { id: 'accessToken', label: 'OAuth access token', type: 'password', required: true },
        { id: 'developerToken', label: 'Developer token', type: 'password', required: true },
        { id: 'loginCustomerId', label: 'Login customer ID', type: 'text' },
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        {
          id: 'gaqlQuery',
          label: 'GAQL query',
          type: 'textarea',
          placeholder: 'SELECT campaign.id, campaign.name FROM campaign',
        },
      ],
      run: campaignList,
    },
  ],
};

registerForgeBlock(block);
export default block;
