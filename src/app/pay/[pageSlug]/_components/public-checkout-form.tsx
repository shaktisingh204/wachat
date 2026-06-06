'use client';

/**
 * Public-facing checkout form. Renders:
 *   • Hero (logo + headline + description).
 *   • Items selector — radio-list of one-off amounts/plans with optional
 *     quantity steppers.
 *   • Payer fields — name/email/phone + any custom fields declared on
 *     the page.
 *   • Submit "Pay" button — calls `createSabcheckoutSession` then redirects
 *     to the gateway-provided URL.
 *
 * Uses minimal primitives + theme tokens; ZoruUI is intentionally NOT
 * used here (it's admin-only).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { createSabcheckoutSession } from '@/app/actions/sabcheckout-public.actions';
import type {
  SabcheckoutCheckoutItem,
  SabcheckoutPagePublicView,
} from '@/lib/rust-client/sabcheckout-pages';
import type { SabcheckoutSelectedItem } from '@/lib/rust-client/sabcheckout-sessions';

interface RowState {
  selected: boolean;
  quantity: number;
}

function unitAmountFor(item: SabcheckoutCheckoutItem): number {
  // For plan items the unit amount is resolved server-side; the public
  // form just stamps 0 here and the gateway/Rust layer fills it in.
  return item.type === 'amount' ? item.amountMinor ?? 0 : 0;
}

export function PublicCheckoutForm({
  view,
}: {
  view: SabcheckoutPagePublicView;
}) {
  const router = useRouter();
  const page = view.page;
  const accent =
    (page.themeJson?.accent as string | undefined) ?? '#6366f1';

  const [rows, setRows] = React.useState<RowState[]>(
    () =>
      (page.items ?? []).map((_, i) => ({
        selected: i === 0,
        quantity: 1,
      })),
  );

  const [payer, setPayer] = React.useState({
    name: '',
    email: '',
    phone: '',
  });
  const [customValues, setCustomValues] = React.useState<
    Record<string, string>
  >({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function setRow(i: number, patch: Partial<RowState>) {
    setRows((arr) => arr.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const subtotal = React.useMemo(() => {
    let s = 0;
    (page.items ?? []).forEach((it, i) => {
      if (!rows[i]?.selected) return;
      const q = it.allowQuantity ? rows[i].quantity : 1;
      s += unitAmountFor(it) * q;
    });
    return s;
  }, [page.items, rows]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const selectedItems: SabcheckoutSelectedItem[] = (page.items ?? [])
      .map((it, i) => {
        if (!rows[i]?.selected) return null;
        const q = it.allowQuantity ? rows[i].quantity : 1;
        const unit = unitAmountFor(it);
        return {
          itemIndex: i,
          type: it.type,
          label: it.label,
          unitAmountMinor: unit,
          quantity: q,
          lineTotalMinor: unit * q,
          planId: it.planId,
        } satisfies SabcheckoutSelectedItem;
      })
      .filter((x): x is SabcheckoutSelectedItem => x !== null);

    if (selectedItems.length === 0) {
      setError('Pick at least one item.');
      return;
    }

    for (const f of page.requireFields ?? []) {
      if (!f.required) continue;
      if (f.custom) {
        if (!(customValues[f.name] ?? '').trim()) {
          setError(`${f.label} is required.`);
          return;
        }
      } else if (f.name === 'email' && !payer.email.trim()) {
        setError('Email is required.');
        return;
      } else if (f.name === 'name' && !payer.name.trim()) {
        setError('Name is required.');
        return;
      } else if (f.name === 'phone' && !payer.phone.trim()) {
        setError('Phone is required.');
        return;
      }
    }

    setBusy(true);
    const res = await createSabcheckoutSession({
      pageSlug: page.slug,
      payerEmail: payer.email || undefined,
      payerName: payer.name || undefined,
      payerPhone: payer.phone || undefined,
      customFieldsJson:
        Object.keys(customValues).length > 0 ? customValues : undefined,
      selectedItems,
      totals: {
        subtotalMinor: subtotal,
        totalMinor: subtotal,
        currency: page.currency,
      },
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    if (res.redirectUrl) {
      window.location.href = res.redirectUrl;
      return;
    }
    router.push(`/pay/${encodeURIComponent(page.slug)}/success?sessionId=${res.sessionId}`);
  }

  return (
    <main
      className="min-h-screen w-full bg-gradient-to-b from-[#fafafa] to-[#f4f4f5] px-4 py-10"
    >
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-3 text-center">
          {page.logoFileId ? (
            // Logo is referenced by SabFiles file id; resolved via the
            // existing `/api/sabfiles/file/[fileId]` route on the live
            // app (TODO: confirm route name on integration).
            <img
              src={`/api/sabfiles/file/${encodeURIComponent(page.logoFileId)}`}
              alt={`${page.displayName} logo`}
              className="mx-auto h-12 w-auto"
            />
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">
            {page.displayName}
          </h1>
          {page.headline ? (
            <p className="text-base text-zoru-ink">{page.headline}</p>
          ) : null}
          {page.description ? (
            <p className="text-sm text-zoru-ink">{page.description}</p>
          ) : null}
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-6 rounded-xl border border-zoru-line bg-white p-6 shadow-sm"
        >
          {/* Items */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Choose what to pay</legend>
            {(page.items ?? []).map((it, i) => {
              const unit = unitAmountFor(it);
              return (
                <label
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-zoru-line p-3 transition-colors"
                  style={{
                    borderColor: rows[i]?.selected ? accent : undefined,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!rows[i]?.selected}
                    onChange={(e) => setRow(i, { selected: e.target.checked })}
                    style={{ accentColor: accent }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{it.label}</div>
                    <div className="text-xs text-zoru-ink">
                      {it.type === 'amount'
                        ? `${page.currency} ${(unit / 100).toFixed(2)}`
                        : 'Subscription plan'}
                    </div>
                  </div>
                  {it.allowQuantity && rows[i]?.selected ? (
                    <input
                      type="number"
                      min={1}
                      value={rows[i]?.quantity ?? 1}
                      onChange={(e) =>
                        setRow(i, {
                          quantity: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-16 rounded-md border border-zoru-line px-2 py-1 text-sm"
                    />
                  ) : null}
                </label>
              );
            })}
          </fieldset>

          {/* Payer fields */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Your details</legend>
            {(page.requireFields ?? []).map((f) => {
              if (f.custom) {
                return (
                  <label key={f.name} className="block space-y-1">
                    <span className="text-xs text-zoru-ink">{f.label}</span>
                    <input
                      value={customValues[f.name] ?? ''}
                      onChange={(e) =>
                        setCustomValues((cv) => ({
                          ...cv,
                          [f.name]: e.target.value,
                        }))
                      }
                      required={!!f.required}
                      className="w-full rounded-md border border-zoru-line px-3 py-2 text-sm"
                    />
                  </label>
                );
              }
              if (f.name === 'email') {
                return (
                  <label key={f.name} className="block space-y-1">
                    <span className="text-xs text-zoru-ink">{f.label}</span>
                    <input
                      type="email"
                      value={payer.email}
                      onChange={(e) =>
                        setPayer({ ...payer, email: e.target.value })
                      }
                      required={!!f.required}
                      className="w-full rounded-md border border-zoru-line px-3 py-2 text-sm"
                    />
                  </label>
                );
              }
              if (f.name === 'phone') {
                return (
                  <label key={f.name} className="block space-y-1">
                    <span className="text-xs text-zoru-ink">{f.label}</span>
                    <input
                      type="tel"
                      value={payer.phone}
                      onChange={(e) =>
                        setPayer({ ...payer, phone: e.target.value })
                      }
                      required={!!f.required}
                      className="w-full rounded-md border border-zoru-line px-3 py-2 text-sm"
                    />
                  </label>
                );
              }
              return (
                <label key={f.name} className="block space-y-1">
                  <span className="text-xs text-zoru-ink">{f.label}</span>
                  <input
                    value={payer.name}
                    onChange={(e) =>
                      setPayer({ ...payer, name: e.target.value })
                    }
                    required={!!f.required}
                    className="w-full rounded-md border border-zoru-line px-3 py-2 text-sm"
                  />
                </label>
              );
            })}
          </fieldset>

          {/* Total + submit */}
          <div className="flex items-center justify-between border-t border-zoru-line pt-4">
            <span className="text-sm text-zoru-ink">Total</span>
            <span className="text-lg font-semibold tabular-nums">
              {page.currency} {(subtotal / 100).toFixed(2)}
            </span>
          </div>

          {error ? (
            <p className="text-sm text-zoru-ink" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || subtotal <= 0}
            className="w-full rounded-md px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {busy ? 'Processing…' : 'Pay'}
          </button>
        </form>

        <p className="text-center text-xs text-zoru-ink-muted">
          Powered by SabCheckout
        </p>
      </div>
    </main>
  );
}
