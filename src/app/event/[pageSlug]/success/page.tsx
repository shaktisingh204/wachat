/**
 * Public order success page — `/event/[pageSlug]/success?orderId=…`.
 *
 * Confirms the order against the (currently mock) gateway by calling
 * `confirmPublicTicketOrder(orderId, paymentRef)`. The action is
 * idempotent; once confirmed, tickets are issued (one row per seat).
 *
 * TODO: when a real gateway is wired, the gateway-return route will
 * call `confirmPublicTicketOrder` BEFORE the redirect lands here, and
 * this page will simply look the order up.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import {
  confirmPublicTicketOrder,
  loadPublicOrderSummary,
} from '@/app/actions/sabbackstage-public.actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ pageSlug: string }>;
  searchParams: Promise<{ orderId?: string; paymentRef?: string }>;
}

export default async function PublicSuccessPage({
  params,
  searchParams,
}: Props) {
  const { pageSlug } = await params;
  const { orderId, paymentRef } = await searchParams;
  if (!orderId) redirect(`/event/${pageSlug}`);

  // Pull the current state first — only confirm if still pending.
  const initial = await loadPublicOrderSummary(orderId);
  if (!initial.ok) notFound();
  let order = initial.data;
  if (order.status === 'pending') {
    const confirmed = await confirmPublicTicketOrder(
      orderId,
      paymentRef ?? `mock_${Date.now()}`,
    );
    if (confirmed.ok) {
      order = confirmed.data.order;
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-16 text-white md:px-12">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl font-bold">You&apos;re in!</h1>
        <p className="mt-2 text-sm opacity-80">
          Order <code>{orderId}</code> · status{' '}
          <strong>{order.status}</strong>
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href={`/event/${encodeURIComponent(pageSlug)}/tickets/${orderId}`}
            className="rounded-md bg-white px-5 py-2 text-sm font-medium text-black"
          >
            Download tickets
          </Link>
          <Link
            href={`/event/${encodeURIComponent(pageSlug)}`}
            className="text-xs underline opacity-70"
          >
            Back to event
          </Link>
        </div>
      </div>
    </main>
  );
}
