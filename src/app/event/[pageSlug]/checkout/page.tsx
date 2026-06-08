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
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

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
      // backgroundColor is the buyer-facing event theme color picked per page,
      // so it is genuinely runtime-computed and stays inline.
      style={{ backgroundColor: theme.background ?? '#0b0b10' }}
      className="20ui min-h-screen px-4 py-10 text-white md:px-12"
    >
      <div className="mx-auto max-w-2xl">
        <PageHeader bordered={false}>
          <PageHeaderHeading>
            <PageTitle>Checkout</PageTitle>
            <PageDescription>{page.page.headline}</PageDescription>
          </PageHeaderHeading>
        </PageHeader>
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
