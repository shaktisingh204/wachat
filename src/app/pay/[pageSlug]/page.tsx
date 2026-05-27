/**
 * Public hosted checkout page — `/pay/[pageSlug]`.
 *
 * Unauthenticated. Resolves the page by slug through the Rust public
 * endpoint (`/v1/sabcheckout/pages/public/by-slug/:slug`), then hands
 * off to a client component that renders the branded hero + items +
 * payer form and submits via the `createSabcheckoutSession` public
 * action.
 *
 * Theme is applied inline using the page's `themeJson.accent` — does
 * NOT use ZoruUI primitives (per project rules: ZoruUI is admin-only;
 * the public surface uses minimal primitives + theme tokens).
 */
import { notFound } from 'next/navigation';

import { loadPublicSabcheckoutPage } from '@/app/actions/sabcheckout-public.actions';
import { PublicCheckoutForm } from './_components/public-checkout-form';

export const dynamic = 'force-dynamic';

export default async function PublicCheckoutRoute({
  params,
}: {
  params: Promise<{ pageSlug: string }>;
}) {
  const { pageSlug } = await params;
  const res = await loadPublicSabcheckoutPage(pageSlug);
  if (!res.ok) notFound();

  return <PublicCheckoutForm view={res.data} />;
}
