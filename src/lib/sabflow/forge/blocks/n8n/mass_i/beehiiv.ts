/**
 * Forge block: Beehiiv
 *
 * API: https://developers.beehiiv.com/docs/v2
 * Auth: Bearer API key (per publication).
 *
 * Operations covered:
 *   - subscription.create       POST  /publications/{pubId}/subscriptions
 *   - subscription.list         GET   /publications/{pubId}/subscriptions
 *   - subscription.get          GET   /publications/{pubId}/subscriptions/{subId}
 *   - subscription.delete       DELETE /publications/{pubId}/subscriptions/{subId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.beehiiv.com/v2';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Beehiiv: apiKey is required');
  return { Authorization: `Bearer ${key}` };
}

function requirePub(ctx: ForgeActionContext): string {
  const pub = asString(ctx.options.publicationId);
  if (!pub) throw new Error('Beehiiv: publicationId is required');
  return pub;
}

async function subscriptionCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pub = requirePub(ctx);
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Beehiiv: email is required');
  const body: Record<string, unknown> = { email };
  const referringSite = asString(ctx.options.referringSite);
  const utmSource = asString(ctx.options.utmSource);
  const reactivate = asString(ctx.options.reactivate);
  if (referringSite) body.referring_site = referringSite;
  if (utmSource) body.utm_source = utmSource;
  if (reactivate) body.reactivate_existing = reactivate === 'true';
  const res = await apiRequest({
    service: 'Beehiiv',
    method: 'POST',
    url: `${API}/publications/${encodeURIComponent(pub)}/subscriptions`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { subscription: res.data }, logs: [`Beehiiv subscription create → ${email}`] };
}

async function subscriptionList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pub = requirePub(ctx);
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  const page = asString(ctx.options.page);
  if (limit) params.set('limit', limit);
  if (page) params.set('page', page);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Beehiiv',
    method: 'GET',
    url: `${API}/publications/${encodeURIComponent(pub)}/subscriptions${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { subscriptions: res.data }, logs: [`Beehiiv subscription list → ${pub}`] };
}

async function subscriptionGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pub = requirePub(ctx);
  const id = asString(ctx.options.subscriptionId);
  if (!id) throw new Error('Beehiiv: subscriptionId is required');
  const res = await apiRequest({
    service: 'Beehiiv',
    method: 'GET',
    url: `${API}/publications/${encodeURIComponent(pub)}/subscriptions/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { subscription: res.data }, logs: [`Beehiiv subscription get → ${id}`] };
}

async function subscriptionDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pub = requirePub(ctx);
  const id = asString(ctx.options.subscriptionId);
  if (!id) throw new Error('Beehiiv: subscriptionId is required');
  const res = await apiRequest({
    service: 'Beehiiv',
    method: 'DELETE',
    url: `${API}/publications/${encodeURIComponent(pub)}/subscriptions/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Beehiiv subscription delete → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_beehiiv',
  name: 'Beehiiv',
  description: 'Manage Beehiiv newsletter subscribers.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'subscription_create',
      label: 'Create subscription',
      description: 'Add a subscriber to a Beehiiv publication.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'publicationId', label: 'Publication ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'referringSite', label: 'Referring site', type: 'text' },
        { id: 'utmSource', label: 'UTM source', type: 'text' },
        { id: 'reactivate', label: 'Reactivate existing', type: 'text', placeholder: 'true' },
      ],
      run: subscriptionCreate,
    },
    {
      id: 'subscription_list',
      label: 'List subscriptions',
      description: 'List subscriptions in a publication.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'publicationId', label: 'Publication ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'page', label: 'Page', type: 'number' },
      ],
      run: subscriptionList,
    },
    {
      id: 'subscription_get',
      label: 'Get subscription',
      description: 'Fetch a single subscription by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'publicationId', label: 'Publication ID', type: 'text', required: true },
        { id: 'subscriptionId', label: 'Subscription ID', type: 'text', required: true },
      ],
      run: subscriptionGet,
    },
    {
      id: 'subscription_delete',
      label: 'Delete subscription',
      description: 'Remove a subscription by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'publicationId', label: 'Publication ID', type: 'text', required: true },
        { id: 'subscriptionId', label: 'Subscription ID', type: 'text', required: true },
      ],
      run: subscriptionDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
