/**
 * Forge block: QuickBooks Online
 *
 * Source: n8n-master/packages/nodes-base/nodes/QuickBooks/QuickBooks.node.ts
 *   (+ GenericFunctions.ts — production: https://quickbooks.api.intuit.com,
 *      sandbox: https://sandbox-quickbooks.api.intuit.com,
 *      paths: /v3/company/{companyId}/{resource}[/{id}])
 * Credential type: 'quickbooks' — expected fields:
 *   - accessToken  (OAuth2 access token)
 *   - companyId    (a.k.a. realmId)
 *   - sandbox      (optional "true"/"false")
 *
 * Limitation: This wave uses the stored `accessToken` directly. QuickBooks
 * access tokens expire after ~1 hour — OAuth2 refresh is out of scope for
 * this wave and will be added via a shared refresh helper later.
 *
 * Operations covered:
 *   - customer.get      GET    /customer/{id}
 *   - customer.create   POST   /customer
 *   - invoice.create    POST   /invoice
 *   - invoice.get       GET    /invoice/{id}
 *   - payment.create    POST   /payment
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asBoolean, asString, requireCredential } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const cred = requireCredential('QuickBooks', ctx.credential);
  const companyId = asString(cred.companyId || cred.realmId);
  if (!companyId) throw new Error('QuickBooks: credential is missing `companyId`');
  const root = asBoolean(cred.sandbox)
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';
  return `${root}/v3/company/${encodeURIComponent(companyId)}`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('QuickBooks', ctx.credential);
  const token = asString(cred.accessToken);
  if (!token) throw new Error('QuickBooks: credential is missing `accessToken`');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function qboApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'QuickBooks',
    method,
    url: `${baseUrl(ctx)}${path}`,
    headers: authHeaders(ctx),
    json,
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
  throw new Error(`QuickBooks: ${label} must be a JSON object`);
}

// ── Actions ────────────────────────────────────────────────────────────────

async function customerGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('QuickBooks: customerId is required');
  const data = (await qboApi(ctx, 'GET', `/customer/${encodeURIComponent(id)}`)) as { Customer?: unknown } | null;
  return { outputs: { customer: data?.Customer ?? data }, logs: [`QuickBooks customer get → ${id}`] };
}

async function customerCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const displayName = asString(ctx.options.displayName);
  if (!displayName) throw new Error('QuickBooks: displayName is required');
  const body: Record<string, unknown> = {
    DisplayName: displayName,
    GivenName: asString(ctx.options.givenName) || undefined,
    FamilyName: asString(ctx.options.familyName) || undefined,
    CompanyName: asString(ctx.options.companyName) || undefined,
  };
  const email = asString(ctx.options.email);
  if (email) body.PrimaryEmailAddr = { Address: email };
  const phone = asString(ctx.options.phone);
  if (phone) body.PrimaryPhone = { FreeFormNumber: phone };
  const extra = parseJsonObject(ctx.options.extra, 'extra');
  Object.assign(body, extra);

  const data = (await qboApi(ctx, 'POST', '/customer', body)) as { Customer?: { Id?: string } } | null;
  return {
    outputs: { customer: data?.Customer ?? null, id: data?.Customer?.Id ?? null },
    logs: [`QuickBooks customer create → ${data?.Customer?.Id ?? '?'}`],
  };
}

async function invoiceCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const customerId = asString(ctx.options.customerId);
  const amount = asString(ctx.options.amount);
  const itemId = asString(ctx.options.itemId);
  if (!customerId) throw new Error('QuickBooks: customerId is required');
  if (!amount) throw new Error('QuickBooks: amount is required');
  if (!itemId) throw new Error('QuickBooks: itemId is required');

  const body: Record<string, unknown> = {
    CustomerRef: { value: customerId },
    Line: [
      {
        DetailType: 'SalesItemLineDetail',
        Amount: Number(amount),
        SalesItemLineDetail: { ItemRef: { value: itemId } },
      },
    ],
  };
  const extra = parseJsonObject(ctx.options.extra, 'extra');
  Object.assign(body, extra);
  const data = (await qboApi(ctx, 'POST', '/invoice', body)) as { Invoice?: { Id?: string } } | null;
  return {
    outputs: { invoice: data?.Invoice ?? null, id: data?.Invoice?.Id ?? null },
    logs: [`QuickBooks invoice create → ${data?.Invoice?.Id ?? '?'}`],
  };
}

async function invoiceGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.invoiceId);
  if (!id) throw new Error('QuickBooks: invoiceId is required');
  const data = (await qboApi(ctx, 'GET', `/invoice/${encodeURIComponent(id)}`)) as { Invoice?: unknown } | null;
  return { outputs: { invoice: data?.Invoice ?? data }, logs: [`QuickBooks invoice get → ${id}`] };
}

async function paymentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const customerId = asString(ctx.options.customerId);
  const totalAmt = asString(ctx.options.totalAmt);
  if (!customerId) throw new Error('QuickBooks: customerId is required');
  if (!totalAmt) throw new Error('QuickBooks: totalAmt is required');

  const body: Record<string, unknown> = {
    CustomerRef: { value: customerId },
    TotalAmt: Number(totalAmt),
  };
  const invoiceId = asString(ctx.options.invoiceId);
  if (invoiceId) {
    body.Line = [
      {
        Amount: Number(totalAmt),
        LinkedTxn: [{ TxnId: invoiceId, TxnType: 'Invoice' }],
      },
    ];
  }
  const extra = parseJsonObject(ctx.options.extra, 'extra');
  Object.assign(body, extra);

  const data = (await qboApi(ctx, 'POST', '/payment', body)) as { Payment?: { Id?: string } } | null;
  return {
    outputs: { payment: data?.Payment ?? null, id: data?.Payment?.Id ?? null },
    logs: [`QuickBooks payment create → ${data?.Payment?.Id ?? '?'}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_quickbooks',
  name: 'QuickBooks Online',
  description: 'Manage QuickBooks Online customers, invoices and payments.',
  iconName: 'LuReceipt',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'quickbooks',
  },
  actions: [
    {
      id: 'customer_get',
      label: 'Get customer',
      description: 'Fetch a customer by id.',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
      ],
      run: customerGet,
    },
    {
      id: 'customer_create',
      label: 'Create customer',
      description: 'Create a new customer.',
      fields: [
        { id: 'displayName', label: 'Display name', type: 'text', required: true },
        { id: 'givenName', label: 'Given name', type: 'text' },
        { id: 'familyName', label: 'Family name', type: 'text' },
        { id: 'companyName', label: 'Company name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra body JSON (advanced)', type: 'json' },
      ],
      run: customerCreate,
    },
    {
      id: 'invoice_create',
      label: 'Create invoice',
      description: 'Create a single-line-item invoice.',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'itemId', label: 'Item ID', type: 'text', required: true },
        { id: 'amount', label: 'Amount', type: 'number', required: true },
        { id: 'extra', label: 'Extra body JSON (advanced)', type: 'json' },
      ],
      run: invoiceCreate,
    },
    {
      id: 'invoice_get',
      label: 'Get invoice',
      description: 'Fetch an invoice by id.',
      fields: [
        { id: 'invoiceId', label: 'Invoice ID', type: 'text', required: true },
      ],
      run: invoiceGet,
    },
    {
      id: 'payment_create',
      label: 'Create payment',
      description: 'Record a payment, optionally linked to an invoice.',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'totalAmt', label: 'Total amount', type: 'number', required: true },
        { id: 'invoiceId', label: 'Invoice ID to apply to (optional)', type: 'text' },
        { id: 'extra', label: 'Extra body JSON (advanced)', type: 'json' },
      ],
      run: paymentCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
