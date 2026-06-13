'use client';

/**
 * SabCRM Commerce — POS register client island (spec WI-22).
 *
 * A faithful port of the legacy `dashboard/crm/pos` terminal onto the
 * project-scoped `/sabcrm/commerce/register`. Two-pane: item-picker
 * grid + barcode search (left), cart + customer + payment tabs
 * (Cash / Card / UPI / Split) + hold + print-receipt dialog (right).
 *
 * Port deltas (spec §5.2) from the legacy Mongo terminal:
 *   - the six legacy `crm-pos.actions` imports → the project-scoped
 *     `createSabcrmPosTransaction` / `createSabcrmPosHold` /
 *     `recallSabcrmPosHold` / `searchSabcrmRegisterItems`;
 *   - the terminal-registry / heartbeat `useEffect` is DELETED (no
 *     project-scoped terminal registry in v1);
 *   - the free-text "Customer" input → an `EntityPicker` over
 *     `searchSabcrmFinanceParties` (walk-in = null; `customerName` is
 *     no longer persisted by the crate);
 *   - cart lines map `qty → quantity` and DROP `sku` at submit (the
 *     crate doesn't persist sku); totals are never sent (server-
 *     computed) — the client keeps preview math only;
 *   - the receipt number is `res.data.entity.transactionNumber`;
 *   - the `ActionResult` envelope (`{ ok, data } / { ok, error }`)
 *     replaces the legacy `{ success, error }` shape.
 */

import * as React from 'react';
import {
  Banknote,
  CreditCard,
  Minus,
  PauseCircle,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Label,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';

import { EntityPicker } from '@/app/sabcrm/finance/_components/doc-surface';

import {
  createSabcrmPosTransaction,
  createSabcrmPosHold,
  recallSabcrmPosHold,
} from '@/app/actions/sabcrm-commerce-register.actions';
import { searchSabcrmRegisterItems } from '@/app/actions/sabcrm-commerce-docs.actions';
import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import type {
  CrmPosPaymentMethod,
  CrmPosPaymentSplit,
} from '@/lib/rust-client/crm-pos';

import '@/components/sabcrm/20ui/surface-crm-base.css';

/* ─── Props ───────────────────────────────────────────────────── */

export interface RegisterSession {
  id: string;
  terminalId: string;
}

export interface RegisterItem {
  id: string;
  name: string;
  sku: string | null;
  sellingPrice: number;
  taxRate: number;
}

/** A held ticket prefilled into the cart (recall flow). */
export interface RegisterPrefillHold {
  id: string;
  lineItems: {
    itemId: string | null;
    name: string;
    quantity: number;
    rate: number;
    taxRate: number;
  }[];
  customerId: string | null;
}

interface RegisterClientProps {
  session: RegisterSession;
  initialItems: RegisterItem[];
  prefillHold: RegisterPrefillHold | null;
  prefillCustomer: { id: string; label: string } | null;
}

/* ─── Cart line (client-only; `sku` kept for display, dropped at submit) ── */

interface CartLine {
  key: string;
  itemId: string | null;
  sku: string | null;
  name: string;
  qty: number;
  rate: number;
  taxRate: number;
  total: number;
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function fmtMoney(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return inr.format(value);
}

function makeCartKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

const PAYMENT_METHODS: Array<{
  value: CrmPosPaymentMethod;
  label: string;
  icon: React.ElementType;
}> = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'split', label: 'Split', icon: ShoppingCart },
];

export function RegisterClient({
  session,
  initialItems,
  prefillHold,
  prefillCustomer,
}: RegisterClientProps): React.JSX.Element {
  const [items, setItems] = React.useState<RegisterItem[]>(initialItems);
  const [query, setQuery] = React.useState('');
  const [searching, setSearching] = React.useState(false);

  const [cart, setCart] = React.useState<CartLine[]>(() => {
    if (!prefillHold) return [];
    return prefillHold.lineItems.map((li) => ({
      key: makeCartKey(),
      itemId: li.itemId,
      sku: null,
      name: li.name,
      qty: li.quantity,
      rate: li.rate,
      taxRate: li.taxRate,
      total: li.quantity * li.rate,
    }));
  });

  // Customer is now an EntityPicker (walk-in = null).
  const [customerId, setCustomerId] = React.useState<string | null>(
    prefillCustomer?.id ?? null,
  );
  const [customerLabel, setCustomerLabel] = React.useState<string | null>(
    prefillCustomer?.label ?? null,
  );

  const [paymentMethod, setPaymentMethod] =
    React.useState<CrmPosPaymentMethod>('cash');
  const [splitCash, setSplitCash] = React.useState<string>('0');
  const [splitCard, setSplitCard] = React.useState<string>('0');
  const [splitUpi, setSplitUpi] = React.useState<string>('0');
  const [holdReason, setHoldReason] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);
  const [receipt, setReceipt] = React.useState<{
    transactionNumber: string;
    total: number;
    method: CrmPosPaymentMethod;
    lines: { name: string; qty: number; total: number }[];
  } | null>(null);

  // NB: the legacy terminal-registry + 30s heartbeat effect is dropped
  // (spec §5.2) — there is no project-scoped terminal registry in v1.

  const onSearch = async (raw: string): Promise<void> => {
    setQuery(raw);
    setSearching(true);
    try {
      const res = await searchSabcrmRegisterItems(raw, 50);
      setItems(
        res.ok
          ? res.data.map((it) => ({
              id: it.id,
              name: it.name,
              sku: it.sku ?? null,
              sellingPrice: it.sellingPrice,
              taxRate: it.taxRate ?? 0,
            }))
          : [],
      );
    } finally {
      setSearching(false);
    }
  };

  const addItemFromCatalogue = (item: RegisterItem): void => {
    setCart((prev) => {
      const found = prev.find((l) => l.itemId === item.id);
      if (found) {
        return prev.map((l) =>
          l.itemId === item.id
            ? { ...l, qty: l.qty + 1, total: (l.qty + 1) * l.rate }
            : l,
        );
      }
      return [
        ...prev,
        {
          key: makeCartKey(),
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          qty: 1,
          rate: item.sellingPrice,
          taxRate: item.taxRate,
          total: item.sellingPrice,
        },
      ];
    });
  };

  const updateQty = (key: string, delta: number): void => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.key === key
            ? {
                ...l,
                qty: Math.max(0, l.qty + delta),
                total: Math.max(0, l.qty + delta) * l.rate,
              }
            : l,
        )
        .filter((l) => l.qty > 0),
    );
  };

  const setRate = (key: string, rate: number): void => {
    const safeRate = Number.isFinite(rate) && rate >= 0 ? rate : 0;
    setCart((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, rate: safeRate, total: l.qty * safeRate } : l,
      ),
    );
  };

  const removeLine = (key: string): void => {
    setCart((prev) => prev.filter((l) => l.key !== key));
  };

  // Client preview math only — the server computes the persisted totals.
  const totals = React.useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    for (const l of cart) {
      const base = l.qty * l.rate;
      const tax = base * ((l.taxRate ?? 0) / 100);
      subtotal += base;
      taxTotal += tax;
    }
    const round2 = (n: number): number => Math.round(n * 100) / 100;
    return {
      subtotal: round2(subtotal),
      taxTotal: round2(taxTotal),
      total: round2(subtotal + taxTotal),
    };
  }, [cart]);

  const resetAfterSale = (): void => {
    setCart([]);
    setCustomerId(null);
    setCustomerLabel(null);
    setSplitCash('0');
    setSplitCard('0');
    setSplitUpi('0');
  };

  const buildSplits = (): CrmPosPaymentSplit[] | undefined | false => {
    if (paymentMethod !== 'split') return undefined;
    const cash = Number(splitCash) || 0;
    const card = Number(splitCard) || 0;
    const upi = Number(splitUpi) || 0;
    const sum = cash + card + upi;
    if (Math.abs(sum - totals.total) > 0.01) {
      toast.error(
        `Split totals (${fmtMoney(sum)}) don't match cart total (${fmtMoney(totals.total)}).`,
      );
      return false;
    }
    return (
      [
        { method: 'cash' as const, amount: cash },
        { method: 'card' as const, amount: card },
        { method: 'upi' as const, amount: upi },
      ].filter((s) => s.amount > 0)
    );
  };

  const onCheckout = async (): Promise<void> => {
    if (cart.length === 0) {
      toast.error('Add at least one item before checkout.');
      return;
    }
    const splits = buildSplits();
    if (splits === false) return;

    setSubmitting(true);
    try {
      // Map qty → quantity, drop sku; never send totals (spec §5.2).
      const lineItems = cart.map((l) => ({
        itemId: l.itemId,
        name: l.name,
        quantity: l.qty,
        rate: l.rate,
        taxRate: l.taxRate,
      }));

      const res = prefillHold
        ? await recallSabcrmPosHold({
            holdId: prefillHold.id,
            paymentMethod,
            paymentSplits: splits || undefined,
          })
        : await createSabcrmPosTransaction({
            sessionId: session.id,
            customerId: customerId ?? undefined,
            lineItems,
            paymentMethod,
            paymentSplits: splits || undefined,
          });

      if (res.ok) {
        const num = res.data.entity.transactionNumber;
        setReceipt({
          transactionNumber: num,
          total: totals.total,
          method: paymentMethod,
          lines: cart.map((l) => ({ name: l.name, qty: l.qty, total: l.total })),
        });
        resetAfterSale();
        toast.success(`Transaction ${num} recorded.`);
      } else {
        toast.error(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onHold = async (): Promise<void> => {
    if (cart.length === 0) {
      toast.error('Add at least one item before holding.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createSabcrmPosHold({
        sessionId: session.id,
        customerId: customerId ?? undefined,
        lineItems: cart.map((l) => ({
          itemId: l.itemId,
          name: l.name,
          quantity: l.qty,
          rate: l.rate,
          taxRate: l.taxRate,
        })),
        holdReason: holdReason || undefined,
      });
      if (res.ok) {
        toast.success('Ticket held.');
        setCart([]);
        setCustomerId(null);
        setCustomerLabel(null);
        setHoldReason('');
      } else {
        toast.error(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="m-0 text-xl font-semibold tracking-tight text-[var(--st-text)]">
          Register · {session.terminalId}
        </h1>
        {prefillHold ? (
          <span className="text-sm text-[var(--st-text-secondary)]">
            Recalling a held ticket
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {/* Left — item picker */}
        <Card className="md:col-span-3">
          <CardBody className="flex flex-col gap-3 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
              <Input
                value={query}
                onChange={(e) => void onSearch(e.target.value)}
                placeholder="Scan barcode or search by name / SKU…"
                className="h-10 pl-9 text-[13px]"
                autoFocus
              />
            </div>
            <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto md:grid-cols-3 lg:grid-cols-4">
              {searching && items.length === 0 ? (
                <p className="col-span-full p-6 text-center text-[12px] text-[var(--st-text-secondary)]">
                  Searching…
                </p>
              ) : items.length === 0 ? (
                <p className="col-span-full p-6 text-center text-[12px] text-[var(--st-text-secondary)]">
                  No items match this search.
                </p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItemFromCatalogue(item)}
                    className="flex flex-col items-start gap-1 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-left transition-colors hover:border-[var(--st-text)]/40 hover:bg-[var(--st-bg-muted)]"
                  >
                    <span className="line-clamp-2 text-[12.5px] font-medium text-[var(--st-text)]">
                      {item.name}
                    </span>
                    {item.sku ? (
                      <span className="font-mono text-[10.5px] text-[var(--st-text-secondary)]">
                        {item.sku}
                      </span>
                    ) : null}
                    <span className="mt-auto text-[12px] font-semibold text-[var(--st-accent)]">
                      {fmtMoney(item.sellingPrice)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </CardBody>
        </Card>

        {/* Right — cart panel */}
        <Card className="md:col-span-2">
          <CardBody className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--st-text)]">
                Cart {prefillHold ? '· recalled' : ''}
              </p>
              {cart.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={() => setCart([])}>
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
              ) : null}
            </div>

            <Field label="Customer">
              <EntityPicker
                value={customerId}
                valueLabel={customerLabel}
                onChange={(opt) => {
                  setCustomerId(opt?.id ?? null);
                  setCustomerLabel(opt?.label ?? null);
                }}
                search={async (q) => {
                  const res = await searchSabcrmFinanceParties(q);
                  return res.ok ? res.data : [];
                }}
                placeholder="Walk-in customer (optional)"
                aria-label="Customer"
              />
            </Field>

            <div className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="rounded-md border border-dashed border-[var(--st-border)] p-6 text-center text-[12px] text-[var(--st-text-secondary)]">
                  Cart is empty — pick an item to begin.
                </p>
              ) : (
                cart.map((line) => (
                  <div
                    key={line.key}
                    className="flex flex-col gap-1 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="line-clamp-1 text-[12.5px] font-medium text-[var(--st-text)]">
                        {line.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        aria-label="Remove line"
                        className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => updateQty(line.key, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-[12px] tabular-nums">
                          {line.qty}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => updateQty(line.key, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        type="number"
                        value={String(line.rate)}
                        onChange={(e) => setRate(line.key, Number(e.target.value))}
                        className="h-7 w-20 text-[12px]"
                        min={0}
                        step="0.01"
                      />
                      <span className="ml-auto text-[12.5px] font-semibold tabular-nums text-[var(--st-text)]">
                        {fmtMoney(line.total)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-1 border-t border-[var(--st-border)] pt-3 text-[12.5px]">
              <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                <span>Subtotal</span>
                <span className="tabular-nums">{fmtMoney(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                <span>Tax</span>
                <span className="tabular-nums">{fmtMoney(totals.taxTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold text-[var(--st-text)]">
                <span>Total</span>
                <span className="tabular-nums">{fmtMoney(totals.total)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Payment method
              </p>
              <div className="grid grid-cols-4 gap-1">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setPaymentMethod(m.value)}
                      className={
                        active
                          ? 'flex flex-col items-center gap-1 rounded-md border border-[var(--st-accent)] bg-[var(--st-accent)]/10 p-2 text-[11.5px] font-medium text-[var(--st-accent)]'
                          : 'flex flex-col items-center gap-1 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2 text-[11.5px] text-[var(--st-text)] hover:border-[var(--st-text)]/30'
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {paymentMethod === 'split' ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="splitCash" className="text-[11px]">
                      Cash
                    </Label>
                    <Input
                      id="splitCash"
                      type="number"
                      value={splitCash}
                      onChange={(e) => setSplitCash(e.target.value)}
                      className="h-8 text-[12px]"
                      min={0}
                      step="0.01"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="splitCard" className="text-[11px]">
                      Card
                    </Label>
                    <Input
                      id="splitCard"
                      type="number"
                      value={splitCard}
                      onChange={(e) => setSplitCard(e.target.value)}
                      className="h-8 text-[12px]"
                      min={0}
                      step="0.01"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="splitUpi" className="text-[11px]">
                      UPI
                    </Label>
                    <Input
                      id="splitUpi"
                      type="number"
                      value={splitUpi}
                      onChange={(e) => setSplitUpi(e.target.value)}
                      className="h-8 text-[12px]"
                      min={0}
                      step="0.01"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="holdReason" className="text-[11px]">
                Hold reason (optional)
              </Label>
              <Textarea
                id="holdReason"
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                rows={2}
                placeholder="e.g. Customer stepped away to grab another item"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={submitting || cart.length === 0 || Boolean(prefillHold)}
                onClick={onHold}
              >
                <PauseCircle className="h-4 w-4" /> Hold ticket
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={submitting || cart.length === 0}
                onClick={onCheckout}
              >
                {submitting
                  ? 'Processing…'
                  : `Checkout · ${fmtMoney(totals.total)}`}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Dialog
        open={receipt !== null}
        onOpenChange={(open) => {
          if (!open) setReceipt(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receipt · {receipt?.transactionNumber}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 font-mono text-[12px]">
            {receipt?.lines.map((l, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <span>
                  {l.name} × {l.qty}
                </span>
                <span className="tabular-nums">{fmtMoney(l.total)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-2 font-bold">
              <span>Total</span>
              <span className="tabular-nums">{fmtMoney(receipt?.total ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
              <span>Paid via</span>
              <span className="capitalize">{receipt?.method}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceipt(null)}>
              Close
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
