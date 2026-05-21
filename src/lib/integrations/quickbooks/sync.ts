/**
 * QuickBooks Online — sync orchestration.
 *
 * Push side only (SabNode → QuickBooks):
 *   - {@link syncClientToQuickBooks}  — one CRM account → QBO Customer
 *   - {@link syncInvoiceToQuickBooks} — one CRM invoice → QBO Invoice
 *   - {@link syncAllClients}          — every un-synced account
 *   - {@link syncAllInvoices}         — every un-synced invoice
 *
 * Mapping notes:
 *   - The CRM's "Clients & Prospects" page is backed by the
 *     `crm_accounts` collection in this codebase. The brief references
 *     `crm_clients` for the back-link field, but the actual collection is
 *     `crm_accounts`; we read from `crm_accounts` and store the QBO id
 *     back on the same document as `quickbooks_customer_id`. If a
 *     dedicated `crm_clients` collection exists, it's used as a fallback.
 */
import 'server-only';

import { ObjectId, type Filter, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { qboFetch, QuickBooksApiError, QuickBooksAuthError } from './api';
import { appendSyncLog, upsertSettings } from './db';
import type {
  SingleSyncResult,
  SyncResult,
} from './types';

/* ── Mongo-shape helpers (loose because both collection shapes are
 *   read at runtime, not always strictly typed). ───────────────────────── */

interface ClientLike {
  _id: ObjectId;
  userId: ObjectId;
  name?: string;
  displayName?: string;
  company?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  address?: string;
  billingAddress?: string;
  shippingAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  postalCode?: string;
  gstin?: string;
  currency?: string;
  quickbooks_customer_id?: string;
}

interface InvoiceLike {
  _id: ObjectId;
  userId: ObjectId;
  accountId?: ObjectId;
  clientId?: ObjectId;
  invoiceNumber: string;
  invoiceDate?: Date;
  dueDate?: Date;
  lineItems: Array<{
    id?: string;
    name?: string;
    description?: string;
    quantity?: number;
    rate?: number;
  }>;
  currency?: string;
  total?: number;
  subtotal?: number;
  notes?: string;
  quickbooks_invoice_id?: string;
}

/* ── Collection selection ─────────────────────────────────────────────── */

const CLIENT_COLLECTIONS = ['crm_clients', 'crm_accounts'] as const;
type ClientCollection = (typeof CLIENT_COLLECTIONS)[number];

/**
 * Pick the first collection that actually has a row for this tenant.
 * Falls back to `crm_accounts` (the canonical clients table in this
 * codebase) when neither has data.
 */
async function pickClientCollection(
  userId: ObjectId,
): Promise<ClientCollection> {
  const { db } = await connectToDatabase();
  for (const name of CLIENT_COLLECTIONS) {
    try {
      const exists = await db.collection(name).findOne({ userId });
      if (exists) return name;
    } catch {
      // Collection might not exist yet — skip.
    }
  }
  return 'crm_accounts';
}

/* ── Mapping ──────────────────────────────────────────────────────────── */

function buildCustomerPayload(client: ClientLike): Record<string, unknown> {
  const displayName =
    client.displayName ??
    client.name ??
    client.company ??
    `Client ${String(client._id)}`;

  const payload: Record<string, unknown> = {
    DisplayName: displayName,
  };
  if (client.email) {
    payload.PrimaryEmailAddr = { Address: client.email };
  }
  const phone = client.phone ?? client.mobile;
  if (phone) {
    payload.PrimaryPhone = { FreeFormNumber: phone };
  }
  if (client.company) payload.CompanyName = client.company;
  if (client.website) payload.WebAddr = { URI: client.website };

  const line1 = client.billingAddress ?? client.address;
  if (line1 || client.city || client.state || client.country) {
    const billAddr: Record<string, unknown> = {};
    if (line1) billAddr.Line1 = line1;
    if (client.city) billAddr.City = client.city;
    if (client.state) billAddr.CountrySubDivisionCode = client.state;
    if (client.country) billAddr.Country = client.country;
    const postal = client.pincode ?? client.postalCode;
    if (postal) billAddr.PostalCode = postal;
    payload.BillAddr = billAddr;
  }

  return payload;
}

function buildInvoicePayload(args: {
  invoice: InvoiceLike;
  quickbooksCustomerId: string;
}): Record<string, unknown> {
  const { invoice, quickbooksCustomerId } = args;
  const lines: Record<string, unknown>[] = (invoice.lineItems ?? []).map(
    (li) => {
      const qty = Number(li.quantity ?? 1);
      const rate = Number(li.rate ?? 0);
      const amount = Number((qty * rate).toFixed(2));
      return {
        DetailType: 'SalesItemLineDetail',
        Amount: amount,
        Description: li.description ?? li.name ?? undefined,
        SalesItemLineDetail: {
          // QBO requires an ItemRef; "1" is the default Services item that
          // every QBO sandbox/production company has out of the box. Admins
          // can re-map this later via QBO's UI.
          ItemRef: { value: '1' },
          Qty: qty,
          UnitPrice: rate,
        },
      };
    },
  );

  if (lines.length === 0) {
    // QBO rejects invoices with zero lines — synthesize a single line from
    // the invoice total so the push still succeeds.
    const total = Number(invoice.total ?? invoice.subtotal ?? 0);
    lines.push({
      DetailType: 'SalesItemLineDetail',
      Amount: total,
      Description: invoice.notes ?? invoice.invoiceNumber,
      SalesItemLineDetail: {
        ItemRef: { value: '1' },
        Qty: 1,
        UnitPrice: total,
      },
    });
  }

  const payload: Record<string, unknown> = {
    Line: lines,
    CustomerRef: { value: quickbooksCustomerId },
    DocNumber: invoice.invoiceNumber,
  };
  if (invoice.dueDate) {
    payload.DueDate = toIsoDate(invoice.dueDate);
  }
  if (invoice.invoiceDate) {
    payload.TxnDate = toIsoDate(invoice.invoiceDate);
  }
  if (invoice.currency) {
    payload.CurrencyRef = { value: invoice.currency };
  }
  if (invoice.notes) {
    payload.CustomerMemo = { value: invoice.notes.slice(0, 1000) };
  }
  return payload;
}

function toIsoDate(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

/* ── QBO response shapes ─────────────────────────────────────────────── */

interface QboCustomerResponse {
  Customer: { Id: string };
}
interface QboInvoiceResponse {
  Invoice: { Id: string };
}

/* ── Single-entity sync ──────────────────────────────────────────────── */

export async function syncClientToQuickBooks(
  userId: string,
  clientId: string,
): Promise<SingleSyncResult> {
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(clientId)) {
    return { ok: false, error: 'Invalid id' };
  }
  const uid = new ObjectId(userId);
  const cid = new ObjectId(clientId);

  try {
    const { db } = await connectToDatabase();
    const coll = await pickClientCollection(uid);
    const client = (await db
      .collection<ClientLike>(coll)
      .findOne({ _id: cid, userId: uid })) as ClientLike | null;
    if (!client) {
      await appendSyncLog(uid, {
        action: 'sync',
        entity: 'client',
        status: 'failure',
        refId: clientId,
        error: 'Client not found',
      });
      return { ok: false, error: 'Client not found' };
    }

    // Already synced? PATCH would require a sparse-update flow; for the
    // first cut we treat existing IDs as idempotent success.
    if (client.quickbooks_customer_id) {
      return { ok: true, quickbooksId: client.quickbooks_customer_id };
    }

    const payload = buildCustomerPayload(client);
    const res = await qboFetch<QboCustomerResponse>({
      userId: uid,
      path: '/customer',
      method: 'POST',
      body: payload,
    });
    const qbId = res?.Customer?.Id;
    if (!qbId) {
      throw new Error('QuickBooks response missing Customer.Id');
    }
    await db
      .collection(coll)
      .updateOne(
        { _id: cid, userId: uid },
        { $set: { quickbooks_customer_id: qbId, updatedAt: new Date() } },
      );
    await upsertSettings(uid, { lastSync: new Date() });
    await appendSyncLog(uid, {
      action: 'sync',
      entity: 'client',
      status: 'success',
      refId: clientId,
      quickbooksId: qbId,
    });
    return { ok: true, quickbooksId: qbId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[quickbooks/sync] syncClient failed:', msg);
    await appendSyncLog(uid, {
      action: 'sync',
      entity: 'client',
      status: 'failure',
      refId: clientId,
      error: msg.slice(0, 500),
    });
    return { ok: false, error: msg };
  }
}

export async function syncInvoiceToQuickBooks(
  userId: string,
  invoiceId: string,
): Promise<SingleSyncResult> {
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(invoiceId)) {
    return { ok: false, error: 'Invalid id' };
  }
  const uid = new ObjectId(userId);
  const iid = new ObjectId(invoiceId);

  try {
    const { db } = await connectToDatabase();
    const invoice = (await db
      .collection<InvoiceLike>('crm_invoices')
      .findOne({ _id: iid, userId: uid })) as InvoiceLike | null;
    if (!invoice) {
      await appendSyncLog(uid, {
        action: 'sync',
        entity: 'invoice',
        status: 'failure',
        refId: invoiceId,
        error: 'Invoice not found',
      });
      return { ok: false, error: 'Invoice not found' };
    }
    if (invoice.quickbooks_invoice_id) {
      return { ok: true, quickbooksId: invoice.quickbooks_invoice_id };
    }

    // Resolve the linked client and make sure it's already in QBO.
    const clientLinkId = invoice.accountId ?? invoice.clientId;
    if (!clientLinkId) {
      throw new Error('Invoice has no linked client/account');
    }
    const clientColl = await pickClientCollection(uid);
    const client = (await db
      .collection<ClientLike>(clientColl)
      .findOne({ _id: clientLinkId, userId: uid })) as ClientLike | null;
    if (!client) {
      throw new Error('Linked client not found in CRM');
    }

    let qbCustomerId = client.quickbooks_customer_id;
    if (!qbCustomerId) {
      // Auto-push the customer first so the invoice has somewhere to land.
      const clientRes = await syncClientToQuickBooks(
        userId,
        String(client._id),
      );
      if (!clientRes.ok || !clientRes.quickbooksId) {
        throw new Error(
          `Linked client not synced to QuickBooks: ${clientRes.error ?? 'unknown error'}`,
        );
      }
      qbCustomerId = clientRes.quickbooksId;
    }

    const payload = buildInvoicePayload({
      invoice,
      quickbooksCustomerId: qbCustomerId,
    });
    const res = await qboFetch<QboInvoiceResponse>({
      userId: uid,
      path: '/invoice',
      method: 'POST',
      body: payload,
    });
    const qbId = res?.Invoice?.Id;
    if (!qbId) {
      throw new Error('QuickBooks response missing Invoice.Id');
    }
    await db
      .collection('crm_invoices')
      .updateOne(
        { _id: iid, userId: uid },
        { $set: { quickbooks_invoice_id: qbId, updatedAt: new Date() } },
      );
    await upsertSettings(uid, { lastSync: new Date() });
    await appendSyncLog(uid, {
      action: 'sync',
      entity: 'invoice',
      status: 'success',
      refId: invoiceId,
      quickbooksId: qbId,
    });
    return { ok: true, quickbooksId: qbId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[quickbooks/sync] syncInvoice failed:', msg);
    await appendSyncLog(uid, {
      action: 'sync',
      entity: 'invoice',
      status: 'failure',
      refId: invoiceId,
      error: msg.slice(0, 500),
    });
    return { ok: false, error: msg };
  }
}

/* ── Bulk sync ───────────────────────────────────────────────────────── */

const BULK_MAX = 250;

export async function syncAllClients(userId: string): Promise<SyncResult> {
  if (!ObjectId.isValid(userId)) {
    return { ok: 0, failed: 0, errors: [{ id: userId, message: 'Invalid userId' }] };
  }
  const uid = new ObjectId(userId);
  const { db } = await connectToDatabase();
  const coll = await pickClientCollection(uid);

  // `$exists: false` covers both "missing field" and explicit null at the
  // Mongo level — combine with the empty-string case.
  const filter = {
    userId: uid,
    $or: [
      { quickbooks_customer_id: { $exists: false } },
      { quickbooks_customer_id: '' },
    ],
  } as Filter<ClientLike>;

  let candidates: WithId<ClientLike>[] = [];
  try {
    candidates = (await db
      .collection<ClientLike>(coll)
      .find(filter)
      .limit(BULK_MAX)
      .toArray()) as WithId<ClientLike>[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: 0, failed: 0, errors: [{ id: 'query', message: msg }] };
  }

  let ok = 0;
  let failed = 0;
  const errors: Array<{ id: string; message: string }> = [];
  for (const c of candidates) {
    const res = await syncClientToQuickBooks(userId, String(c._id));
    if (res.ok) {
      ok += 1;
    } else {
      failed += 1;
      errors.push({ id: String(c._id), message: res.error ?? 'unknown error' });
      // Stop on auth-style errors to avoid hammering the API.
      if (
        res.error &&
        (res.error.toLowerCase().includes('re-authentication') ||
          res.error.toLowerCase().includes('not connected'))
      ) {
        break;
      }
    }
  }
  return { ok, failed, errors };
}

export async function syncAllInvoices(userId: string): Promise<SyncResult> {
  if (!ObjectId.isValid(userId)) {
    return { ok: 0, failed: 0, errors: [{ id: userId, message: 'Invalid userId' }] };
  }
  const uid = new ObjectId(userId);
  const { db } = await connectToDatabase();

  const filter = {
    userId: uid,
    $or: [
      { quickbooks_invoice_id: { $exists: false } },
      { quickbooks_invoice_id: '' },
    ],
  } as Filter<InvoiceLike>;

  let candidates: WithId<InvoiceLike>[] = [];
  try {
    candidates = (await db
      .collection<InvoiceLike>('crm_invoices')
      .find(filter)
      .limit(BULK_MAX)
      .toArray()) as WithId<InvoiceLike>[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: 0, failed: 0, errors: [{ id: 'query', message: msg }] };
  }

  let ok = 0;
  let failed = 0;
  const errors: Array<{ id: string; message: string }> = [];
  for (const inv of candidates) {
    const res = await syncInvoiceToQuickBooks(userId, String(inv._id));
    if (res.ok) {
      ok += 1;
    } else {
      failed += 1;
      errors.push({ id: String(inv._id), message: res.error ?? 'unknown error' });
      if (
        res.error &&
        (res.error.toLowerCase().includes('re-authentication') ||
          res.error.toLowerCase().includes('not connected'))
      ) {
        break;
      }
    }
  }
  return { ok, failed, errors };
}

/* ── Auto-sync helper (fire-and-forget for action callers) ───────────── */

/**
 * Fire-and-forget client push if the tenant has `autoSync` enabled.
 * Safe to call from anywhere — never throws.
 */
export async function maybeAutoSyncClient(
  userId: string,
  clientId: string,
): Promise<void> {
  try {
    if (!ObjectId.isValid(userId)) return;
    const { db } = await connectToDatabase();
    const setting = await db
      .collection('crm_quickbooks_settings')
      .findOne({ userId: new ObjectId(userId) });
    if (!setting || !setting.connected || !setting.autoSync) return;
    // Don't await — fire-and-forget so the save action returns instantly.
    void syncClientToQuickBooks(userId, clientId).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        err instanceof QuickBooksAuthError ||
        err instanceof QuickBooksApiError
      ) {
        console.error('[quickbooks/autoSync] client push:', msg);
      } else {
        console.error('[quickbooks/autoSync] client push (unknown):', msg);
      }
    });
  } catch (err) {
    console.error('[quickbooks/autoSync] client guard failed:', err);
  }
}

export async function maybeAutoSyncInvoice(
  userId: string,
  invoiceId: string,
): Promise<void> {
  try {
    if (!ObjectId.isValid(userId)) return;
    const { db } = await connectToDatabase();
    const setting = await db
      .collection('crm_quickbooks_settings')
      .findOne({ userId: new ObjectId(userId) });
    if (!setting || !setting.connected || !setting.autoSync) return;
    void syncInvoiceToQuickBooks(userId, invoiceId).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[quickbooks/autoSync] invoice push:', msg);
    });
  } catch (err) {
    console.error('[quickbooks/autoSync] invoice guard failed:', err);
  }
}
