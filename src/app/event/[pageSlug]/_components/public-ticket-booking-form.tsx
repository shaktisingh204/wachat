'use client';

/**
 * Public ticket booking form — quantity steppers per ticket type and a
 * "Book tickets" CTA that redirects to `/event/[slug]/checkout` with
 * the chosen quantities encoded in the query string.
 *
 * Kept dependency-free (no ZoruUI) so the public surface stays light
 * and theme-able via the page's `accent` color.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import type { SabbackstageTicketTypeDoc } from '@/lib/rust-client/sabbackstage-ticket-types';

interface Props {
  pageSlug: string;
  eventId: string;
  ticketTypes: SabbackstageTicketTypeDoc[];
  accent: string;
}

function formatMoney(minor: number, currency: string): string {
  const major = (minor || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'INR',
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

export function PublicTicketBookingForm({
  pageSlug,
  ticketTypes,
  accent,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [qty, setQty] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(ticketTypes.map((t) => [t._id, 0])),
  );

  const totalSeats = Object.values(qty).reduce((n, v) => n + v, 0);
  const totalMinor = ticketTypes.reduce(
    (sum, t) => sum + (qty[t._id] || 0) * t.priceMinor,
    0,
  );
  const currency = ticketTypes[0]?.currency ?? 'INR';

  function bump(typeId: string, delta: number): void {
    setQty((q) => ({
      ...q,
      [typeId]: Math.max(0, (q[typeId] || 0) + delta),
    }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (totalSeats === 0) return;
    const cart = ticketTypes
      .filter((t) => (qty[t._id] || 0) > 0)
      .map((t) => `${t._id}:${qty[t._id]}`)
      .join(',');
    router.push(
      `/event/${encodeURIComponent(pageSlug)}/checkout?items=${encodeURIComponent(cart)}`,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      {ticketTypes.map((t) => {
        const remaining =
          t.capacity > 0 ? Math.max(0, t.capacity - t.soldCount) : null;
        return (
          <div
            key={t._id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 p-4"
          >
            <div className="min-w-0">
              <div className="text-base font-medium">{t.name}</div>
              {t.description ? (
                <div className="text-xs opacity-70">{t.description}</div>
              ) : null}
              <div className="mt-1 text-sm opacity-80">
                {formatMoney(t.priceMinor, t.currency)}
                {remaining != null ? (
                  <span className="ml-2 opacity-60">
                    · {remaining} left
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="h-8 w-8 rounded-md border border-white/30"
                aria-label={`Decrease ${t.name}`}
                onClick={() => bump(t._id, -1)}
              >
                −
              </button>
              <span className="w-6 text-center text-sm">
                {qty[t._id] || 0}
              </span>
              <button
                type="button"
                className="h-8 w-8 rounded-md border border-white/30"
                aria-label={`Increase ${t.name}`}
                onClick={() => bump(t._id, 1)}
              >
                +
              </button>
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="text-sm opacity-80">
          {totalSeats} seats · {formatMoney(totalMinor, currency)}
        </div>
        <button
          type="submit"
          disabled={totalSeats === 0}
          className="rounded-md px-5 py-2 text-sm font-medium text-black disabled:opacity-40"
          style={{ backgroundColor: accent, color: '#fff' }}
        >
          Book tickets
        </button>
      </div>
    </form>
  );
}
