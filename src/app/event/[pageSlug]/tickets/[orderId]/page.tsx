/**
 * Printable / downloadable tickets — `/event/[pageSlug]/tickets/[orderId]`.
 *
 * Server-loads all tickets for the order (unauthenticated) and renders
 * a print-friendly QR-code list. QR rendering uses the standard
 * Google chart-server URL pattern as a zero-dependency renderer; for
 * an air-gapped install, swap the `<img>` for a local QR component
 * (TODO).
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { loadPublicOrderTickets } from '@/app/actions/sabbackstage-public.actions';
import { PrintButton } from './_print-button';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ pageSlug: string; orderId: string }>;
}

function qrUrl(payload: string): string {
  const encoded = encodeURIComponent(payload);
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encoded}`;
}

export default async function PrintableTicketsPage({ params }: Props) {
  const { pageSlug, orderId } = await params;
  const r = await loadPublicOrderTickets(orderId);
  if (!r.ok) notFound();
  const { order, tickets } = r.data;

  return (
    <main className="min-h-screen bg-white px-4 py-10 text-black md:px-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/event/${encodeURIComponent(pageSlug)}`}
            className="text-xs underline"
          >
            ← Back to event
          </Link>
          <PrintButton />
        </div>

        <h1 className="mt-4 text-2xl font-bold">Your tickets</h1>
        <p className="text-sm opacity-70">
          Order <code>{order._id}</code> · {order.buyerName} ·{' '}
          {order.buyerEmail}
        </p>

        <ul className="mt-6 space-y-4">
          {tickets.length === 0 ? (
            <li className="rounded-lg border border-dashed border-black/30 p-6 text-center text-sm opacity-70">
              Tickets are being issued. Please refresh in a moment.
            </li>
          ) : (
            tickets.map((t) => (
              <li
                key={t._id}
                className="flex items-center justify-between gap-4 break-inside-avoid rounded-xl border border-black/15 p-4"
              >
                <div>
                  <div className="text-base font-semibold">
                    {t.attendeeName}
                  </div>
                  <div className="text-xs opacity-70">{t.attendeeEmail}</div>
                  <div className="mt-1 text-[11px] opacity-60">
                    QR · {t.qrCode}
                  </div>
                  <div className="mt-1 text-[11px]">
                    Status: <strong>{t.status}</strong>
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl(t.qrCode)}
                  alt={`QR for ${t.attendeeName}`}
                  width={120}
                  height={120}
                />
              </li>
            ))
          )}
        </ul>
      </div>
    </main>
  );
}
