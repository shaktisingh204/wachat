/**
 * Forge block: Xero
 *
 * Source: n8n-master/packages/nodes-base/nodes/Xero/Xero.node.ts
 *   (+ GenericFunctions.ts — base: https://api.xero.com/api.xro/2.0)
 * Credential type: 'xero' — expected fields:
 *   - accessToken  (OAuth2 access token)
 *   - tenantId     (Xero-Tenant-Id header)
 *
 * Limitation: This wave uses the stored `accessToken` directly. Xero access
 * tokens expire after 30 minutes — refresh is out of scope for this wave and
 * will be wired via a shared refresh helper later.
 *
 * Operations covered:
 *   - invoice.create  POST /Invoices
 *   - invoice.get     GET  /Invoices/{invoiceId}
 *   - contact.create  POST /Contacts
 *   - contact.get     GET  /Contacts/{contactId}
 *   - payment.create  PUT  /Payments
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.xero.com/api.xro/2.0';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Xero', ctx.credential);
  const token = asString(cred.accessToken);
  const tenantId = asString(cred.tenantId);
  if (!token) throw new Error('Xero: credential is missing `accessToken`');
  if (!tenantId) throw new Error('Xero: credential is missing `tenantId`');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Xero-Tenant-Id': tenantId,
  };
}

async function xeroApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Xero',
    method,
    url: `${BASE}${path}`,
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
  throw new Error(`Xero: ${label} must be a JSON object`);
}

function parseJsonArray(raw: unknown, label: string): unknown[] {
  const s = asString(raw).trim();
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) return v;
  } catch {
    /* ignore */
  }
  throw new Error(`Xero: ${label} must be a JSON array`);
}

// ── Actions ────────────────────────────────────────────────────────────────

async function invoiceCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const type = asString(ctx.options.type) || 'ACCREC';
  if (!contactId) throw new Error('Xero: contactId is required');

  const lineItems = parseJsonArray(ctx.options.lineItems, 'lineItems');
  if (lineItems.length === 0) {
    throw new Error('Xero: lineItems must contain at least one line item');
  }

  const invoice: Record<string, unknown> = {
    Type: type,
    Contact: { ContactID: contactId },
    LineItems: lineItems,
    Status: asString(ctx.options.status) || undefined,
    Reference: asString(ctx.options.reference) || undefined,
    Date: asString(ctx.options.date) || undefined,
    DueDate: asString(ctx.options.dueDate) || undefined,
  };
  const extra = parseJsonObject(ctx.options.extra, 'extra');
  Object.assign(invoice, extra);

  const data = (await xeroApi(ctx, 'POST', '/Invoices', { Invoices: [invoice] })) as {
    Invoices?: Array<{ InvoiceID?: string }>;
  } | null;
  const created = data?.Invoices?.[0] ?? null;
  return {
    outputs: { invoice: created, id: created?.InvoiceID ?? null },
    logs: [`Xero invoice create → ${created?.InvoiceID ?? '?'}`],
  };
}

async function invoiceGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.invoiceId);
  if (!id) throw new Error('Xero: invoiceId is required');
  const data = (await xeroApi(ctx, 'GET', `/Invoices/${encodeURIComponent(id)}`)) as {
    Invoices?: unknown[];
  } | null;
  return { outputs: { invoice: data?.Invoices?.[0] ?? null }, logs: [`Xero invoice get → ${id}`] };
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Xero: name is required');
  const contact: Record<string, unknown> = {
    Name: name,
    EmailAddress: asString(ctx.options.email) || undefined,
    FirstName: asString(ctx.options.firstName) || undefined,
    LastName: asString(ctx.options.lastName) || undefined,
  };
  const extra = parseJsonObject(ctx.options.extra, 'extra');
  Object.assign(contact, extra);

  const data = (await xeroApi(ctx, 'POST', '/Contacts', { Contacts: [contact] })) as {
    Contacts?: Array<{ ContactID?: string }>;
  } | null;
  const created = data?.Contacts?.[0] ?? null;
  return {
    outputs: { contact: created, id: created?.ContactID ?? null },
    logs: [`Xero contact create → ${created?.ContactID ?? '?'}`],
  };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Xero: contactId is required');
  const data = (await xeroApi(ctx, 'GET', `/Contacts/${encodeURIComponent(id)}`)) as {
    Contacts?: unknown[];
  } | null;
  return { outputs: { contact: data?.Contacts?.[0] ?? null }, logs: [`Xero contact get → ${id}`] };
}

async function paymentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const invoiceId = asString(ctx.options.invoiceId);
  const accountId = asString(ctx.options.accountId);
  const amount = asString(ctx.options.amount);
  const date = asString(ctx.options.date);
  if (!invoiceId) throw new Error('Xero: invoiceId is required');
  if (!accountId) throw new Error('Xero: accountId is required');
  if (!amount) throw new Error('Xero: amount is required');
  if (!date) throw new Error('Xero: date is required (YYYY-MM-DD)');

  const payment: Record<string, unknown> = {
    Invoice: { InvoiceID: invoiceId },
    Account: { AccountID: accountId },
    Date: date,
    Amount: Number(amount),
  };
  const data = (await xeroApi(ctx, 'PUT', '/Payments', { Payments: [payment] })) as {
    Payments?: Array<{ PaymentID?: string }>;
  } | null;
  const created = data?.Payments?.[0] ?? null;
  return {
    outputs: { payment: created, id: created?.PaymentID ?? null },
    logs: [`Xero payment create → ${created?.PaymentID ?? '?'}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_xero',
  name: 'Xero',
  description: 'Manage Xero invoices, contacts and payments.',
  iconName: 'LuReceipt',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'xero',
  },
  actions: [
    {
      id: 'invoice_create',
      label: 'Create invoice',
      description: 'Create an invoice for a contact with line items.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        {
          id: 'type',
          label: 'Type',
          type: 'select',
          defaultValue: 'ACCREC',
          options: [
            { label: 'Accounts Receivable (Sales)', value: 'ACCREC' },
            { label: 'Accounts Payable (Bills)', value: 'ACCPAY' },
          ],
        },
        {
          id: 'lineItems',
          label: 'Line items (JSON array)',
          type: 'json',
          required: true,
          helperText: 'e.g. [{"Description":"Item","Quantity":1,"UnitAmount":10,"AccountCode":"200"}]',
        },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: '—', value: '' },
            { label: 'Draft', value: 'DRAFT' },
            { label: 'Submitted', value: 'SUBMITTED' },
            { label: 'Authorised', value: 'AUTHORISED' },
          ],
        },
        { id: 'reference', label: 'Reference', type: 'text' },
        { id: 'date', label: 'Date (YYYY-MM-DD)', type: 'text' },
        { id: 'dueDate', label: 'Due date (YYYY-MM-DD)', type: 'text' },
        { id: 'extra', label: 'Extra invoice JSON (advanced)', type: 'json' },
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
      id: 'contact_create',
      label: 'Create contact',
      description: 'Create a contact.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'extra', label: 'Extra contact JSON (advanced)', type: 'json' },
      ],
      run: contactCreate,
    },
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by id.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
      ],
      run: contactGet,
    },
    {
      id: 'payment_create',
      label: 'Create payment',
      description: 'Apply a payment to an invoice from a bank/payment account.',
      fields: [
        { id: 'invoiceId', label: 'Invoice ID', type: 'text', required: true },
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
        { id: 'amount', label: 'Amount', type: 'number', required: true },
        { id: 'date', label: 'Date (YYYY-MM-DD)', type: 'text', required: true },
      ],
      run: paymentCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
