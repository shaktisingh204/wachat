/**
 * Public checkout — `/event/[pageSlug]/checkout?items=typeId:qty,...`.
 *
 * Server-loads the page bundle (so we can render headline + summary)
 * and hands the cart + buyer form off to the client island. The
 * island talks to `createPublicTicketOrder` and (when the gateway
 * returns) `confirmPublicTicketOrder`.
 *
 * Payment integration: `ICheckoutGateway` from
 * `@/lib/sabcheckout/gateway`. The current `MockGateway` always
 * returns `completed`, which lets the success page flip the order
 * immediately. Wiring a real gateway is a TODO.
 */
import { notFound } from 'next/navigation';

import { loadPublicEventPage } from '@/app/actions/sabbackstage-public.actions';
import { PublicCheckoutForm } from './_public-checkout-form';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ pageSlug: string }>;
  searchParams: Promise<{ items?: string }>;
}

export default async function PublicCheckoutPage({
  params,
  searchParams,
}: Props) {
  const { pageSlug } = await params;
  const { items } = await searchParams;
  const result = await loadPublicEventPage(pageSlug);
  if (!result.ok) notFound();
  const { page, ticketTypes } = result.data;
  const theme = (page.page.themeJson ?? {}) as {
    accent?: string;
    background?: string;
  };

  const cart =
    items
      ?.split(',')
      .map((s) => s.split(':'))
      .map(([typeId, qty]) => ({ typeId, qty: Number(qty) || 0 }))
      .filter((x) => x.typeId && x.qty > 0) ?? [];

  return (
    <main
      style={{
        backgroundColor: theme.background ?? '#0b0b10',
        color: '#fff',
        minHeight: '100vh',
      }}
      className="px-4 py-10 md:px-12"
    >
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <p className="mt-1 text-sm opacity-70">{page.page.headline}</p>
        <PublicCheckoutForm
          pageSlug={pageSlug}
          eventId={page.eventId}
          ticketTypes={ticketTypes}
          cart={cart}
          accent={theme.accent ?? '#7c3aed'}
        />
      </div>
    </main>
  );
}
