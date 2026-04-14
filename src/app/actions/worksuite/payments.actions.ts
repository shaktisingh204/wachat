'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import {
  hrList,
  hrGetById,
  hrSave,
  hrDelete,
  formToObject,
  requireSession,
  serialize,
} from '@/lib/hr-crud';
import type {
  WsPayment,
  WsPaymentGateway,
  WsPaymentStatus,
  WsPaymentGatewayCredential,
  WsOfflinePaymentMethod,
  WsBankTransactionExt,
  WsBankTransactionType,
  WsInvoicePaymentDetail,
} from '@/lib/worksuite/payments-types';

/**
 * Worksuite payments actions — ported from the Worksuite PHP/Laravel
 * project.
 *
 * Collections:
 *   crm_payments,
 *   crm_payment_gateway_credentials,
 *   crm_offline_payment_methods,
 *   crm_bank_transactions_ext,
 *   crm_invoice_payment_details.
 *
 * Note: `crm_bank_accounts` already exists — `saveBankAccountExt`
 * patches the extra worksuite fields onto that same record.
 */

type FormState = { message?: string; error?: string; id?: string };

const OK_PAYMENTS = '/dashboard/crm/sales/payments';
const OK_GATEWAYS = '/dashboard/crm/settings/payment-gateways';
const OK_OFFLINE = '/dashboard/crm/settings/offline-payment-methods';
const OK_PUBLIC_PAY = '/dashboard/crm/settings/public-payment';
const OK_BANK_TX = '/dashboard/crm/banking/bank-transactions';
const OK_BANK_ACC = '/dashboard/crm/banking/bank-accounts';
const OK_INVOICES = '/dashboard/crm/sales/invoices';

/* ─── Helpers ──────────────────────────────────────────────────── */

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'off' || s === 'no' || s === '') {
      return false;
    }
  }
  return fallback;
}

function parseJsonField<T>(
  data: Record<string, any>,
  key: string,
): T | undefined {
  const v = data[key];
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'object') return v as T;
  try {
    return JSON.parse(v as string) as T;
  } catch {
    return undefined;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Payments
 * ══════════════════════════════════════════════════════════════ */

import type { ListPaymentsFilter } from '@/lib/worksuite/payments-types';

export async function getPayments(filter: ListPaymentsFilter = {}) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const mongoFilter: Record<string, any> = {
    userId: new ObjectId(user._id),
  };
  if (filter.clientId && ObjectId.isValid(filter.clientId)) {
    mongoFilter.client_id = new ObjectId(filter.clientId);
  }
  if (filter.invoiceId && ObjectId.isValid(filter.invoiceId)) {
    mongoFilter.invoice_id = new ObjectId(filter.invoiceId);
  }
  if (filter.gateway) mongoFilter.gateway = filter.gateway;
  if (filter.status) mongoFilter.status = filter.status;
  if (filter.from || filter.to) {
    const range: Record<string, Date> = {};
    if (filter.from) range.$gte = new Date(filter.from);
    if (filter.to) range.$lte = new Date(filter.to);
    mongoFilter.paid_on = range;
  }

  const docs = await db
    .collection('crm_payments')
    .find(mongoFilter)
    .sort({ paid_on: -1 })
    .toArray();
  return serialize(docs);
}

export async function getPaymentById(id: string) {
  return hrGetById<WsPayment>('crm_payments', id);
}

export async function getPaymentsForInvoice(invoiceId: string) {
  const user = await requireSession();
  if (!user || !ObjectId.isValid(invoiceId)) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection('crm_payments')
    .find({
      userId: new ObjectId(user._id),
      invoice_id: new ObjectId(invoiceId),
    })
    .sort({ paid_on: -1 })
    .toArray();
  return serialize(docs);
}

export async function getOutstandingBalance(
  invoiceId: string,
): Promise<{ total: number; paid: number; outstanding: number; currency: string }> {
  const user = await requireSession();
  const zero = { total: 0, paid: 0, outstanding: 0, currency: 'INR' };
  if (!user || !ObjectId.isValid(invoiceId)) return zero;
  const { db } = await connectToDatabase();
  const userOid = new ObjectId(user._id);

  const invoice = await db
    .collection('crm_invoices')
    .findOne({ _id: new ObjectId(invoiceId), userId: userOid });
  if (!invoice) return zero;

  const payments = await db
    .collection('crm_payments')
    .find({
      userId: userOid,
      invoice_id: new ObjectId(invoiceId),
      status: 'completed',
    })
    .toArray();

  const paid = payments.reduce(
    (s, p: any) => s + toNumber(p.amount, 0) - toNumber(p.refunded_amount, 0),
    0,
  );
  const total = toNumber((invoice as any).total, 0);

  return {
    total,
    paid,
    outstanding: Math.max(0, total - paid),
    currency: (invoice as any).currency || 'INR',
  };
}

async function updateInvoicePaymentStatus(
  invoiceId: ObjectId,
  userOid: ObjectId,
): Promise<{ total: number; paid: number; status: string }> {
  const { db } = await connectToDatabase();
  const invoice = await db
    .collection('crm_invoices')
    .findOne({ _id: invoiceId, userId: userOid });
  if (!invoice) return { total: 0, paid: 0, status: 'Unknown' };

  const payments = await db
    .collection('crm_payments')
    .find({
      userId: userOid,
      invoice_id: invoiceId,
      status: 'completed',
    })
    .toArray();

  const paid = payments.reduce(
    (s, p: any) => s + toNumber(p.amount, 0) - toNumber(p.refunded_amount, 0),
    0,
  );
  const total = toNumber((invoice as any).total, 0);

  let status: string;
  if (paid <= 0) status = (invoice as any).status || 'Unpaid';
  else if (paid < total) status = 'Partially Paid';
  else status = 'Paid';

  await db.collection('crm_invoices').updateOne(
    { _id: invoiceId, userId: userOid },
    { $set: { status, amount_paid: paid, updatedAt: new Date() } },
  );

  return { total, paid, status };
}

export async function savePayment(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const data = formToObject(formData, ['amount', 'refunded_amount']);

    const payload: Record<string, any> = {
      _id: data._id,
      invoice_id: data.invoice_id || undefined,
      invoice_number: data.invoice_number || '',
      client_id: data.client_id || undefined,
      client_name: data.client_name || '',
      amount: toNumber(data.amount, 0),
      currency: (data.currency as string) || 'INR',
      paid_on: data.paid_on || new Date().toISOString(),
      transaction_id: data.transaction_id || '',
      gateway: (data.gateway as WsPaymentGateway) || 'manual',
      offline_method_id: data.offline_method_id || undefined,
      status: (data.status as WsPaymentStatus) || 'completed',
      remarks: data.remarks || '',
      bank_account_id: data.bank_account_id || undefined,
    };

    const res = await hrSave('crm_payments', payload, {
      idFields: [
        'invoice_id',
        'client_id',
        'offline_method_id',
        'bank_account_id',
      ],
      dateFields: ['paid_on'],
    });
    if (res.error) return { error: res.error };
    revalidatePath(OK_PAYMENTS);
    return { message: 'Payment saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save payment' };
  }
}

export async function deletePayment(id: string) {
  const user = await requireSession();
  const r = await hrDelete('crm_payments', id);
  if (r.success && user && ObjectId.isValid(id)) {
    const { db } = await connectToDatabase();
    const userOid = new ObjectId(user._id);
    await db.collection('crm_invoice_payment_details').deleteMany({
      payment_id: new ObjectId(id),
      userId: userOid,
    });
  }
  revalidatePath(OK_PAYMENTS);
  return r;
}

interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  gateway: WsPaymentGateway;
  paidOn?: string;
  transactionId?: string;
  bankAccountId?: string;
  offlineMethodId?: string;
  remarks?: string;
  currency?: string;
  /** Whether to create a matching bank transaction in the ext ledger. */
  createBankTransaction?: boolean;
}

/**
 * Record a payment against an invoice. Creates:
 *   1. A `crm_payments` document
 *   2. A `crm_invoice_payment_details` entry
 *   3. (optional) a `crm_bank_transactions_ext` deposit
 *   4. Updates `crm_invoices.status` to reflect Paid / Partially Paid.
 */
export async function recordPayment(
  input: RecordPaymentInput,
): Promise<{ paymentId?: string; error?: string; status?: string }> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(input.invoiceId))
    return { error: 'Invalid invoice id' };
  if (!(input.amount > 0)) return { error: 'Amount must be greater than zero' };

  const { db } = await connectToDatabase();
  const userOid = new ObjectId(user._id);
  const invoiceOid = new ObjectId(input.invoiceId);

  const invoice = await db
    .collection('crm_invoices')
    .findOne({ _id: invoiceOid, userId: userOid });
  if (!invoice) return { error: 'Invoice not found' };

  const now = input.paidOn ? new Date(input.paidOn) : new Date();

  const paymentDoc: Record<string, any> = {
    userId: userOid,
    invoice_id: invoiceOid,
    invoice_number: (invoice as any).invoiceNumber || '',
    client_id: (invoice as any).accountId || undefined,
    client_name: (invoice as any).accountName || '',
    amount: input.amount,
    currency: input.currency || (invoice as any).currency || 'INR',
    paid_on: now,
    transaction_id: input.transactionId || '',
    gateway: input.gateway,
    offline_method_id:
      input.offlineMethodId && ObjectId.isValid(input.offlineMethodId)
        ? new ObjectId(input.offlineMethodId)
        : undefined,
    bank_account_id:
      input.bankAccountId && ObjectId.isValid(input.bankAccountId)
        ? new ObjectId(input.bankAccountId)
        : undefined,
    status: 'completed' as WsPaymentStatus,
    remarks: input.remarks || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const paymentRes = await db.collection('crm_payments').insertOne(paymentDoc);
  const paymentId = paymentRes.insertedId;

  // Recompute paid total + invoice status.
  const statusInfo = await updateInvoicePaymentStatus(invoiceOid, userOid);
  const remaining = Math.max(0, statusInfo.total - statusInfo.paid);

  // Ledger entry
  await db.collection('crm_invoice_payment_details').insertOne({
    userId: userOid,
    invoice_id: invoiceOid,
    payment_id: paymentId,
    amount_paid: input.amount,
    remaining_balance: remaining,
    recorded_at: now,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Optional bank-transaction side-effect
  if (input.createBankTransaction && paymentDoc.bank_account_id) {
    await db.collection('crm_bank_transactions_ext').insertOne({
      userId: userOid,
      bank_account_id: paymentDoc.bank_account_id,
      date: now,
      type: 'deposit' as WsBankTransactionType,
      amount: input.amount,
      description: `Payment for invoice ${paymentDoc.invoice_number || input.invoiceId}`,
      category: 'payment',
      reference: input.transactionId || '',
      payment_id: paymentId,
      reconciled: true,
      reconciled_at: now,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath(OK_BANK_TX);
  }

  revalidatePath(OK_PAYMENTS);
  revalidatePath(OK_INVOICES);
  return { paymentId: paymentId.toString(), status: statusInfo.status };
}

export async function refundPayment(
  paymentId: string,
  amount: number,
  reason?: string,
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(paymentId)) return { error: 'Invalid payment id' };
  if (!(amount > 0)) return { error: 'Refund amount must be greater than zero' };

  const { db } = await connectToDatabase();
  const userOid = new ObjectId(user._id);
  const payment = await db
    .collection('crm_payments')
    .findOne({ _id: new ObjectId(paymentId), userId: userOid });
  if (!payment) return { error: 'Payment not found' };

  const originalAmount = toNumber((payment as any).amount, 0);
  const alreadyRefunded = toNumber((payment as any).refunded_amount, 0);
  const newRefund = Math.min(
    originalAmount - alreadyRefunded,
    toNumber(amount, 0),
  );
  if (newRefund <= 0) return { error: 'Nothing left to refund' };

  const totalRefunded = alreadyRefunded + newRefund;
  const status: WsPaymentStatus =
    totalRefunded >= originalAmount ? 'refunded' : 'completed';

  await db.collection('crm_payments').updateOne(
    { _id: new ObjectId(paymentId), userId: userOid },
    {
      $set: {
        refunded_amount: totalRefunded,
        refunded_at: new Date(),
        refund_reason: reason || '',
        status,
        updatedAt: new Date(),
      },
    },
  );

  if ((payment as any).invoice_id) {
    await updateInvoicePaymentStatus(
      (payment as any).invoice_id,
      userOid,
    );
  }

  // Mirror as a withdrawal in the ext ledger for the same bank account
  if ((payment as any).bank_account_id) {
    await db.collection('crm_bank_transactions_ext').insertOne({
      userId: userOid,
      bank_account_id: (payment as any).bank_account_id,
      date: new Date(),
      type: 'withdrawal' as WsBankTransactionType,
      amount: newRefund,
      description: `Refund for payment ${paymentId}${reason ? ` — ${reason}` : ''}`,
      category: 'refund',
      reference: (payment as any).transaction_id || '',
      payment_id: new ObjectId(paymentId),
      reconciled: true,
      reconciled_at: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath(OK_BANK_TX);
  }

  revalidatePath(OK_PAYMENTS);
  revalidatePath(OK_INVOICES);
  return { message: 'Refund recorded.', id: paymentId };
}

/* ═══════════════════════════════════════════════════════════════
 *  Payment Gateway Credentials
 * ══════════════════════════════════════════════════════════════ */

export async function getGatewayCredentials() {
  return hrList<WsPaymentGatewayCredential>(
    'crm_payment_gateway_credentials',
    { sortBy: { gateway: 1 } },
  );
}

export async function getGatewayCredentialById(id: string) {
  return hrGetById<WsPaymentGatewayCredential>(
    'crm_payment_gateway_credentials',
    id,
  );
}

export async function saveGatewayCredential(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const data = formToObject(formData);
    const payload: Record<string, any> = {
      _id: data._id,
      gateway: data.gateway || '',
      mode: (data.mode as string) || 'test',
      api_key: data.api_key || '',
      api_secret: data.api_secret || '',
      webhook_secret: data.webhook_secret || '',
      is_active: toBool(data.is_active, false),
      show_on_public: toBool(data.show_on_public, false),
      extra: parseJsonField(data, 'extra') || {},
    };
    const res = await hrSave('crm_payment_gateway_credentials', payload);
    if (res.error) return { error: res.error };
    revalidatePath(OK_GATEWAYS);
    revalidatePath(OK_PUBLIC_PAY);
    return { message: 'Gateway saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save gateway' };
  }
}

export async function deleteGatewayCredential(id: string) {
  const r = await hrDelete('crm_payment_gateway_credentials', id);
  revalidatePath(OK_GATEWAYS);
  revalidatePath(OK_PUBLIC_PAY);
  return r;
}

export async function toggleGateway(id: string): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'Invalid id' };

  const { db } = await connectToDatabase();
  const userOid = new ObjectId(user._id);
  const existing = await db
    .collection('crm_payment_gateway_credentials')
    .findOne({ _id: new ObjectId(id), userId: userOid });
  if (!existing) return { error: 'Gateway not found' };

  const next = !(existing as any).is_active;
  await db.collection('crm_payment_gateway_credentials').updateOne(
    { _id: new ObjectId(id), userId: userOid },
    { $set: { is_active: next, updatedAt: new Date() } },
  );
  revalidatePath(OK_GATEWAYS);
  revalidatePath(OK_PUBLIC_PAY);
  return { message: next ? 'Gateway activated.' : 'Gateway deactivated.' };
}

export async function togglePublicPayment(id: string): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'Invalid id' };

  const { db } = await connectToDatabase();
  const userOid = new ObjectId(user._id);
  const existing = await db
    .collection('crm_payment_gateway_credentials')
    .findOne({ _id: new ObjectId(id), userId: userOid });
  if (!existing) return { error: 'Gateway not found' };

  const next = !(existing as any).show_on_public;
  await db.collection('crm_payment_gateway_credentials').updateOne(
    { _id: new ObjectId(id), userId: userOid },
    { $set: { show_on_public: next, updatedAt: new Date() } },
  );
  revalidatePath(OK_PUBLIC_PAY);
  revalidatePath(OK_GATEWAYS);
  return {
    message: next
      ? 'Enabled on public pay pages.'
      : 'Hidden from public pay pages.',
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Offline Payment Methods
 * ══════════════════════════════════════════════════════════════ */

export async function getOfflinePaymentMethods() {
  return hrList<WsOfflinePaymentMethod>('crm_offline_payment_methods', {
    sortBy: { name: 1 },
  });
}

export async function getOfflinePaymentMethodById(id: string) {
  return hrGetById<WsOfflinePaymentMethod>(
    'crm_offline_payment_methods',
    id,
  );
}

export async function saveOfflinePaymentMethod(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const data = formToObject(formData);
    const payload = {
      _id: data._id,
      name: data.name || '',
      description: data.description || '',
      is_active: toBool(data.is_active, true),
    };
    const res = await hrSave('crm_offline_payment_methods', payload);
    if (res.error) return { error: res.error };
    revalidatePath(OK_OFFLINE);
    return { message: 'Offline method saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save method' };
  }
}

export async function deleteOfflinePaymentMethod(id: string) {
  const r = await hrDelete('crm_offline_payment_methods', id);
  revalidatePath(OK_OFFLINE);
  return r;
}

/* ═══════════════════════════════════════════════════════════════
 *  Bank Account extension (patches existing crm_bank_accounts)
 * ══════════════════════════════════════════════════════════════ */

export async function saveBankAccountExt(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireSession();
    if (!user) return { error: 'Access denied' };
    const data = formToObject(formData, ['opening_balance']);
    const id = data._id as string;
    if (!id || !ObjectId.isValid(id)) {
      return { error: 'Bank account id is required' };
    }
    const { db } = await connectToDatabase();
    const userOid = new ObjectId(user._id);
    await db.collection('crm_bank_accounts').updateOne(
      { _id: new ObjectId(id), userId: userOid },
      {
        $set: {
          bank_info: data.bank_info || '',
          branch: data.branch || '',
          swift_code: data.swift_code || '',
          iban: data.iban || '',
          routing_number: data.routing_number || '',
          opening_balance: toNumber(data.opening_balance, 0),
          currency: data.currency || 'INR',
          updatedAt: new Date(),
        },
      },
    );
    revalidatePath(OK_BANK_ACC);
    return { message: 'Bank account extras saved.', id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save bank account extras' };
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Bank Transactions (ext ledger)
 * ══════════════════════════════════════════════════════════════ */

export async function getBankTransactionsExt(bankAccountId?: string) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const filter: Record<string, any> = { userId: new ObjectId(user._id) };
  if (bankAccountId && ObjectId.isValid(bankAccountId)) {
    filter.bank_account_id = new ObjectId(bankAccountId);
  }
  const docs = await db
    .collection('crm_bank_transactions_ext')
    .find(filter)
    .sort({ date: -1 })
    .toArray();
  return serialize(docs);
}

export async function getBankTransactionExtById(id: string) {
  return hrGetById<WsBankTransactionExt>('crm_bank_transactions_ext', id);
}

export async function saveBankTransactionExt(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const data = formToObject(formData, ['amount', 'balance']);
    const payload: Record<string, any> = {
      _id: data._id,
      bank_account_id: data.bank_account_id || undefined,
      date: data.date || new Date().toISOString(),
      type: (data.type as WsBankTransactionType) || 'deposit',
      amount: toNumber(data.amount, 0),
      balance:
        data.balance === undefined || data.balance === ''
          ? undefined
          : toNumber(data.balance),
      description: data.description || '',
      category: data.category || '',
      reference: data.reference || '',
      payment_id: data.payment_id || undefined,
      reconciled: toBool(data.reconciled, false),
    };
    const res = await hrSave('crm_bank_transactions_ext', payload, {
      idFields: ['bank_account_id', 'payment_id'],
      dateFields: ['date'],
    });
    if (res.error) return { error: res.error };
    revalidatePath(OK_BANK_TX);
    return { message: 'Transaction saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save transaction' };
  }
}

export async function deleteBankTransactionExt(id: string) {
  const r = await hrDelete('crm_bank_transactions_ext', id);
  revalidatePath(OK_BANK_TX);
  return r;
}

/**
 * Link a bank transaction to an existing payment — marks the
 * transaction reconciled and stamps `payment_id`.
 */
export async function reconcileBankTransaction(
  transactionId: string,
  paymentId: string,
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(transactionId))
    return { error: 'Invalid transaction id' };
  if (!ObjectId.isValid(paymentId))
    return { error: 'Invalid payment id' };

  const { db } = await connectToDatabase();
  const userOid = new ObjectId(user._id);
  const payment = await db
    .collection('crm_payments')
    .findOne({ _id: new ObjectId(paymentId), userId: userOid });
  if (!payment) return { error: 'Payment not found' };

  const res = await db.collection('crm_bank_transactions_ext').updateOne(
    { _id: new ObjectId(transactionId), userId: userOid },
    {
      $set: {
        payment_id: new ObjectId(paymentId),
        reconciled: true,
        reconciled_at: new Date(),
        updatedAt: new Date(),
      },
    },
  );
  if (!res.matchedCount) return { error: 'Transaction not found' };
  revalidatePath(OK_BANK_TX);
  return { message: 'Transaction reconciled.' };
}

/* ═══════════════════════════════════════════════════════════════
 *  Invoice Payment Details (read-only helper)
 * ══════════════════════════════════════════════════════════════ */

export async function getInvoicePaymentDetails(invoiceId: string) {
  const user = await requireSession();
  if (!user || !ObjectId.isValid(invoiceId)) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection('crm_invoice_payment_details')
    .find({
      userId: new ObjectId(user._id),
      invoice_id: new ObjectId(invoiceId),
    })
    .sort({ recorded_at: -1 })
    .toArray();
  return serialize(docs) as unknown as WsInvoicePaymentDetail[];
}

/* ═══════════════════════════════════════════════════════════════
 *  Public Pay helper (used by public invoice/proposal pages)
 * ══════════════════════════════════════════════════════════════ */

export async function getPublicPaymentGateways() {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection('crm_payment_gateway_credentials')
    .find({
      userId: new ObjectId(user._id),
      is_active: true,
      show_on_public: true,
    })
    .sort({ gateway: 1 })
    .toArray();
  return serialize(docs);
}
