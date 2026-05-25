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
 *   crm_invoices                       — read by publicHash, status updates
 *   crm_payments                       — insert (offline + gateway captures)
 *   crm_invoice_payment_details        — ledger entries per payment
 *   crm_payment_gateway_credentials    — per-tenant gateway secrets
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
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

/* ─── Helpers ─────────────────────────────────────────────────── */

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

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    const proto = h.get('x-forwarded-proto') || 'https';
    if (host) return `${proto}://${host}`;
  } catch {
    /* ignore */
  }
  return 'http://localhost:3000';
}

type GatewayCred = {
  _id: ObjectId;
  userId: ObjectId;
  gateway: string;
  mode: 'test' | 'live' | 'sandbox';
  api_key?: string;
  api_secret?: string;
  webhook_secret?: string;
  is_active?: boolean;
  show_on_public?: boolean;
  extra?: Record<string, unknown>;
};

async function loadGatewayCredential(
  userId: ObjectId,
  gateway: 'stripe' | 'razorpay' | 'paypal',
): Promise<GatewayCred | null> {
  const { db } = await connectToDatabase();
  const row = await db
    .collection('crm_payment_gateway_credentials')
    .findOne({ userId, gateway, is_active: true });
  return row ? (row as unknown as GatewayCred) : null;
}

async function loadInvoiceByHash(hash: string) {
  const { db } = await connectToDatabase();
  const invoice = await db.collection('crm_invoices').findOne({ publicHash: hash });
  return invoice;
}

async function computeDueAmount(
  invoiceId: ObjectId,
  userId: ObjectId,
  total: number,
): Promise<number> {
  const { db } = await connectToDatabase();
  const payments = await db
    .collection('crm_payments')
    .find({ userId, invoice_id: invoiceId, status: 'completed' })
    .toArray();
  const paid = payments.reduce(
    (s, p) =>
      s + toNumber((p as Record<string, unknown>).amount, 0) -
      toNumber((p as Record<string, unknown>).refunded_amount, 0),
    0,
  );
  return Math.max(0, total - paid);
}

/**
 * Records a gateway-captured payment and updates invoice status. Idempotent
 * by transaction_id when supplied — duplicate webhook deliveries won't
 * double-record.
 */
async function recordGatewayPayment(args: {
  invoiceId: ObjectId;
  userId: ObjectId;
  amount: number;
  currency: string;
  gateway: 'stripe' | 'razorpay' | 'paypal';
  transactionId: string;
  remarks?: string;
}): Promise<{ paymentId: ObjectId; alreadyRecorded: boolean }> {
  const { db } = await connectToDatabase();
  const now = new Date();

  if (args.transactionId) {
    const dupe = await db.collection('crm_payments').findOne({
      userId: args.userId,
      invoice_id: args.invoiceId,
      transaction_id: args.transactionId,
    });
    if (dupe) {
      return { paymentId: dupe._id, alreadyRecorded: true };
    }
  }

  const invoice = await db
    .collection('crm_invoices')
    .findOne({ _id: args.invoiceId, userId: args.userId });

  const paymentDoc: Record<string, unknown> = {
    userId: args.userId,
    invoice_id: args.invoiceId,
    invoice_number: invoice ? ((invoice as Record<string, unknown>).invoiceNumber as string) || '' : '',
    client_id: invoice ? ((invoice as Record<string, unknown>).accountId as ObjectId | undefined) : undefined,
    client_name: invoice ? ((invoice as Record<string, unknown>).accountName as string) || '' : '',
    amount: args.amount,
    currency: args.currency,
    paid_on: now,
    transaction_id: args.transactionId,
    gateway: args.gateway,
    status: 'completed',
    remarks: args.remarks || `Captured via ${args.gateway}`,
    createdAt: now,
    updatedAt: now,
  };

  const res = await db.collection('crm_payments').insertOne(paymentDoc);
  const paymentId = res.insertedId;

  // Recompute totals + status.
  const total = toNumber(invoice ? (invoice as Record<string, unknown>).total : 0, 0);
  const payments = await db
    .collection('crm_payments')
    .find({ userId: args.userId, invoice_id: args.invoiceId, status: 'completed' })
    .toArray();
  const paid = payments.reduce(
    (s, p) =>
      s + toNumber((p as Record<string, unknown>).amount, 0) -
      toNumber((p as Record<string, unknown>).refunded_amount, 0),
    0,
  );
  const remaining = Math.max(0, total - paid);
  const newStatus = paid <= 0 ? 'Unpaid' : paid < total ? 'Partially Paid' : 'Paid';

  await db.collection('crm_invoices').updateOne(
    { _id: args.invoiceId, userId: args.userId },
    {
      $set: {
        status: newStatus,
        amount_paid: paid,
        payment_status: paid >= total ? 1 : 0,
        updatedAt: now,
      },
    },
  );

  const updatedInvoice = await db.collection('crm_invoices').findOne({ _id: args.invoiceId, userId: args.userId });
  if (updatedInvoice) {
    try {
      const { dispatchWebhookEvent } = await import('@/lib/webhooks/dispatch');
      void dispatchWebhookEvent(
        String(args.userId),
        'invoice.updated',
        { invoice: updatedInvoice }
      );
    } catch (e) {
      console.error('[recordGatewayPayment] webhook dispatch failed:', e);
    }
  }

  await db.collection('crm_invoice_payment_details').insertOne({
    userId: args.userId,
    invoice_id: args.invoiceId,
    payment_id: paymentId,
    amount_paid: args.amount,
    remaining_balance: remaining,
    recorded_at: now,
    createdAt: now,
    updatedAt: now,
  });

  return { paymentId, alreadyRecorded: false };
}

/* ─── Public read ─────────────────────────────────────────────── */

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

    const updatedInvoice = await db.collection('crm_invoices').findOne({ _id: invoice._id });
    if (updatedInvoice && invoice.userId) {
      try {
        const { dispatchWebhookEvent } = await import('@/lib/webhooks/dispatch');
        void dispatchWebhookEvent(
          String(invoice.userId),
          'invoice.updated',
          { invoice: updatedInvoice }
        );
      } catch (e) {
        console.error('[recordOfflinePayment] webhook dispatch failed:', e);
      }
    }

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

/* ─── Gateway checkout ────────────────────────────────────────── */

export type GatewayCheckoutResult =
  | { ok: true; provider: 'stripe'; sessionUrl: string }
  | {
      ok: true;
      provider: 'razorpay';
      orderId: string;
      keyId: string;
      amount: number;
      currency: string;
    }
  | { ok: true; provider: 'paypal'; orderId: string; approvalUrl: string }
  | { ok: false; error: string };

/**
 * Start a gateway checkout flow for a public invoice. Loads the tenant's
 * credentials from `crm_payment_gateway_credentials`, then creates a
 * Stripe Checkout Session / Razorpay Order / PayPal Order. Returns the
 * data the client needs to complete the flow (redirect URL, order id…).
 */
export async function startGatewayCheckout(
  hash: string,
  gateway: 'stripe' | 'razorpay' | 'paypal',
): Promise<GatewayCheckoutResult> {
  if (!isValidPublicHash(hash)) {
    return { ok: false, error: 'Invalid link.' };
  }

  let invoice;
  try {
    invoice = await loadInvoiceByHash(hash);
  } catch (e) {
    console.error('[startGatewayCheckout] invoice lookup failed:', e);
    return { ok: false, error: 'Invoice lookup failed.' };
  }
  if (!invoice) return { ok: false, error: 'Invoice not found.' };

  const userId = (invoice as { userId?: ObjectId }).userId;
  if (!userId) return { ok: false, error: 'Invoice has no owner.' };

  const total = toNumber((invoice as Record<string, unknown>).total, 0);
  const due = await computeDueAmount(invoice._id, userId, total);
  if (!(due > 0)) {
    return { ok: false, error: 'This invoice has no outstanding balance.' };
  }
  const currency = ((invoice as Record<string, unknown>).currency as string) || 'USD';
  const invoiceNumber = ((invoice as Record<string, unknown>).invoiceNumber as string) || '';

  const cred = await loadGatewayCredential(userId, gateway);
  if (!cred) {
    return {
      ok: false,
      error: `${gateway[0].toUpperCase()}${gateway.slice(1)} gateway not configured.`,
    };
  }

  const baseUrl = await getBaseUrl();
  const successUrl = `${baseUrl}/share/invoice/${hash}?paid=${gateway}`;
  const cancelUrl = `${baseUrl}/share/invoice/${hash}?cancelled=1`;

  if (gateway === 'stripe') {
    return startStripeCheckout({
      cred,
      invoiceId: invoice._id,
      invoiceNumber,
      hash,
      amount: due,
      currency,
      successUrl,
      cancelUrl,
    });
  }
  if (gateway === 'razorpay') {
    return startRazorpayCheckout({
      cred,
      invoiceId: invoice._id,
      invoiceNumber,
      hash,
      amount: due,
      currency,
    });
  }
  return startPaypalCheckout({
    cred,
    invoiceId: invoice._id,
    hash,
    amount: due,
    currency,
    returnUrl: successUrl,
    cancelUrl,
  });
}

/* ── Stripe ───────────────────────────────────────────────────── */

async function startStripeCheckout(args: {
  cred: GatewayCred;
  invoiceId: ObjectId;
  invoiceNumber: string;
  hash: string;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<GatewayCheckoutResult> {
  const secret = args.cred.api_secret;
  if (!secret) return { ok: false, error: 'Stripe secret key not configured.' };

  try {
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: args.currency.toLowerCase(),
            product_data: {
              name: `Invoice ${args.invoiceNumber}`,
            },
            unit_amount: Math.round(args.amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: {
        invoiceId: args.invoiceId.toString(),
        invoiceHash: args.hash,
        tenantId: args.cred.userId.toString(),
      },
    });
    if (!session.url) {
      return { ok: false, error: 'Stripe did not return a checkout URL.' };
    }
    return { ok: true, provider: 'stripe', sessionUrl: session.url };
  } catch (e) {
    console.error('[startStripeCheckout] failed:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Stripe checkout failed.',
    };
  }
}

/* ── Razorpay ─────────────────────────────────────────────────── */

async function startRazorpayCheckout(args: {
  cred: GatewayCred;
  invoiceId: ObjectId;
  invoiceNumber: string;
  hash: string;
  amount: number;
  currency: string;
}): Promise<GatewayCheckoutResult> {
  const keyId = args.cred.api_key;
  const keySecret = args.cred.api_secret;
  if (!keyId || !keySecret) {
    return { ok: false, error: 'Razorpay credentials not configured.' };
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const amountMinor = Math.round(args.amount * 100);
    const order = await razorpay.orders.create({
      amount: amountMinor,
      currency: args.currency.toUpperCase(),
      receipt: args.invoiceNumber.slice(0, 40) || args.invoiceId.toString().slice(-12),
      notes: {
        invoiceId: args.invoiceId.toString(),
        invoiceHash: args.hash,
        tenantId: args.cred.userId.toString(),
      },
    });

    return {
      ok: true,
      provider: 'razorpay',
      orderId: order.id,
      keyId,
      amount: amountMinor,
      currency: args.currency.toUpperCase(),
    };
  } catch (e) {
    console.error('[startRazorpayCheckout] failed:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Razorpay checkout failed.',
    };
  }
}

/* ── PayPal ───────────────────────────────────────────────────── */

function paypalBaseUrl(mode: string): string {
  return mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getPaypalAccessToken(cred: GatewayCred): Promise<string> {
  const clientId = cred.api_key;
  const secret = cred.api_secret;
  if (!clientId || !secret) {
    throw new Error('PayPal credentials not configured.');
  }
  const basic = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${paypalBaseUrl(cred.mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('PayPal auth: no access_token');
  return data.access_token;
}

async function startPaypalCheckout(args: {
  cred: GatewayCred;
  invoiceId: ObjectId;
  hash: string;
  amount: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<GatewayCheckoutResult> {
  try {
    const token = await getPaypalAccessToken(args.cred);
    const res = await fetch(`${paypalBaseUrl(args.cred.mode)}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: args.currency.toUpperCase(),
              value: args.amount.toFixed(2),
            },
            custom_id: args.invoiceId.toString(),
            invoice_id: args.hash,
          },
        ],
        application_context: {
          return_url: args.returnUrl,
          cancel_url: args.cancelUrl,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PayPal create order failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      id?: string;
      links?: Array<{ rel: string; href: string }>;
    };
    const approval = data.links?.find((l) => l.rel === 'approve')?.href;
    if (!data.id || !approval) {
      return { ok: false, error: 'PayPal did not return an approval URL.' };
    }
    return {
      ok: true,
      provider: 'paypal',
      orderId: data.id,
      approvalUrl: approval,
    };
  } catch (e) {
    console.error('[startPaypalCheckout] failed:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'PayPal checkout failed.',
    };
  }
}

/**
 * Capture a PayPal order after the buyer is redirected back to the
 * portal with `?paid=paypal&token=ORDER_ID`. Idempotent — if the
 * order has already been captured we still record the payment once.
 */
export async function capturePayPalPayment(
  hash: string,
  token: string,
): Promise<PublicActionResult> {
  if (!isValidPublicHash(hash)) return { success: false, error: 'Invalid link.' };
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'Missing PayPal order token.' };
  }
  try {
    const invoice = await loadInvoiceByHash(hash);
    if (!invoice) return { success: false, error: 'Invoice not found.' };
    const userId = (invoice as { userId?: ObjectId }).userId;
    if (!userId) return { success: false, error: 'Invoice has no owner.' };

    const cred = await loadGatewayCredential(userId, 'paypal');
    if (!cred) return { success: false, error: 'PayPal not configured.' };

    const accessToken = await getPaypalAccessToken(cred);
    const captureRes = await fetch(
      `${paypalBaseUrl(cred.mode)}/v2/checkout/orders/${encodeURIComponent(token)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const captureJson = (await captureRes.json().catch(() => ({}))) as {
      status?: string;
      id?: string;
      purchase_units?: Array<{
        payments?: {
          captures?: Array<{
            id?: string;
            status?: string;
            amount?: { value?: string; currency_code?: string };
          }>;
        };
      }>;
    };

    // PayPal returns 422 with ORDER_ALREADY_CAPTURED if already captured —
    // treat as success but skip recording.
    const status = captureJson.status;
    const capture = captureJson.purchase_units?.[0]?.payments?.captures?.[0];

    if (!captureRes.ok && status !== 'COMPLETED') {
      console.error('[capturePayPalPayment] capture failed:', captureJson);
      return {
        success: false,
        error: 'PayPal capture failed. Please try again.',
      };
    }

    const amount = capture?.amount?.value ? Number(capture.amount.value) : 0;
    const currency = capture?.amount?.currency_code || ((invoice as Record<string, unknown>).currency as string) || 'USD';
    const transactionId = capture?.id || captureJson.id || token;

    if (amount > 0) {
      await recordGatewayPayment({
        invoiceId: invoice._id,
        userId,
        amount,
        currency,
        gateway: 'paypal',
        transactionId,
        remarks: 'Captured via PayPal',
      });
    }

    revalidatePath(`/share/invoice/${hash}`);
    return { success: true, message: 'Payment received. Thank you!' };
  } catch (e) {
    console.error('[capturePayPalPayment] failed:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Could not capture PayPal payment.',
    };
  }
}

/* ─── Webhook-facing helpers (exported for /api/webhooks/*) ───── */

/**
 * Record a gateway-captured payment. Exported so webhook routes can call
 * it after verifying signatures. Idempotent on (invoice, transactionId).
 */
export async function recordGatewayPaymentByHash(args: {
  hash?: string;
  invoiceId?: string;
  amount: number;
  currency: string;
  gateway: 'stripe' | 'razorpay' | 'paypal';
  transactionId: string;
  remarks?: string;
}): Promise<PublicActionResult> {
  try {
    const { db } = await connectToDatabase();
    let invoice = null as Awaited<ReturnType<typeof loadInvoiceByHash>>;
    if (args.hash && isValidPublicHash(args.hash)) {
      invoice = await loadInvoiceByHash(args.hash);
    }
    if (!invoice && args.invoiceId && ObjectId.isValid(args.invoiceId)) {
      invoice = await db
        .collection('crm_invoices')
        .findOne({ _id: new ObjectId(args.invoiceId) });
    }
    if (!invoice) return { success: false, error: 'Invoice not found.' };
    const userId = (invoice as { userId?: ObjectId }).userId;
    if (!userId) return { success: false, error: 'Invoice has no owner.' };
    if (!(args.amount > 0)) {
      return { success: false, error: 'Invalid amount.' };
    }

    await recordGatewayPayment({
      invoiceId: invoice._id,
      userId,
      amount: args.amount,
      currency: args.currency,
      gateway: args.gateway,
      transactionId: args.transactionId,
      remarks: args.remarks,
    });

    if (args.hash) revalidatePath(`/share/invoice/${args.hash}`);
    return { success: true };
  } catch (e) {
    console.error('[recordGatewayPaymentByHash] failed:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Could not record payment.',
    };
  }
}

// ---------------------------------------------------------------------
// Detail loader for PDF rendering.
//
// Single-trip read of invoice + tenant company settings + billing
// account + payments. Used by `/share/invoice/[hash]/download` to
// render a server-side PDF — bypasses session for the same reason
// `getPublicInvoice` does (publicHash IS the auth here).
// ---------------------------------------------------------------------

export type PublicInvoiceDetailItem = {
  name?: string;
  description?: string;
  hsnCode?: string;
  quantity: number;
  rate: number;
  total: number;
};

export type PublicInvoiceDetailCompany = {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  logoUrl?: string | null;
};

export type PublicInvoiceDetailClient = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
};

export type PublicInvoiceDetailPayment = {
  date: string | null;
  amount: number;
  mode: string;
  reference: string;
  notes?: string;
};

export type PublicInvoiceDetail = {
  ok: true;
  invoice: {
    _id: string;
    invoiceNumber: string;
    invoiceDate: string | null;
    dueDate: string | null;
    poNumber?: string;
    currency: string;
    status: string;
    subtotal: number;
    discount?: number;
    tax?: number;
    total: number;
    amountPaid?: number;
    balanceDue?: number;
    notes?: string;
    termsAndConditions?: string[];
    paymentInstructions?: string;
  };
  company: PublicInvoiceDetailCompany;
  client: PublicInvoiceDetailClient;
  items: PublicInvoiceDetailItem[];
  payments: PublicInvoiceDetailPayment[];
};

export type PublicInvoiceDetailResult = PublicInvoiceDetail | { ok: false; error: string };

export async function getPublicInvoiceWithDetails(
  hash: string,
): Promise<PublicInvoiceDetailResult> {
  if (!isValidPublicHash(hash)) return { ok: false, error: 'Invalid link.' };
  try {
    const { db } = await connectToDatabase();
    const invoice = await db.collection('crm_invoices').findOne({ publicHash: hash });
    if (!invoice) return { ok: false, error: 'Invoice not found.' };

    // Company — load tenant CRM settings keyed by userId.
    let company: PublicInvoiceDetailCompany = {};
    if (invoice.userId) {
      try {
        const settings = await db
          .collection('crm_settings')
          .findOne({ userId: invoice.userId });
        if (settings) {
          company = {
            name: (settings.companyName as string) || '',
            address: (settings.companyAddress as string) || '',
            email: (settings.companyEmail as string) || '',
            phone: (settings.companyPhone as string) || '',
            taxId: (settings.gstin as string) || '',
            logoUrl: (settings.companyLogo as string) || (settings.logoUrl as string) || null,
          };
        }
      } catch {
        /* non-fatal */
      }
    }

    // Client (Bill To) — best-effort from crm_accounts.
    let client: PublicInvoiceDetailClient = {};
    if (invoice.accountId) {
      try {
        const accountId =
          typeof invoice.accountId === 'string'
            ? new ObjectId(invoice.accountId)
            : invoice.accountId;
        const account = await db.collection('crm_accounts').findOne({ _id: accountId });
        if (account) {
          client = {
            name: (account.name as string) || (account.accountName as string) || '',
            email: (account.email as string) || '',
            phone: (account.phone as string) || '',
            address: (account.billingAddress as string) || (account.address as string) || '',
            taxId: (account.gstin as string) || (account.taxId as string) || '',
          };
        }
      } catch {
        /* non-fatal */
      }
    }

    const items: PublicInvoiceDetailItem[] = Array.isArray(invoice.lineItems)
      ? (invoice.lineItems as Array<Record<string, unknown>>).map((li) => ({
          name: (li.name as string) || (li.description as string) || '',
          description: (li.description as string) || '',
          hsnCode: (li.hsnCode as string) || (li.hsn as string) || '',
          quantity: Number(li.quantity ?? li.qty ?? 0),
          rate: Number(li.rate ?? li.unitPrice ?? 0),
          total: Number(
            li.total ??
              li.amount ??
              Number(li.quantity ?? li.qty ?? 0) * Number(li.rate ?? li.unitPrice ?? 0),
          ),
        }))
      : [];

    const payments: PublicInvoiceDetailPayment[] = [];
    try {
      const paymentDocs = await db
        .collection('crm_payments')
        .find({ invoiceId: invoice._id, status: { $ne: 'rejected' } })
        .sort({ createdAt: 1 })
        .toArray();
      for (const p of paymentDocs) {
        payments.push({
          date: p.createdAt ? new Date(p.createdAt as Date).toISOString() : null,
          amount: Number(p.amount ?? 0),
          mode: (p.gateway as string) || (p.mode as string) || 'Other',
          reference: (p.reference as string) || (p.transactionId as string) || '',
          notes: (p.notes as string) || undefined,
        });
      }
    } catch {
      /* non-fatal */
    }

    const amountPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const total = Number(invoice.total ?? 0);

    return {
      ok: true,
      invoice: {
        _id: invoice._id.toString(),
        invoiceNumber:
          (invoice.invoiceNumber as string) || (invoice.invoiceNo as string) || '',
        invoiceDate: invoice.invoiceDate
          ? new Date(invoice.invoiceDate as Date).toISOString()
          : null,
        dueDate: invoice.dueDate
          ? new Date(invoice.dueDate as Date).toISOString()
          : null,
        poNumber: (invoice.poNumber as string) || undefined,
        currency: (invoice.currency as string) || 'USD',
        status: (invoice.status as string) || 'Draft',
        subtotal: Number(invoice.subtotal ?? invoice.subTotal ?? 0),
        discount: invoice.discount != null ? Number(invoice.discount) : undefined,
        tax: invoice.tax != null ? Number(invoice.tax) : undefined,
        total,
        amountPaid,
        balanceDue: Math.max(total - amountPaid, 0),
        notes: (invoice.notes as string) || undefined,
        termsAndConditions: Array.isArray(invoice.termsAndConditions)
          ? (invoice.termsAndConditions as string[])
          : undefined,
        paymentInstructions: (invoice.paymentInstructions as string) || undefined,
      },
      company,
      client,
      items,
      payments,
    };
  } catch (e) {
    console.error('[getPublicInvoiceWithDetails] failed:', e);
    return { ok: false, error: 'Could not load invoice.' };
  }
}
