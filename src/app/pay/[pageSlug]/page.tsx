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
import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
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

  // SabPay payment ids are `pay_<hex>` and never collide with SabCheckout
  // page slugs, so we only consult the SabPay engine for that shape. The
  // hosted-checkout view (payment + merchant branding) comes from Rust.
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
      // 404 → fall through to SabCheckout; anything else is a real failure.
      if (!(err instanceof RustApiError && err.status === 404)) throw err;
    }
  }

  const res = await loadPublicSabcheckoutPage(pageSlug);
  if (!res.ok) notFound();

  return <PublicCheckoutForm view={res.data} />;
}
