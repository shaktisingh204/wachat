/**
 * Forge block: Stripe Treasury
 *
 * Stripe Treasury — financial accounts, outbound transfers and received
 * credits. Uses `https://api.stripe.com/v1/treasury/*` with Bearer auth.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.stripe.com/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Stripe Treasury: apiKey is required');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

function form(input: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined && v !== '') params.set(k, v);
  }
  return params.toString();
}

async function listFinancialAccounts(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asString(ctx.options.limit);
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Stripe Treasury',
    method: 'GET',
    url: `${API}/treasury/financial_accounts${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { financialAccounts: res.data }, logs: ['Stripe Treasury list financial accounts'] };
}

async function getFinancialAccount(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.financialAccountId);
  if (!id) throw new Error('Stripe Treasury: financialAccountId is required');
  const res = await apiRequest({
    service: 'Stripe Treasury',
    method: 'GET',
    url: `${API}/treasury/financial_accounts/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { financialAccount: res.data }, logs: [`Stripe Treasury get financial account → ${id}`] };
}

async function createOutboundTransfer(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const financialAccount = asString(ctx.options.financialAccountId);
  const amount = asString(ctx.options.amount);
  const currency = asString(ctx.options.currency) || 'usd';
  const destinationPaymentMethod = asString(ctx.options.destinationPaymentMethod);
  const description = asString(ctx.options.description);
  if (!financialAccount) throw new Error('Stripe Treasury: financialAccountId is required');
  if (!amount) throw new Error('Stripe Treasury: amount is required');
  if (!destinationPaymentMethod) throw new Error('Stripe Treasury: destinationPaymentMethod is required');
  const body = form({
    financial_account: financialAccount,
    amount,
    currency,
    destination_payment_method: destinationPaymentMethod,
    description: description || undefined,
  });
  const res = await apiRequest({
    service: 'Stripe Treasury',
    method: 'POST',
    url: `${API}/treasury/outbound_transfers`,
    headers: authHeaders(ctx),
    body,
  });
  return { outputs: { outboundTransfer: res.data }, logs: [`Stripe Treasury outbound transfer → ${amount} ${currency}`] };
}

async function listReceivedCredits(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const financialAccount = asString(ctx.options.financialAccountId);
  const limit = asString(ctx.options.limit);
  if (!financialAccount) throw new Error('Stripe Treasury: financialAccountId is required');
  const params = new URLSearchParams({ financial_account: financialAccount });
  if (limit) params.set('limit', limit);
  const res = await apiRequest({
    service: 'Stripe Treasury',
    method: 'GET',
    url: `${API}/treasury/received_credits?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { receivedCredits: res.data }, logs: [`Stripe Treasury received credits → ${financialAccount}`] };
}

const block: ForgeBlock = {
  id: 'forge_stripe_treasury',
  name: 'Stripe Treasury',
  description: 'Stripe Treasury financial accounts, outbound transfers and received credits.',
  iconName: 'LuLandmark',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_financial_accounts',
      label: 'List financial accounts',
      fields: [
        { id: 'apiKey', label: 'Secret key', type: 'password', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: listFinancialAccounts,
    },
    {
      id: 'get_financial_account',
      label: 'Get financial account',
      fields: [
        { id: 'apiKey', label: 'Secret key', type: 'password', required: true },
        { id: 'financialAccountId', label: 'Financial account ID', type: 'text', required: true },
      ],
      run: getFinancialAccount,
    },
    {
      id: 'create_outbound_transfer',
      label: 'Create outbound transfer',
      fields: [
        { id: 'apiKey', label: 'Secret key', type: 'password', required: true },
        { id: 'financialAccountId', label: 'Financial account ID', type: 'text', required: true },
        { id: 'amount', label: 'Amount (minor units)', type: 'number', required: true },
        { id: 'currency', label: 'Currency', type: 'text', defaultValue: 'usd' },
        { id: 'destinationPaymentMethod', label: 'Destination payment method ID', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'text' },
      ],
      run: createOutboundTransfer,
    },
    {
      id: 'list_received_credits',
      label: 'List received credits',
      fields: [
        { id: 'apiKey', label: 'Secret key', type: 'password', required: true },
        { id: 'financialAccountId', label: 'Financial account ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: listReceivedCredits,
    },
  ],
};

registerForgeBlock(block);
export default block;
