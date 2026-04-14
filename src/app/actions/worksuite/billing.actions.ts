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
  WsOrder,
  WsOrderItem,
  WsRecurringInvoice,
  WsRecurringInvoiceItem,
  WsRecurringExpense,
  WsPromotion,
  WsFrequency,
} from '@/lib/worksuite/billing-types';

/**
 * Worksuite billing actions — Orders + Cart, Recurring Invoices,
 * Recurring Expenses, and Promotion codes.
 *
 * All entities are tenant-scoped via `userId` (see `hr-crud`).
 *
 * Collections:
 *   crm_orders, crm_order_items,
 *   crm_recurring_invoices, crm_recurring_invoice_items,
 *   crm_recurring_expenses,
 *   crm_promotions.
 */

type FormState = { message?: string; error?: string; id?: string };

const OK_ORDER = '/dashboard/crm/sales/orders';
const OK_REC_INV = '/dashboard/crm/sales/recurring-invoices';
const OK_REC_EXP = '/dashboard/crm/purchases/recurring-expenses';
const OK_PROMO = '/dashboard/crm/sales/promotions';

/* ─── Small shared helpers ─────────────────────────────────────── */

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function parseJsonField<T>(data: Record<string, any>, key: string): T | undefined {
  const v = data[key];
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'object') return v as T;
  try {
    return JSON.parse(v as string) as T;
  } catch {
    return undefined;
  }
}

function computeItemsTotals(
  items: WsOrderItem[] | WsRecurringInvoiceItem[] = [],
): { subtotal: number; tax: number; total: number } {
  let subtotal = 0;
  let tax = 0;
  for (const it of items) {
    const qty = toNumber(it.quantity, 0);
    const unit = toNumber(it.unit_price, 0);
    const base = qty * unit;
    subtotal += base;
    if ((it as any).tax_rate) {
      tax += base * (toNumber((it as any).tax_rate, 0) / 100);
    }
    (it as any).total = base;
  }
  return { subtotal, tax, total: subtotal + tax };
}

function addInterval(
  base: Date,
  frequency: WsFrequency,
  count: number,
): Date {
  const d = new Date(base);
  const n = count > 0 ? count : 1;
  switch (frequency) {
    case 'days':
      d.setDate(d.getDate() + n);
      break;
    case 'weeks':
      d.setDate(d.getDate() + n * 7);
      break;
    case 'months':
      d.setMonth(d.getMonth() + n);
      break;
    case 'years':
      d.setFullYear(d.getFullYear() + n);
      break;
  }
  return d;
}

/* ─── Order number generator ───────────────────────────────────── */

export async function generateOrderNumber(): Promise<string> {
  const user = await requireSession();
  if (!user) return `ORD-${Date.now()}`;
  const { db } = await connectToDatabase();
  const last = await db
    .collection('crm_orders')
    .find({ userId: new ObjectId(user._id) })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  const year = new Date().getFullYear();
  let seq = 1;
  if (last[0]?.order_number) {
    const m = String(last[0].order_number).match(/(\d+)$/);
    if (m) seq = Number(m[1]) + 1;
  }
  return `ORD-${year}-${String(seq).padStart(5, '0')}`;
}

/* ═══════════════════════════════════════════════════════════════
 *  Orders
 * ══════════════════════════════════════════════════════════════ */

export async function getOrders() {
  return hrList<WsOrder>('crm_orders', { sortBy: { order_date: -1 } });
}

export async function getOrderById(id: string) {
  return hrGetById<WsOrder>('crm_orders', id);
}

export async function getOrderItems(orderId: string) {
  const user = await requireSession();
  if (!user || !ObjectId.isValid(orderId)) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection('crm_order_items')
    .find({
      userId: new ObjectId(user._id),
      order_id: new ObjectId(orderId),
    })
    .toArray();
  return serialize(docs);
}

export async function saveOrder(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const data = formToObject(formData, [
      'subtotal',
      'tax',
      'discount',
      'total',
    ]);
    const items =
      parseJsonField<WsOrderItem[]>(data, 'items') ||
      parseJsonField<WsOrderItem[]>(data, 'lineItems') ||
      [];

    const totals = computeItemsTotals(items);
    const discount = toNumber(data.discount, 0);

    const payload: Record<string, any> = {
      _id: data._id,
      order_number:
        data.order_number || data.orderNumber || (await generateOrderNumber()),
      client_id: data.client_id || data.clientId,
      client_name: data.client_name || data.clientName || '',
      order_date: data.order_date || data.orderDate || new Date().toISOString(),
      delivery_date: data.delivery_date || data.deliveryDate || undefined,
      status: (data.status as string) || 'pending',
      subtotal: toNumber(data.subtotal, totals.subtotal),
      tax: toNumber(data.tax, totals.tax),
      discount,
      total: toNumber(
        data.total,
        Math.max(0, totals.subtotal + totals.tax - discount),
      ),
      currency: (data.currency as string) || 'INR',
      shipping_address: parseJsonField(data, 'shipping_address'),
      billing_address: parseJsonField(data, 'billing_address'),
      notes: data.notes || '',
      payment_terms: data.payment_terms || data.paymentTerms || '',
      items,
    };

    const res = await hrSave('crm_orders', payload, {
      idFields: ['client_id'],
      dateFields: ['order_date', 'delivery_date'],
    });
    if (res.error) return { error: res.error };

    // Persist items in their own collection as well (denormalised copy
    // stays on the order document for fast reads).
    if (res.id) {
      const user = await requireSession();
      if (user) {
        const { db } = await connectToDatabase();
        await db.collection('crm_order_items').deleteMany({
          order_id: new ObjectId(res.id),
          userId: new ObjectId(user._id),
        });
        if (items.length) {
          await db.collection('crm_order_items').insertMany(
            items.map((it) => ({
              ...it,
              order_id: new ObjectId(res.id!),
              userId: new ObjectId(user._id),
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          );
        }
      }
    }

    revalidatePath(OK_ORDER);
    return { message: 'Order saved successfully.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save order' };
  }
}

export async function deleteOrder(id: string) {
  const r = await hrDelete('crm_orders', id);
  if (r.success) {
    const user = await requireSession();
    if (user && ObjectId.isValid(id)) {
      const { db } = await connectToDatabase();
      await db.collection('crm_order_items').deleteMany({
        order_id: new ObjectId(id),
        userId: new ObjectId(user._id),
      });
    }
  }
  revalidatePath(OK_ORDER);
  return r;
}

/** Convert an order (with items) to a CRM invoice. Returns new invoice id. */
export async function convertOrderToInvoice(
  orderId: string,
): Promise<{ invoiceId?: string; error?: string }> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(orderId)) return { error: 'Invalid order id' };

  const { db } = await connectToDatabase();
  const userOid = new ObjectId(user._id);

  const order = await db
    .collection('crm_orders')
    .findOne({ _id: new ObjectId(orderId), userId: userOid });
  if (!order) return { error: 'Order not found' };

  const items: WsOrderItem[] = Array.isArray(order.items) ? order.items : [];

  const lineItems = items.map((it, idx) => ({
    id: String(idx + 1),
    name: it.name || '',
    description: it.description || '',
    quantity: toNumber(it.quantity, 1),
    rate: toNumber(it.unit_price, 0),
  }));

  const subtotal = lineItems.reduce(
    (s, l) => s + (l.quantity || 0) * (l.rate || 0),
    0,
  );

  const now = new Date();
  const invoiceNumber = `INV-${now.getFullYear()}-${String(Date.now()).slice(-6)}`;

  const res = await db.collection('crm_invoices').insertOne({
    userId: userOid,
    accountId: order.client_id || null,
    invoiceNumber,
    invoiceDate: now,
    dueDate: undefined,
    lineItems,
    termsAndConditions: [],
    notes: order.notes || `Converted from order ${order.order_number}`,
    additionalInfo: [],
    status: 'Draft',
    currency: order.currency || 'INR',
    subtotal,
    total: subtotal,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('crm_orders').updateOne(
    { _id: new ObjectId(orderId), userId: userOid },
    {
      $set: {
        invoice_id: res.insertedId,
        converted_at: now,
        status: 'confirmed',
        updatedAt: now,
      },
    },
  );

  revalidatePath(OK_ORDER);
  revalidatePath('/dashboard/crm/sales/invoices');
  return { invoiceId: res.insertedId.toString() };
}

/* ─── Cart (a single draft order per user) ─────────────────────── */

export async function getCart(): Promise<WsOrder | null> {
  const user = await requireSession();
  if (!user) return null;
  const { db } = await connectToDatabase();
  const doc = await db.collection('crm_orders').findOne({
    userId: new ObjectId(user._id),
    status: 'pending',
    is_cart: true,
  } as any);
  return doc ? (serialize(doc) as unknown as WsOrder) : null;
}

export async function saveCart(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireSession();
    if (!user) return { error: 'Access denied' };
    const data = formToObject(formData);
    const items =
      parseJsonField<WsOrderItem[]>(data, 'items') ||
      parseJsonField<WsOrderItem[]>(data, 'lineItems') ||
      [];
    const totals = computeItemsTotals(items);

    const { db } = await connectToDatabase();
    const userOid = new ObjectId(user._id);
    const now = new Date();

    const cartDoc = {
      userId: userOid,
      order_number: 'CART-DRAFT',
      client_id:
        data.client_id && ObjectId.isValid(String(data.client_id))
          ? new ObjectId(String(data.client_id))
          : null,
      client_name: data.client_name || '',
      order_date: now,
      status: 'pending' as const,
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: toNumber(data.discount, 0),
      total: Math.max(0, totals.subtotal + totals.tax - toNumber(data.discount, 0)),
      currency: (data.currency as string) || 'INR',
      notes: data.notes || '',
      items,
      is_cart: true,
      updatedAt: now,
    };

    const existing = await db
      .collection('crm_orders')
      .findOne({ userId: userOid, is_cart: true } as any);

    let id: string;
    if (existing) {
      await db
        .collection('crm_orders')
        .updateOne({ _id: existing._id, userId: userOid }, { $set: cartDoc });
      id = existing._id.toString();
    } else {
      const ins = await db
        .collection('crm_orders')
        .insertOne({ ...cartDoc, createdAt: now });
      id = ins.insertedId.toString();
    }

    revalidatePath(`${OK_ORDER}/cart`);
    return { message: 'Cart saved.', id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save cart' };
  }
}

/** Convert the cart to a real pending order. */
export async function submitCart(): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const { db } = await connectToDatabase();
  const userOid = new ObjectId(user._id);
  const cart = await db
    .collection('crm_orders')
    .findOne({ userId: userOid, is_cart: true } as any);
  if (!cart) return { error: 'Cart is empty' };
  const order_number = await generateOrderNumber();
  await db.collection('crm_orders').updateOne(
    { _id: cart._id, userId: userOid },
    {
      $set: {
        is_cart: false,
        order_number,
        status: 'pending',
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath(OK_ORDER);
  revalidatePath(`${OK_ORDER}/cart`);
  return { message: 'Order submitted.', id: cart._id.toString() };
}

export async function clearCart(): Promise<{ success: boolean }> {
  const user = await requireSession();
  if (!user) return { success: false };
  const { db } = await connectToDatabase();
  await db.collection('crm_orders').deleteOne({
    userId: new ObjectId(user._id),
    is_cart: true,
  } as any);
  revalidatePath(`${OK_ORDER}/cart`);
  return { success: true };
}

/* ═══════════════════════════════════════════════════════════════
 *  Recurring Invoices
 * ══════════════════════════════════════════════════════════════ */

export async function getRecurringInvoices() {
  return hrList<WsRecurringInvoice>('crm_recurring_invoices', {
    sortBy: { next_issue_date: 1 },
  });
}

export async function getRecurringInvoiceById(id: string) {
  return hrGetById<WsRecurringInvoice>('crm_recurring_invoices', id);
}

export async function saveRecurringInvoice(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const data = formToObject(formData, [
      'frequency_count',
      'stop_at_count',
      'subtotal',
      'tax',
      'discount',
      'total',
    ]);
    const items =
      parseJsonField<WsRecurringInvoiceItem[]>(data, 'items') ||
      parseJsonField<WsRecurringInvoiceItem[]>(data, 'lineItems') ||
      [];
    const totals = computeItemsTotals(items);
    const discount = toNumber(data.discount, 0);

    const startDate = data.recurring_start_date
      ? new Date(data.recurring_start_date)
      : new Date();
    const frequency = (data.frequency as WsFrequency) || 'months';
    const frequency_count = toNumber(data.frequency_count, 1);
    const nextIssue = data.next_issue_date
      ? new Date(data.next_issue_date)
      : startDate;

    const payload: Record<string, any> = {
      _id: data._id,
      client_id: data.client_id,
      client_name: data.client_name || '',
      recurring_start_date: startDate,
      next_issue_date: nextIssue,
      frequency,
      frequency_count,
      until_date: data.until_date || undefined,
      stop_at_count: data.stop_at_count
        ? toNumber(data.stop_at_count)
        : undefined,
      issued_count: toNumber(data.issued_count, 0),
      status: (data.status as string) || 'active',
      currency: (data.currency as string) || 'INR',
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount,
      total: Math.max(0, totals.subtotal + totals.tax - discount),
      notes: data.notes || '',
      payment_terms: data.payment_terms || '',
      items,
    };

    const res = await hrSave('crm_recurring_invoices', payload, {
      idFields: ['client_id'],
      dateFields: [
        'recurring_start_date',
        'next_issue_date',
        'until_date',
      ],
    });
    if (res.error) return { error: res.error };
    revalidatePath(OK_REC_INV);
    return { message: 'Recurring invoice saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save recurring invoice' };
  }
}

export async function deleteRecurringInvoice(id: string) {
  const r = await hrDelete('crm_recurring_invoices', id);
  revalidatePath(OK_REC_INV);
  return r;
}

async function updateRecurringInvoiceStatus(
  id: string,
  status: 'active' | 'paused' | 'stopped',
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection('crm_recurring_invoices').updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(user._id) },
    { $set: { status, updatedAt: new Date() } },
  );
  revalidatePath(OK_REC_INV);
  return { message: `Recurring invoice ${status}.` };
}

export async function pauseRecurringInvoice(id: string) {
  return updateRecurringInvoiceStatus(id, 'paused');
}
export async function resumeRecurringInvoice(id: string) {
  return updateRecurringInvoiceStatus(id, 'active');
}
export async function stopRecurringInvoice(id: string) {
  return updateRecurringInvoiceStatus(id, 'stopped');
}

/** Generate one-off invoice from a recurring invoice template. */
export async function runRecurringInvoiceNow(
  id: string,
): Promise<{ invoiceId?: string; error?: string }> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'Invalid id' };

  const { db } = await connectToDatabase();
  const userOid = new ObjectId(user._id);

  const rec = await db
    .collection('crm_recurring_invoices')
    .findOne({ _id: new ObjectId(id), userId: userOid });
  if (!rec) return { error: 'Recurring invoice not found' };

  const items: WsRecurringInvoiceItem[] = Array.isArray(rec.items)
    ? rec.items
    : [];

  const lineItems = items.map((it, idx) => ({
    id: String(idx + 1),
    name: it.name || '',
    description: it.description || '',
    quantity: toNumber(it.quantity, 1),
    rate: toNumber(it.unit_price, 0),
  }));

  const subtotal = lineItems.reduce(
    (s, l) => s + (l.quantity || 0) * (l.rate || 0),
    0,
  );

  const now = new Date();
  const invoiceNumber = `REC-${now.getFullYear()}-${String(Date.now()).slice(-6)}`;

  const insertRes = await db.collection('crm_invoices').insertOne({
    userId: userOid,
    accountId: rec.client_id || null,
    invoiceNumber,
    invoiceDate: now,
    dueDate: undefined,
    lineItems,
    termsAndConditions: [],
    notes: rec.notes || 'Generated from recurring invoice',
    additionalInfo: [],
    status: 'Draft',
    currency: rec.currency || 'INR',
    subtotal,
    total: subtotal,
    recurring_invoice_id: rec._id,
    createdAt: now,
    updatedAt: now,
  });

  const issuedCount = toNumber(rec.issued_count, 0) + 1;
  const nextDate = addInterval(
    rec.next_issue_date ? new Date(rec.next_issue_date) : now,
    (rec.frequency as WsFrequency) || 'months',
    toNumber(rec.frequency_count, 1),
  );

  let status = rec.status as string;
  if (rec.stop_at_count && issuedCount >= toNumber(rec.stop_at_count, 0)) {
    status = 'stopped';
  }
  if (rec.until_date && new Date(rec.until_date) <= now) {
    status = 'stopped';
  }

  await db.collection('crm_recurring_invoices').updateOne(
    { _id: rec._id, userId: userOid },
    {
      $set: {
        issued_count: issuedCount,
        last_issued_at: now,
        next_issue_date: nextDate,
        status,
        updatedAt: now,
      },
      $push: { generated_invoice_ids: insertRes.insertedId } as any,
    },
  );

  revalidatePath(OK_REC_INV);
  revalidatePath('/dashboard/crm/sales/invoices');
  return { invoiceId: insertRes.insertedId.toString() };
}

/* ═══════════════════════════════════════════════════════════════
 *  Recurring Expenses
 * ══════════════════════════════════════════════════════════════ */

export async function getRecurringExpenses() {
  return hrList<WsRecurringExpense>('crm_recurring_expenses', {
    sortBy: { next_run_date: 1 },
  });
}

export async function getRecurringExpenseById(id: string) {
  return hrGetById<WsRecurringExpense>('crm_recurring_expenses', id);
}

export async function saveRecurringExpense(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const data = formToObject(formData, [
      'amount',
      'frequency_count',
      'stop_at_count',
      'run_count',
    ]);

    const startDate = data.start_date ? new Date(data.start_date) : new Date();
    const payload: Record<string, any> = {
      _id: data._id,
      category_id: data.category_id,
      category_name: data.category_name || '',
      name: data.name || 'Untitled',
      amount: toNumber(data.amount, 0),
      currency: (data.currency as string) || 'INR',
      frequency: (data.frequency as WsFrequency) || 'months',
      frequency_count: toNumber(data.frequency_count, 1),
      start_date: startDate,
      next_run_date: data.next_run_date
        ? new Date(data.next_run_date)
        : startDate,
      last_run_date: data.last_run_date || undefined,
      until_date: data.until_date || undefined,
      stop_at_count: data.stop_at_count
        ? toNumber(data.stop_at_count)
        : undefined,
      run_count: toNumber(data.run_count, 0),
      status: (data.status as string) || 'active',
      vendor: data.vendor || '',
      payment_method: data.payment_method || '',
      bank_account_id: data.bank_account_id || undefined,
      notes: data.notes || '',
    };

    const res = await hrSave('crm_recurring_expenses', payload, {
      idFields: ['category_id', 'bank_account_id'],
      dateFields: [
        'start_date',
        'next_run_date',
        'last_run_date',
        'until_date',
      ],
    });
    if (res.error) return { error: res.error };
    revalidatePath(OK_REC_EXP);
    return { message: 'Recurring expense saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save recurring expense' };
  }
}

export async function deleteRecurringExpense(id: string) {
  const r = await hrDelete('crm_recurring_expenses', id);
  revalidatePath(OK_REC_EXP);
  return r;
}

async function updateRecurringExpenseStatus(
  id: string,
  status: 'active' | 'paused' | 'stopped',
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection('crm_recurring_expenses').updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(user._id) },
    { $set: { status, updatedAt: new Date() } },
  );
  revalidatePath(OK_REC_EXP);
  return { message: `Recurring expense ${status}.` };
}

export async function pauseRecurringExpense(id: string) {
  return updateRecurringExpenseStatus(id, 'paused');
}
export async function resumeRecurringExpense(id: string) {
  return updateRecurringExpenseStatus(id, 'active');
}
export async function stopRecurringExpense(id: string) {
  return updateRecurringExpenseStatus(id, 'stopped');
}

/** Record one expense entry from the recurring schedule. */
export async function runRecurringExpenseNow(
  id: string,
): Promise<{ expenseId?: string; error?: string }> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'Invalid id' };

  const { db } = await connectToDatabase();
  const userOid = new ObjectId(user._id);

  const rec = await db
    .collection('crm_recurring_expenses')
    .findOne({ _id: new ObjectId(id), userId: userOid });
  if (!rec) return { error: 'Recurring expense not found' };

  const now = new Date();
  const insertRes = await db.collection('crm_expenses').insertOne({
    userId: userOid,
    name: rec.name,
    category_id: rec.category_id || null,
    category_name: rec.category_name || '',
    amount: toNumber(rec.amount, 0),
    currency: rec.currency || 'INR',
    vendor: rec.vendor || '',
    payment_method: rec.payment_method || '',
    bank_account_id: rec.bank_account_id || null,
    notes: rec.notes || 'Generated from recurring expense',
    date: now,
    recurring_expense_id: rec._id,
    createdAt: now,
    updatedAt: now,
  });

  const runCount = toNumber(rec.run_count, 0) + 1;
  const nextDate = addInterval(
    rec.next_run_date ? new Date(rec.next_run_date) : now,
    (rec.frequency as WsFrequency) || 'months',
    toNumber(rec.frequency_count, 1),
  );

  let status = rec.status as string;
  if (rec.stop_at_count && runCount >= toNumber(rec.stop_at_count, 0)) {
    status = 'stopped';
  }
  if (rec.until_date && new Date(rec.until_date) <= now) {
    status = 'stopped';
  }

  await db.collection('crm_recurring_expenses').updateOne(
    { _id: rec._id, userId: userOid },
    {
      $set: {
        run_count: runCount,
        last_run_date: now,
        next_run_date: nextDate,
        status,
        updatedAt: now,
      },
      $push: { generated_expense_ids: insertRes.insertedId } as any,
    },
  );

  revalidatePath(OK_REC_EXP);
  revalidatePath('/dashboard/crm/purchases/expenses');
  return { expenseId: insertRes.insertedId.toString() };
}

/* ═══════════════════════════════════════════════════════════════
 *  Promotions
 * ══════════════════════════════════════════════════════════════ */

export async function getPromotions() {
  return hrList<WsPromotion>('crm_promotions');
}

export async function getPromotionById(id: string) {
  return hrGetById<WsPromotion>('crm_promotions', id);
}

export async function savePromotion(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  try {
    const data = formToObject(formData, [
      'value',
      'usage_limit',
      'per_customer_limit',
      'usage_count',
      'minimum_subtotal',
    ]);
    const res = await hrSave('crm_promotions', data, {
      dateFields: ['start_date', 'end_date'],
    });
    if (res.error) return { error: res.error };
    revalidatePath(OK_PROMO);
    return { message: 'Promotion saved.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save promotion' };
  }
}

export async function deletePromotion(id: string) {
  const r = await hrDelete('crm_promotions', id);
  revalidatePath(OK_PROMO);
  return r;
}
