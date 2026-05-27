'use client';

/**
 * Client island for the public checkout page. Buyer fields + an
 * order summary; submission calls the public order-create action,
 * then redirects to /success with the order id.
 *
 * Payment redirect TODO: when a real gateway is wired through
 * `ICheckoutGateway`, swap the immediate redirect for the gateway's
 * `redirectUrl` (mirror the SabCheckout flow). For now the `success`
 * page calls `confirmPublicTicketOrder` directly — fine against the
 * default `MockGateway`.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { createPublicTicketOrder } from '@/app/actions/sabbackstage-public.actions';
import type { SabbackstageTicketTypeDoc } from '@/lib/rust-client/sabbackstage-ticket-types';

interface CartLine {
  typeId: string;
  qty: number;
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

export function PublicCheckoutForm({
  pageSlug,
  eventId,
  ticketTypes,
  cart,
  accent,
}: {
  pageSlug: string;
  eventId: string;
  ticketTypes: SabbackstageTicketTypeDoc[];
  cart: CartLine[];
  accent: string;
}): React.JSX.Element {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const typeById = React.useMemo(
    () => new Map(ticketTypes.map((t) => [t._id, t])),
    [ticketTypes],
  );
  const currency = ticketTypes[0]?.currency ?? 'INR';

  const subtotal = cart.reduce((s, c) => {
    const t = typeById.get(c.typeId);
    return s + (t ? t.priceMinor * c.qty : 0);
  }, 0);

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    e.preventDefault();
    setError(null);
    if (cart.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    setBusy(true);
    const r = await createPublicTicketOrder({
      eventId,
      buyerName: name.trim(),
      buyerEmail: email.trim(),
      buyerPhone: phone.trim() || undefined,
      items: cart,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push(
      `/event/${encodeURIComponent(pageSlug)}/success?orderId=${r.data.orderId}`,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <section className="rounded-xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider opacity-70">
          Order summary
        </h2>
        <ul className="mt-2 space-y-1 text-sm">
          {cart.map((c) => {
            const t = typeById.get(c.typeId);
            if (!t) return null;
            return (
              <li key={c.typeId} className="flex justify-between">
                <span>
                  {t.name} × {c.qty}
                </span>
                <span>{formatMoney(t.priceMinor * c.qty, t.currency)}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex justify-between border-t border-white/15 pt-2 text-base font-semibold">
          <span>Total</span>
          <span>{formatMoney(subtotal, currency)}</span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider opacity-70">
          Buyer details
        </h2>
        <label className="block text-sm">
          Full name
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Phone (optional)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm"
          />
        </label>
      </section>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md px-5 py-3 text-sm font-medium disabled:opacity-50"
        style={{ backgroundColor: accent, color: '#fff' }}
      >
        {busy ? 'Processing…' : 'Pay and reserve tickets'}
      </button>
    </form>
  );
}
