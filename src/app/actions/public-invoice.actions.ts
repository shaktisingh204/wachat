'use server';

/**
 * Public invoice actions — back the unauthenticated portal at
 * `/share/invoice/[hash]`.
 *
 * These actions intentionally bypass `getSession()` because the
 * tenant is implicitly trusted via the 32-char `publicHash` lookup
 * — the same model Worksuite uses for `/invoice/{hash}`. All writes
 * record IP + user agent for audit.
 *
 * Collections touched:
 *   crm_invoices    — read (by publicHash), update status on offline payment
 *   crm_payments    — insert (status='pending', gateway='Offline')
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { isValidPublicHash } from '@/lib/public-hash';

export type PublicInvoiceView = {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string;
  status: string;
  subtotal: number;
  total: number;
  tax?: number;
  discount?: number;
  notes?: string;
  lineItems: Array<{
    description?: string;
    name?: string;
    quantity: number;
    rate: number;
    total: number;
  }>;
  billTo: {
    name?: string;
    email?: string;
    address?: string;
  };
} | null;

export type PublicActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

async function clientMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
    const userAgent = h.get('user-agent') || null;
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}

export async function getPublicInvoice(hash: string): Promise<PublicInvoiceView> {
  if (!isValidPublicHash(hash)) return null;
  try {
    const { db } = await connectToDatabase();
    const invoice = await db.collection('crm_invoices').findOne({ publicHash: hash });
    if (!invoice) return null;

    // Best effort: resolve bill-to client from `accountId` if present.
    let billTo: { name?: string; email?: string; address?: string } = {};
    if (invoice.accountId) {
      try {
        const accountId =
          typeof invoice.accountId === 'string'
            ? new ObjectId(invoice.accountId)
            : invoice.accountId;
        const account = await db.collection('crm_accounts').findOne({ _id: accountId });
        if (account) {
          billTo = {
            name: (account.name as string) || (account.accountName as string),
            email: account.email as string,
            address: (account.address as string) || (account.billingAddress as string),
          };
        }
      } catch {
        /* ignore — bill-to is best-effort */
      }
    }

    return {
      _id: invoice._id.toString(),
      invoiceNumber: (invoice.invoiceNumber as string) || (invoice.invoiceNo as string) || '',
      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString() : null,
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : null,
      currency: (invoice.currency as string) || 'USD',
      status: (invoice.status as string) || 'Draft',
      subtotal: Number(invoice.subtotal ?? invoice.subTotal ?? 0),
      total: Number(invoice.total ?? 0),
      tax: invoice.tax != null ? Number(invoice.tax) : undefined,
      discount: invoice.discount != null ? Number(invoice.discount) : undefined,
      notes: invoice.notes as string | undefined,
      lineItems: Array.isArray(invoice.lineItems)
        ? invoice.lineItems.map((li: Record<string, unknown>) => ({
            description: (li.description as string) || (li.name as string),
            name: li.name as string,
            quantity: Number(li.quantity ?? li.qty ?? 0),
            rate: Number(li.rate ?? 0),
            total: Number(li.total ?? Number(li.quantity ?? 0) * Number(li.rate ?? 0)),
          }))
        : [],
      billTo,
    };
  } catch (e) {
    console.error('[getPublicInvoice] failed:', e);
    return null;
  }
}

export async function recordOfflinePayment(
  hash: string,
  amount: number,
  notes: string,
  billUrl?: string,
): Promise<PublicActionResult> {
  if (!isValidPublicHash(hash)) return { success: false, error: 'Invalid link.' };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'Enter a valid payment amount.' };
  }
  try {
    const { db } = await connectToDatabase();
    const invoice = await db.collection('crm_invoices').findOne({ publicHash: hash });
    if (!invoice) return { success: false, error: 'Invoice not found.' };

    const meta = await clientMeta();
    await db.collection('crm_payments').insertOne({
      invoiceId: invoice._id,
      userId: invoice.userId,
      amount,
      gateway: 'Offline',
      status: 'pending',
      notes: notes?.slice(0, 2000) || '',
      billUrl: billUrl || null,
      submittedBy: 'public-portal',
      ip: meta.ip,
      userAgent: meta.userAgent,
      createdAt: new Date(),
    });

    await db.collection('crm_invoices').updateOne(
      { _id: invoice._id },
      {
        $set: {
          status: 'Pending-Confirmation',
          updatedAt: new Date(),
        },
      },
    );

    revalidatePath(`/share/invoice/${hash}`);
    return {
      success: true,
      message: 'Payment submitted. The merchant will confirm shortly.',
    };
  } catch (e) {
    console.error('[recordOfflinePayment] failed:', e);
    return { success: false, error: 'Could not record payment.' };
  }
}

export async function markInvoiceViewed(hash: string): Promise<void> {
  if (!isValidPublicHash(hash)) return;
  try {
    const { db } = await connectToDatabase();
    const meta = await clientMeta();
    await db
      .collection('crm_invoices')
      .updateOne(
        { publicHash: hash },
        { $set: { lastViewedAt: new Date(), lastViewedIp: meta.ip } },
      );
  } catch {
    /* non-fatal */
  }
}

/**
 * Stripe/Razorpay/PayPal stubs. These return a "not configured"
 * error today; the page renders them as buttons that surface the
 * message to the user. Real gateway wiring is a separate ticket.
 */
export async function startGatewayCheckout(
  hash: string,
  gateway: 'stripe' | 'razorpay' | 'paypal',
): Promise<PublicActionResult> {
  void hash;
  void gateway;
  return {
    success: false,
    error: `${gateway[0].toUpperCase()}${gateway.slice(1)} gateway not configured.`,
  };
}
