/**
 * Forge block: PayPal
 *
 * Source: n8n-master/packages/nodes-base/nodes/PayPal/PayPal.node.ts
 *   (+ GenericFunctions.ts — live: https://api-m.paypal.com, sandbox: https://api-m.sandbox.paypal.com)
 * Credential type: 'paypal' — expected fields:
 *   - accessToken  (OAuth2 access token; obtain via /v1/oauth2/token)
 *   - sandbox      (optional "true"/"false")
 *
 * Limitation: This wave uses the pre-fetched `accessToken` stored on the
 * credential. PayPal access tokens expire (~9 hours) — refresh is out of
 * scope here and will be added when the OAuth refresh helper lands.
 *
 * Operations covered:
 *   - payout.create   POST /v1/payments/payouts
 *   - order.create    POST /v2/checkout/orders
 *   - order.capture   POST /v2/checkout/orders/{id}/capture
 *   - order.get       GET  /v2/checkout/orders/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asBoolean, asString, requireCredential } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const cred = requireCredential('PayPal', ctx.credential);
  return asBoolean(cred.sandbox) ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('PayPal', ctx.credential);
  const token = asString(cred.accessToken);
  if (!token) throw new Error('PayPal: credential is missing `accessToken`');
  return { Authorization: `Bearer ${token}` };
}

async function paypalApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'PayPal',
    method,
    url: `${baseUrl(ctx)}${path}`,
    headers: authHeaders(ctx),
    json: json ?? (method === 'POST' ? {} : undefined),
  });
  return res.data;
}

function parseJsonObject(raw: unknown, label: string): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`PayPal: ${label} must be a JSON object`);
}

// ── Actions ────────────────────────────────────────────────────────────────

async function payoutCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const receiver = asString(ctx.options.receiver);
  const amount = asString(ctx.options.amount);
  const currency = asString(ctx.options.currency);
  const emailSubject = asString(ctx.options.emailSubject) || 'You have a payout!';
  if (!receiver) throw new Error('PayPal: receiver email is required');
  if (!amount) throw new Error('PayPal: amount is required');
  if (!currency) throw new Error('PayPal: currency is required');

  const body = {
    sender_batch_header: {
      sender_batch_id: `batch-${Date.now()}`,
      email_subject: emailSubject,
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: { value: amount, currency: currency.toUpperCase() },
        receiver,
        note: asString(ctx.options.note) || undefined,
      },
    ],
  };
  const data = (await paypalApi(ctx, 'POST', '/v1/payments/payouts', body)) as {
    batch_header?: { payout_batch_id?: string };
  } | null;
  return {
    outputs: { payout: data, batchId: data?.batch_header?.payout_batch_id ?? null },
    logs: [`PayPal payout create → ${data?.batch_header?.payout_batch_id ?? '?'}`],
  };
}

async function orderCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const amount = asString(ctx.options.amount);
  const currency = asString(ctx.options.currency);
  const intent = asString(ctx.options.intent) || 'CAPTURE';
  if (!amount) throw new Error('PayPal: amount is required');
  if (!currency) throw new Error('PayPal: currency is required');

  const body: Record<string, unknown> = {
    intent,
    purchase_units: [
      {
        amount: { currency_code: currency.toUpperCase(), value: amount },
        description: asString(ctx.options.description) || undefined,
      },
    ],
  };
  const extra = parseJsonObject(ctx.options.extra, 'extra');
  Object.assign(body, extra);

  const data = (await paypalApi(ctx, 'POST', '/v2/checkout/orders', body)) as { id?: string } | null;
  return { outputs: { order: data, id: data?.id ?? null }, logs: [`PayPal order create → ${data?.id ?? '?'}`] };
}

async function orderCapture(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orderId);
  if (!id) throw new Error('PayPal: orderId is required');
  const data = await paypalApi(ctx, 'POST', `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {});
  return { outputs: { capture: data }, logs: [`PayPal order capture → ${id}`] };
}

async function orderGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orderId);
  if (!id) throw new Error('PayPal: orderId is required');
  const data = await paypalApi(ctx, 'GET', `/v2/checkout/orders/${encodeURIComponent(id)}`);
  return { outputs: { order: data }, logs: [`PayPal order get → ${id}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_paypal',
  name: 'PayPal',
  description: 'Create PayPal payouts and manage Checkout orders.',
  iconName: 'LuCreditCard',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'paypal',
  },
  actions: [
    {
      id: 'payout_create',
      label: 'Create payout',
      description: 'Send a single-item payout to an email recipient.',
      fields: [
        { id: 'receiver', label: 'Recipient email', type: 'text', required: true },
        { id: 'amount', label: 'Amount (e.g. "10.00")', type: 'text', required: true },
        { id: 'currency', label: 'Currency (ISO 4217)', type: 'text', required: true, placeholder: 'USD' },
        { id: 'emailSubject', label: 'Email subject', type: 'text' },
        { id: 'note', label: 'Note to recipient', type: 'textarea' },
      ],
      run: payoutCreate,
    },
    {
      id: 'order_create',
      label: 'Create order',
      description: 'Create a Checkout order with one purchase unit.',
      fields: [
        { id: 'amount', label: 'Amount (e.g. "10.00")', type: 'text', required: true },
        { id: 'currency', label: 'Currency (ISO 4217)', type: 'text', required: true, placeholder: 'USD' },
        {
          id: 'intent',
          label: 'Intent',
          type: 'select',
          defaultValue: 'CAPTURE',
          options: [
            { label: 'Capture', value: 'CAPTURE' },
            { label: 'Authorize', value: 'AUTHORIZE' },
          ],
        },
        { id: 'description', label: 'Description', type: 'text' },
        { id: 'extra', label: 'Extra body JSON (advanced)', type: 'json' },
      ],
      run: orderCreate,
    },
    {
      id: 'order_capture',
      label: 'Capture order',
      description: 'Capture funds on an approved order.',
      fields: [
        { id: 'orderId', label: 'Order ID', type: 'text', required: true },
      ],
      run: orderCapture,
    },
    {
      id: 'order_get',
      label: 'Get order',
      description: 'Fetch an order by id.',
      fields: [
        { id: 'orderId', label: 'Order ID', type: 'text', required: true },
      ],
      run: orderGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
