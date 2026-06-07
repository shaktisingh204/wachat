'use client';

/**
 * Public ticket booking form. Quantity steppers per ticket type and a
 * "Book tickets" CTA that redirects to `/event/[slug]/checkout` with
 * the chosen quantities encoded in the query string.
 *
 * Built on the 20ui design system. The page's runtime `accent` color is
 * applied to the primary CTA via an inline style (genuinely user-picked).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Ticket } from 'lucide-react';

import { Button, IconButton } from '@/components/sabcrm/20ui/button';
import { Card } from '@/components/sabcrm/20ui/card';
import { EmptyState } from '@/components/sabcrm/20ui/feedback';
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

  if (ticketTypes.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          icon={Ticket}
          title="No tickets available"
          description="Tickets for this event have not been published yet. Check back soon."
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      {ticketTypes.map((t) => {
        const remaining =
          t.capacity > 0 ? Math.max(0, t.capacity - t.soldCount) : null;
        const count = qty[t._id] || 0;
        return (
          <Card key={t._id} padding="md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-medium text-[var(--st-text)]">
                  {t.name}
                </div>
                {t.description ? (
                  <div className="text-xs text-[var(--st-text-tertiary)]">
                    {t.description}
                  </div>
                ) : null}
                <div className="mt-1 text-sm text-[var(--st-text-secondary)]">
                  {formatMoney(t.priceMinor, t.currency)}
                  {remaining != null ? (
                    <span className="ml-2 text-[var(--st-text-tertiary)]">
                      , {remaining} left
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <IconButton
                  variant="outline"
                  size="sm"
                  icon={Minus}
                  label={`Decrease ${t.name}`}
                  disabled={count === 0}
                  onClick={() => bump(t._id, -1)}
                />
                <span className="w-6 text-center text-sm text-[var(--st-text)]">
                  {count}
                </span>
                <IconButton
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  label={`Increase ${t.name}`}
                  onClick={() => bump(t._id, 1)}
                />
              </div>
            </div>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="text-sm text-[var(--st-text-secondary)]">
          {totalSeats} seats, {formatMoney(totalMinor, currency)}
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={totalSeats === 0}
          style={{ backgroundColor: accent, borderColor: accent }}
        >
          Book tickets
        </Button>
      </div>
    </form>
  );
}
