'use client';

import { Badge } from '@/components/zoruui';
import {
  Sparkles,
  Handshake,
  FileText,
  ShoppingCart,
  Truck,
  Receipt,
  FileCheck,
  FileMinus,
  MessageSquareQuote,
  Gavel,
  ShoppingBag,
  PackageCheck,
  ArrowUpRight,
  type LucideIcon,
  } from 'lucide-react';

import type { LineageKind,
  LineageRef } from '@/lib/definitions';

/**
 * <LineageRail> — vertical "Linked Documents" rail rendered on CRM
 * doc detail pages. See crm_function_plan.md §13.5.
 *
 * The rail shows the canonical chain (sales or purchase) with one row
 * per document kind. For each step:
 *   - Filled row when the lineage contains a matching ref → click-
 *     through link, optional status badge.
 *   - Highlighted row for the current doc (left accent border).
 *   - Muted "Not yet" placeholder when no doc of that kind is linked.
 *
 * The component is purely presentational: it takes a `current` doc
 * descriptor + a flat `lineage` array (from the doc's persisted
 * `lineage` field) and figures out the rest. It picks the chain to
 * render automatically from `current.kind`.
 */

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

/** Canonical sales-side document chain. */
export const SALES_CHAIN: LineageKind[] = [
    'lead',
    'deal',
    'quotation',
    'salesOrder',
    'deliveryChallan',
    'invoice',
    'paymentReceipt',
];

/** Canonical purchase-side document chain. */
export const PURCHASE_CHAIN: LineageKind[] = [
    'rfq',
    'vendorBid',
    'purchaseOrder',
    'grn',
    'bill',
    'payout',
];

/** Maps a kind to the deep-link route for its detail page. */
export const kindToHref: Record<LineageKind, (id: string) => string> = {
    lead: (id) => `/dashboard/crm/sales-crm/leads/${id}`,
    deal: (id) => `/dashboard/crm/sales-crm/deals/${id}`,
    quotation: (id) => `/dashboard/crm/sales/quotations/${id}`,
    proforma: (id) => `/dashboard/crm/sales/proforma/${id}`,
    salesOrder: (id) => `/dashboard/crm/sales/orders/${id}`,
    deliveryChallan: (id) => `/dashboard/crm/sales/delivery/${id}`,
    invoice: (id) => `/dashboard/crm/sales/invoices/${id}`,
    paymentReceipt: (id) => `/dashboard/crm/sales/receipts/${id}`,
    creditNote: (id) => `/dashboard/crm/sales/credit-notes/${id}`,
    rfq: (id) => `/dashboard/crm/purchases/rfqs/${id}`,
    vendorBid: (id) => `/dashboard/crm/purchases/rfqs/${id}/bids`,
    purchaseOrder: (id) => `/dashboard/crm/purchases/orders/${id}`,
    grn: (id) => `/dashboard/crm/inventory/grn/${id}`,
    bill: (id) => `/dashboard/crm/purchases/expenses/${id}`,
    payout: (id) => `/dashboard/crm/purchases/payouts/${id}`,
    debitNote: (id) => `/dashboard/crm/purchases/debit-notes/${id}`,
};

const KIND_ICON: Record<LineageKind, LucideIcon> = {
    lead: Sparkles,
    deal: Handshake,
    quotation: FileText,
    proforma: FileText,
    salesOrder: ShoppingCart,
    deliveryChallan: Truck,
    invoice: Receipt,
    paymentReceipt: FileCheck,
    creditNote: FileMinus,
    rfq: MessageSquareQuote,
    vendorBid: Gavel,
    purchaseOrder: ShoppingBag,
    grn: PackageCheck,
    bill: FileText,
    payout: ArrowUpRight,
    debitNote: FileMinus,
};

const KIND_LABEL: Record<LineageKind, string> = {
    lead: 'Lead',
    deal: 'Deal',
    quotation: 'Quotation',
    proforma: 'Proforma',
    salesOrder: 'Sales Order',
    deliveryChallan: 'Delivery Challan',
    invoice: 'Invoice',
    paymentReceipt: 'Payment Receipt',
    creditNote: 'Credit Note',
    rfq: 'RFQ',
    vendorBid: 'Vendor Bid',
    purchaseOrder: 'Purchase Order',
    grn: 'GRN',
    bill: 'Bill',
    payout: 'Payout',
    debitNote: 'Debit Note',
};

const PURCHASE_KINDS = new Set<LineageKind>(PURCHASE_CHAIN);

interface LineageRailProps {
    /** Current document — its kind/id will be highlighted in the chain. */
    current: { kind: LineageKind; id: string; no?: string; status?: string };
    /** All linked docs. Pass directly from the doc's `lineage` field. */
    lineage: LineageRef[];
    /** Optional: hide the title. */
    hideTitle?: boolean;
    className?: string;
}

export function LineageRail({
    current,
    lineage,
    hideTitle = false,
    className,
}: LineageRailProps) {
    const chain = PURCHASE_KINDS.has(current.kind) ? PURCHASE_CHAIN : SALES_CHAIN;

    // Build a kind→ref map. The current doc gets a synthetic ref so it
    // always renders as "filled + highlighted" even if absent from the
    // lineage array (a doc shouldn't reference itself).
    const byKind = new Map<LineageKind, LineageRef>();
    for (const ref of lineage) {
        if (!byKind.has(ref.kind)) byKind.set(ref.kind, ref);
    }
    byKind.set(current.kind, {
        kind: current.kind,
        id: current.id,
        no: current.no,
        status: current.status,
    });

    return (
        <aside
            className={cn(
                'rounded-lg border border-zoru-line bg-zoru-surface-2 p-4',
                className,
            )}
        >
            {!hideTitle && (
                <div className="mb-3">
                    <h3 className="text-[13px] font-medium text-zoru-ink">
                        Linked Documents
                    </h3>
                    <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                        Document chain for this {KIND_LABEL[current.kind].toLowerCase()}.
                    </p>
                </div>
            )}
            <ol className="relative flex flex-col gap-0">
                {chain.map((kind, index) => {
                    const ref = byKind.get(kind);
                    const isCurrent = kind === current.kind;
                    const isFilled = !!ref;
                    const isLast = index === chain.length - 1;
                    return (
                        <LineageRow
                            key={kind}
                            kind={kind}
                            ref_={ref}
                            isCurrent={isCurrent}
                            isFilled={isFilled}
                            isLast={isLast}
                        />
                    );
                })}
            </ol>
        </aside>
    );
}

interface LineageRowProps {
    kind: LineageKind;
    ref_: LineageRef | undefined;
    isCurrent: boolean;
    isFilled: boolean;
    isLast: boolean;
}

function LineageRow({ kind, ref_, isCurrent, isFilled, isLast }: LineageRowProps) {
    const Icon = KIND_ICON[kind];
    const label = KIND_LABEL[kind];

    const dotClass = cn(
        'relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
        isCurrent
            ? 'border-zoru-primary bg-zoru-primary/15 text-zoru-primary'
            : isFilled
                ? 'border-zoru-line-strong bg-zoru-surface text-zoru-ink'
                : 'border-zoru-line bg-zoru-surface-2 text-zoru-ink-muted/60',
    );

    const labelClass = cn(
        'text-[12.5px] font-medium',
        isCurrent
            ? 'text-zoru-ink'
            : isFilled
                ? 'text-zoru-ink'
                : 'text-zoru-ink-muted',
    );

    const rowClass = cn(
        'relative flex items-start gap-3 rounded-md px-2 py-2 transition-colors',
        isCurrent && 'border-l-2 border-zoru-primary bg-zoru-surface',
    );

    const body = (
        <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
                <span className={labelClass}>{label}</span>
                {ref_?.status && (
                    <ZoruBadge variant={isCurrent ? 'secondary' : 'ghost'}>
                        {ref_.status}
                    </ZoruBadge>
                )}
            </div>
            {isFilled && ref_ ? (
                <div className="mt-0.5 truncate text-[11.5px] text-zoru-ink-muted">
                    {ref_.no || ref_.id.slice(-6)}
                    {isCurrent && <span className="ml-1.5 text-zoru-primary">(current)</span>}
                </div>
            ) : (
                <div className="mt-0.5 text-[11.5px] italic text-zoru-ink-muted/70">
                    Not yet
                </div>
            )}
        </div>
    );

    return (
        <li className={rowClass}>
            {/* connector line, hidden on the last row */}
            {!isLast && (
                <span
                    aria-hidden
                    className="absolute left-[19px] top-7 z-0 h-[calc(100%-12px)] w-px bg-zoru-line"
                />
            )}
            <span className={dotClass} aria-hidden>
                <Icon className="h-3 w-3" strokeWidth={1.75} />
            </span>
            {isFilled && ref_ && !isCurrent ? (
                <Link
                    href={kindToHref[kind](ref_.id)}
                    className="min-w-0 flex-1 rounded-sm hover:opacity-80"
                >
                    {body}
                </Link>
            ) : (
                body
            )}
        </li>
    );
}
