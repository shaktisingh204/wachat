/**
 * Public hosted checkout page — `/pay/[pageSlug]`.
 *
 * Unauthenticated. ONE dynamic segment serves EVERY public checkout surface
 * (Next.js forbids sibling dynamic folders next to `[pageSlug]`, and a past
 * `/pay/[id]` addition broke all dynamic routes — NEVER add one). Resolution is
 * by prefix, in order:
 *
 *   1. `pay_…`   → SabPay hosted checkout (the payment id is the capability).
 *   2. `plink_…` → SabPay payment link → start/resume a `pay_` session.
 *   3. `qr_…`    → SabPay QR code → start a `pay_` session (amount entry for
 *                  open-amount QRs).
 *   4. `<slug>`  → SabPay no-code payment page (custom fields + amount), else
 *   5. `<slug>`  → SabCheckout page (the historical fallback).
 *
 * Every non-`pay_` surface funnels into a `pay_` session and forwards the
 * browser to `/pay/<pay_id>`, so the real payment always runs through ONE
 * checkout state machine. Theme is applied inline per product's own branding —
 * NO Ui20 primitives (admin-only; the public surface uses minimal primitives +
 * theme tokens).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { loadPublicSabcheckoutPage } from '@/app/actions/sabcheckout-public.actions';
import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { PublicCheckoutForm } from './_components/public-checkout-form';
import { PublicPayLanding } from './_components/public-pay-client';
import { CheckoutClient, type CheckoutData } from './checkout-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

function isNotFound(err: unknown): boolean {
  return err instanceof RustApiError && err.status === 404;
}

export default async function PublicCheckoutRoute({
  params,
}: {
  params: Promise<{ pageSlug: string }>;
}) {
  const { pageSlug } = await params;

  /* 1. SabPay hosted checkout — `pay_<hex>`. */
  if (pageSlug.startsWith('pay_')) {
    try {
      const view = await rustClient.sabpay.getCheckout(pageSlug);
      const data: CheckoutData = {
        paymentId: view.paymentId,
        mode: view.mode,
        status: view.status,
        amount: view.amount,
        currency: view.currency,
        description: view.description,
        customerName: view.customerName,
        customerEmail: view.customerEmail,
        customerPhone: view.customerPhone,
        successUrl: view.successUrl,
        cancelUrl: view.cancelUrl,
        failureReason: view.failureReason,
        business: view.business,
      };
      return <CheckoutClient data={data} />;
    } catch (err) {
      if (!isNotFound(err)) throw err;
      notFound();
    }
  }

  /* 2. Payment link — `plink_<hex>`. */
  if (pageSlug.startsWith('plink_')) {
    try {
      const link = await rustClient.sabpay.getPublicLink(pageSlug);
      const notice =
        link.status === 'paid'
          ? { title: 'Already paid', message: 'This payment link has already been paid. Thank you!', tone: 'success' as const }
          : link.status === 'cancelled'
            ? { title: 'Link cancelled', message: 'This payment link is no longer active.', tone: 'failed' as const }
            : link.status === 'expired'
              ? { title: 'Link expired', message: 'This payment link has expired.', tone: 'failed' as const }
              : undefined;
      return (
        <PublicPayLanding
          sessionUrl={`/api/sabpay/checkout/link/${encodeURIComponent(pageSlug)}/session`}
          business={link.business}
          mode={link.mode}
          title={link.description || 'Payment'}
          currency={link.currency}
          fixedAmount={link.amount}
          notice={notice}
        />
      );
    } catch (err) {
      if (!isNotFound(err)) throw err;
      notFound();
    }
  }

  /* 3. QR code — `qr_<hex>`. */
  if (pageSlug.startsWith('qr_')) {
    try {
      const qr = await rustClient.sabpay.getPublicQr(pageSlug);
      const notice =
        qr.status === 'closed'
          ? { title: 'QR closed', message: 'This QR code is no longer accepting payments.', tone: 'failed' as const }
          : undefined;
      return (
        <PublicPayLanding
          sessionUrl={`/api/sabpay/checkout/qr/${encodeURIComponent(pageSlug)}/session`}
          business={qr.business}
          mode={qr.mode}
          title={qr.description || 'Scan & pay'}
          fixedAmount={qr.fixedAmount ? qr.amount : undefined}
          amountEditable={!qr.fixedAmount}
          notice={notice}
        />
      );
    } catch (err) {
      if (!isNotFound(err)) throw err;
      notFound();
    }
  }

  /* 4. SabPay no-code payment page (resolved by slug). */
  try {
    const page = await rustClient.sabpay.getPublicPage(pageSlug);
    return (
      <PublicPayLanding
        sessionUrl={`/api/sabpay/checkout/page/${encodeURIComponent(pageSlug)}/session`}
        business={page.business}
        mode={page.mode}
        title={page.title}
        description={page.description}
        fixedAmount={page.amountType === 'fixed' ? page.amount : undefined}
        amountEditable={page.amountType === 'customer_decided'}
        minAmount={page.minAmount}
        fields={page.fields}
        brandingImageUrl={page.brandingImageUrl}
      />
    );
  } catch (err) {
    // 404 → fall through to SabCheckout; anything else is a real failure.
    if (!isNotFound(err)) throw err;
  }

  /* 5. SabCheckout page — the historical fallback. */
  const res = await loadPublicSabcheckoutPage(pageSlug);
  if (!res.ok) notFound();

  return <PublicCheckoutForm view={res.data} />;
}
