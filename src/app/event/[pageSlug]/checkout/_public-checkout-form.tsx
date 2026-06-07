'use client';

/**
 * Client island for the public checkout page. Buyer fields + an
 * order summary; submission calls the public order-create action,
 * then redirects to /success with the order id.
 *
 * Payment redirect TODO: when a real gateway is wired through
 * `ICheckoutGateway`, swap the immediate redirect for the gateway's
 * `redirectUrl` (mirror the SabCheckout flow). For now the `success`
 * page calls `confirmPublicTicketOrder` directly - fine against the
 * default `MockGateway`.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { createPublicTicketOrder } from '@/app/actions/sabbackstage-public.actions';
import type { SabbackstageTicketTypeDoc } from '@/lib/rust-client/sabbackstage-ticket-types';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  Input,
} from '@/components/sabcrm/20ui';

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
      <Card variant="outlined" padding="md">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
          Order summary
        </CardTitle>
        <CardBody className="space-y-1 text-sm">
          <ul className="space-y-1">
            {cart.map((c) => {
              const t = typeById.get(c.typeId);
              if (!t) return null;
              return (
                <li key={c.typeId} className="flex justify-between">
                  <span>
                    {t.name} x {c.qty}
                  </span>
                  <span>{formatMoney(t.priceMinor * c.qty, t.currency)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-between border-t border-[var(--st-border)] pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(subtotal, currency)}</span>
          </div>
        </CardBody>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
          Buyer details
        </h2>
        <Field label="Full name" required>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email" required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Phone (optional)">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
      </section>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Button
        type="submit"
        variant="primary"
        block
        loading={busy}
        className="text-[var(--st-text-inverted)]"
        style={{ backgroundColor: accent }}
      >
        {busy ? 'Processing...' : 'Pay and reserve tickets'}
      </Button>
    </form>
  );
}
