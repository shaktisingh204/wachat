'use client';

import { Button, Card, CardBody, Input, Label, Textarea, toast, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/sabcrm/20ui';
import {
  Banknote,
  CreditCard,
  Plus,
  Minus,
  PauseCircle,
  Printer,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  UserPlus,
  X,
  } from 'lucide-react';

/**
 * POS terminal — client island.
 *
 * Two-pane layout. Left 60% is the item-picker grid + barcode-style
 * search input that hits `searchPosItems`. Right 40% is the cart
 * panel with line items, totals, customer picker and payment-method
 * tabs (Cash / Card / UPI / Split).
 *
 * `Checkout` calls `createPosTransaction` and surfaces a print-ready
 * receipt modal on success. `Hold ticket` calls `createPosHold`.
 *
 * Optional `prefillHold` re-loads a held ticket into the cart and
 * marks the recall path on submit (recall flow uses the standard
 * `createPosTransaction` call — the recall endpoint is reserved for
 * the Rust BFF swap).
 */

import * as React from 'react';

import {
    createPosTransaction,
    createPosHold,
    recallPosHold,
    searchPosItems,
    registerPosTerminal,
    heartbeatPosTerminal,
    type PosSessionDoc,
    type PosHoldDoc,
    type PosItemRow,
    type PosLineItem,
    type PosPaymentMethod,
    type PosPaymentSplit,
} from '@/app/actions/crm-pos.actions';

interface Props {
    session: PosSessionDoc;
    initialItems: PosItemRow[];
    prefillHold: PosHoldDoc | null;
}

interface CartLine extends PosLineItem {
    key: string;
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
    value: PosPaymentMethod;
    label: string;
    icon: React.ElementType;
}> = [
    { value: 'cash', label: 'Cash', icon: Banknote },
    { value: 'card', label: 'Card', icon: CreditCard },
    { value: 'upi', label: 'UPI', icon: Smartphone },
    { value: 'split', label: 'Split', icon: ShoppingCart },
];

export function PosTerminalClient({
    session,
    initialItems,
    prefillHold,
}: Props) {
    const [items, setItems] = React.useState<PosItemRow[]>(initialItems);
    const [query, setQuery] = React.useState('');
    const [searching, setSearching] = React.useState(false);

    const [cart, setCart] = React.useState<CartLine[]>(() => {
        if (!prefillHold) return [];
        return (prefillHold.lineItems ?? []).map((li) => ({
            ...li,
            key: makeCartKey(),
        }));
    });
    const [customerName, setCustomerName] = React.useState<string>(
        prefillHold?.customerName ?? '',
    );
    const [paymentMethod, setPaymentMethod] =
        React.useState<PosPaymentMethod>('cash');
    const [splitCash, setSplitCash] = React.useState<string>('0');
    const [splitCard, setSplitCard] = React.useState<string>('0');
    const [splitUpi, setSplitUpi] = React.useState<string>('0');
    const [holdReason, setHoldReason] = React.useState<string>('');
    const [submitting, setSubmitting] = React.useState(false);
    const [receipt, setReceipt] = React.useState<{
        transactionNumber: string;
        total: number;
        method: PosPaymentMethod;
        lines: PosLineItem[];
    } | null>(null);

    // Terminal Registry & Heartbeat
    React.useEffect(() => {
        let interval: NodeJS.Timeout;
        const initTerminal = async () => {
            await registerPosTerminal(session.terminalId, session._id);
            interval = setInterval(() => {
                heartbeatPosTerminal(session.terminalId);
            }, 30000); // 30 second heartbeat
        };
        initTerminal();
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [session.terminalId, session._id]);

    const onSearch = async (raw: string) => {
        setQuery(raw);
        setSearching(true);
        try {
            const found = await searchPosItems(raw, 50);
            setItems(found);
        } finally {
            setSearching(false);
        }
    };

    const addItemFromCatalogue = (item: PosItemRow) => {
        setCart((prev) => {
            const found = prev.find((l) => l.itemId === item._id);
            if (found) {
                return prev.map((l) =>
                    l.itemId === item._id
                        ? {
                              ...l,
                              qty: l.qty + 1,
                              total: (l.qty + 1) * l.rate,
                          }
                        : l,
                );
            }
            return [
                ...prev,
                {
                    key: makeCartKey(),
                    itemId: item._id,
                    sku: item.sku ?? null,
                    name: item.name,
                    qty: 1,
                    rate: item.sellingPrice,
                    taxRate: item.taxRate ?? 0,
                    total: item.sellingPrice,
                },
            ];
        });
    };

    const updateQty = (key: string, delta: number) => {
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

    const setRate = (key: string, rate: number) => {
        const safeRate = Number.isFinite(rate) && rate >= 0 ? rate : 0;
        setCart((prev) =>
            prev.map((l) =>
                l.key === key
                    ? { ...l, rate: safeRate, total: l.qty * safeRate }
                    : l,
            ),
        );
    };

    const removeLine = (key: string) => {
        setCart((prev) => prev.filter((l) => l.key !== key));
    };

    const totals = React.useMemo(() => {
        let subtotal = 0;
        let taxTotal = 0;
        for (const l of cart) {
            const base = l.qty * l.rate;
            const tax = base * ((l.taxRate ?? 0) / 100);
            subtotal += base;
            taxTotal += tax;
        }
        const round2 = (n: number) => Math.round(n * 100) / 100;
        return {
            subtotal: round2(subtotal),
            taxTotal: round2(taxTotal),
            total: round2(subtotal + taxTotal),
        };
    }, [cart]);

    const onCheckout = async () => {
        if (cart.length === 0) {
            toast.error('Add at least one item before checkout.');
            return;
        }
        let paymentSplits: PosPaymentSplit[] | null = null;
        if (paymentMethod === 'split') {
            const cash = Number(splitCash) || 0;
            const card = Number(splitCard) || 0;
            const upi = Number(splitUpi) || 0;
            const sum = cash + card + upi;
            if (Math.abs(sum - totals.total) > 0.01) {
                toast.error(
                    `Split totals (${fmtMoney(sum)}) don't match cart total (${fmtMoney(totals.total)}).`,
                );
                return;
            }
            paymentSplits = [
                { method: 'cash', amount: cash },
                { method: 'card', amount: card },
                { method: 'upi', amount: upi },
            ].filter((s) => s.amount > 0) as PosPaymentSplit[];
        }
        setSubmitting(true);
        try {
            let res: {
                success: boolean;
                error?: string;
                transactionNumber?: string;
                id?: string;
                transactionId?: string;
            };
            if (prefillHold) {
                res = await recallPosHold({
                    holdId: prefillHold._id,
                    paymentMethod,
                    paymentSplits,
                });
            } else {
                res = await createPosTransaction({
                    sessionId: session._id,
                    customerName: customerName || null,
                    lineItems: cart,
                    paymentMethod,
                    paymentSplits,
                });
            }
            if (res.success && res.transactionNumber) {
                setReceipt({
                    transactionNumber: res.transactionNumber,
                    total: totals.total,
                    method: paymentMethod,
                    lines: cart.map(({ key: _key, ...rest }) => rest),
                });
                setCart([]);
                setCustomerName('');
                setSplitCash('0');
                setSplitCard('0');
                setSplitUpi('0');
                toast.success(
                    `Transaction ${res.transactionNumber} recorded.`,
                );
            } else {
                toast.error(res.error ?? 'Checkout failed.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const onHold = async () => {
        if (cart.length === 0) {
            toast.error('Add at least one item before holding.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await createPosHold({
                sessionId: session._id,
                customerName: customerName || null,
                lineItems: cart,
                holdReason: holdReason || undefined,
            });
            if (res.success) {
                toast.success('Ticket held.');
                setCart([]);
                setCustomerName('');
                setHoldReason('');
            } else {
                toast.error(res.error ?? 'Could not hold ticket.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {/* Left 60% — item picker */}
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
                                    key={item._id}
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

            {/* Right 40% — cart panel */}
            <Card className="md:col-span-2">
                <CardBody className="flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[var(--st-text)]">
                            Cart {prefillHold ? '· recalled' : ''}
                        </p>
                        {cart.length > 0 ? (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCart([])}
                            >
                                <X className="h-3.5 w-3.5" /> Clear
                            </Button>
                        ) : null}
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label htmlFor="customerName" className="text-[11px]">
                            Customer
                        </Label>
                        <div className="relative">
                            <UserPlus className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--st-text-secondary)]" />
                            <Input
                                id="customerName"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Walk-in customer (optional)"
                                className="h-9 pl-8 text-[13px]"
                            />
                        </div>
                    </div>

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
                                                onClick={() =>
                                                    updateQty(line.key, -1)
                                                }
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
                                                onClick={() =>
                                                    updateQty(line.key, 1)
                                                }
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <Input
                                            type="number"
                                            value={String(line.rate)}
                                            onChange={(e) =>
                                                setRate(
                                                    line.key,
                                                    Number(e.target.value),
                                                )
                                            }
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
                            <span className="tabular-nums">
                                {fmtMoney(totals.subtotal)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                            <span>Tax</span>
                            <span className="tabular-nums">
                                {fmtMoney(totals.taxTotal)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-semibold text-[var(--st-text)]">
                            <span>Total</span>
                            <span className="tabular-nums">
                                {fmtMoney(totals.total)}
                            </span>
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
                                    <Label
                                        htmlFor="splitCash"
                                        className="text-[11px]"
                                    >
                                        Cash
                                    </Label>
                                    <Input
                                        id="splitCash"
                                        type="number"
                                        value={splitCash}
                                        onChange={(e) =>
                                            setSplitCash(e.target.value)
                                        }
                                        className="h-8 text-[12px]"
                                        min={0}
                                        step="0.01"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label
                                        htmlFor="splitCard"
                                        className="text-[11px]"
                                    >
                                        Card
                                    </Label>
                                    <Input
                                        id="splitCard"
                                        type="number"
                                        value={splitCard}
                                        onChange={(e) =>
                                            setSplitCard(e.target.value)
                                        }
                                        className="h-8 text-[12px]"
                                        min={0}
                                        step="0.01"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label
                                        htmlFor="splitUpi"
                                        className="text-[11px]"
                                    >
                                        UPI
                                    </Label>
                                    <Input
                                        id="splitUpi"
                                        type="number"
                                        value={splitUpi}
                                        onChange={(e) =>
                                            setSplitUpi(e.target.value)
                                        }
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
                            disabled={submitting || cart.length === 0}
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

            <Dialog
                open={receipt !== null}
                onOpenChange={(open) => {
                    if (!open) setReceipt(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Receipt · {receipt?.transactionNumber}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 font-mono text-[12px]">
                        {receipt?.lines.map((l, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between gap-3"
                            >
                                <span>
                                    {l.name} × {l.qty}
                                </span>
                                <span className="tabular-nums">
                                    {fmtMoney(l.total)}
                                </span>
                            </div>
                        ))}
                        <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-2 font-bold">
                            <span>Total</span>
                            <span className="tabular-nums">
                                {fmtMoney(receipt?.total ?? 0)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                            <span>Paid via</span>
                            <span className="capitalize">{receipt?.method}</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setReceipt(null)}
                        >
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
