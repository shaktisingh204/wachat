/**
 * Public hosted checkout page — `/pay/[pageSlug]`.
 *
 * Unauthenticated. ONE dynamic segment serves both public checkout
 * products (Next.js forbids sibling `[id]` + `[pageSlug]` folders):
 *
 *   1. SabPay hosted checkout — `checkout_url` is `/pay/<paymentId>`.
 *      The unguessable payment id is the capability; resolved first via
 *      `getPaymentDocById`.
 *   2. SabCheckout page — `/pay/<slug>` resolves the page by slug
 *      through the Rust public endpoint
 *      (`/v1/sabcheckout/pages/public/by-slug/:slug`).
 *
 * Theme is applied inline using each product's own branding — does
 * NOT use Ui20 primitives (per project rules: Ui20 is admin-only;
 * the public surface uses minimal primitives + theme tokens).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { loadPublicSabcheckoutPage } from '@/app/actions/sabcheckout-public.actions';
import {
  getMerchantDocByUserId,
  getPaymentDocById,
} from '@/lib/sabpay/db.server';
import { PublicCheckoutForm } from './_components/public-checkout-form';
import { CheckoutClient, type CheckoutData } from './checkout-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

export default async function PublicCheckoutRoute({
  params,
}: {
  params: Promise<{ pageSlug: string }>;
}) {
  const { pageSlug } = await params;

  // SabPay payment ids are unguessable and never collide with page
  // slugs, so the id lookup safely goes first.
  const payment = await getPaymentDocById(pageSlug);
  if (payment) {
    const merchant = await getMerchantDocByUserId(payment.userId);

    const data: CheckoutData = {
      paymentId: payment.paymentId,
      mode: payment.mode,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      customerName: payment.customerName ?? '',
      customerEmail: payment.customerEmail ?? '',
      customerPhone: payment.customerPhone ?? '',
      successUrl: payment.successUrl,
      cancelUrl: payment.cancelUrl,
      failureReason: payment.failureReason,
      business: {
        name: merchant?.businessName || 'SabPay merchant',
        logoUrl: merchant?.logoUrl,
        brandColor: merchant?.brandColor || '#4f46e5',
      },
    };

    return <CheckoutClient data={data} />;
  }

  const res = await loadPublicSabcheckoutPage(pageSlug);
  if (!res.ok) notFound();

  return <PublicCheckoutForm view={res.data} />;
}
