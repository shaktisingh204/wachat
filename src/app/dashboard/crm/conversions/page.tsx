import { Badge, Card } from '@/components/sabcrm/20ui/compat';
import { ArrowRight, ShoppingCart, Truck, GitMerge, ShoppingBag, Package } from 'lucide-react';

/**
 * CRM Conversions — `/dashboard/crm/conversions`.
 *
 * ## Why this is an info page, not a CRUD surface
 *
 * The Rust crate `crm-conversions` is a **pure-function transformation
 * library** (see `rust/crates/crm-conversions/src/lib.rs`). It exposes
 * no router, no DTOs, no handlers — only deterministic helpers like
 * `quotation_to_invoice(q, invoice_no)` that build a child document
 * from a parent. The actual conversion happens inside the
 * **child-entity create handlers** when they receive `fromKind` +
 * `fromId`. No conversion-record entity exists to list, create, edit,
 * or delete.
 *
 * Rather than fabricate a CRUD surface that has no backend, this page
 * documents the conversion map and links operators to the exact UI
 * flows that perform each conversion.
 *
 * Server component — no client interactivity needed.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listSupportedConversions } from '@/app/actions/crm/conversions.actions';
import type { CrmConversionEdge } from '@/lib/rust-client/crm-conversions';
import { HubKpiGrid, type HubKpi } from '../_components/hub-kpi-grid';
import { AnalyticsDashboard } from './_components/analytics-dashboard';

export const dynamic = 'force-dynamic';

const SECTION_META: Record<
    'sales' | 'purchases',
    {
        title: string;
        subtitle: string;
        icon: React.ElementType;
        fromKinds: ReadonlySet<string>;
    }
> = {
    sales: {
        title: 'Sales conversions',
        subtitle:
            'Quote → Order → Invoice → Credit Note. The full sales-side lineage chain.',
        icon: ShoppingCart,
        fromKinds: new Set(['quotation', 'salesOrder', 'invoice']),
    },
    purchases: {
        title: 'Purchases conversions',
        subtitle:
            'PO → GRN → Bill → Debit Note. The procurement-side lineage chain.',
        icon: Truck,
        fromKinds: new Set(['purchaseOrder', 'grn', 'bill']),
    },
};

function ConversionRow({ edge }: { edge: CrmConversionEdge }) {
    return (
        <Link
            href={edge.createHref}
            className="group flex flex-col gap-3 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 transition hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-muted)] sm:flex-row sm:items-center"
        >
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[11px]">
                        {edge.fromKind}
                    </Badge>
                    <ArrowRight
                        className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                        strokeWidth={1.75}
                    />
                    <Badge variant="outline" className="font-mono text-[11px]">
                        {edge.toKind}
                    </Badge>
                </div>
                <p className="mt-2 text-[14px] font-medium text-[var(--st-text)]">{edge.label}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--st-text-secondary)]">
                    {edge.description}
                </p>
            </div>
            <div className="shrink-0 text-[12px] text-[var(--st-text-secondary)] transition group-hover:text-[var(--st-text)]">
                Open form
                <ArrowRight
                    className="ml-1 inline-block h-3.5 w-3.5 transition group-hover:translate-x-0.5"
                    strokeWidth={1.75}
                />
            </div>
        </Link>
    );
}

function ConversionSection({
    meta,
    edges,
}: {
    meta: (typeof SECTION_META)[keyof typeof SECTION_META];
    edges: readonly CrmConversionEdge[];
}) {
    const Icon = meta.icon;
    return (
        <Card variant="default" className="p-0">
            <div className="flex items-start gap-3 border-b border-[var(--st-border)] px-5 py-4">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-[var(--st-bg-muted)]">
                    <Icon className="h-4 w-4 text-[var(--st-text)]" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                    <h2 className="text-[16px] font-medium text-[var(--st-text)]">{meta.title}</h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">{meta.subtitle}</p>
                </div>
            </div>
            <div className="flex flex-col gap-2 p-5">
                {edges.length === 0 ? (
                    <p className="text-[13px] text-[var(--st-text-secondary)]">
                        No conversions in this group.
                    </p>
                ) : (
                    edges.map((edge) => <ConversionRow key={edge.kind} edge={edge} />)
                )}
            </div>
        </Card>
    );
}

export default async function ConversionsPage() {
    const catalog = await listSupportedConversions();

    const salesEdges = catalog.filter((e) => SECTION_META.sales.fromKinds.has(e.fromKind));
    const purchasesEdges = catalog.filter((e) =>
        SECTION_META.purchases.fromKinds.has(e.fromKind),
    );

    const kpis: HubKpi[] = [
        {
            label: 'Total conversion paths',
            value: catalog.length,
            icon: GitMerge,
        },
        {
            label: 'Sales paths',
            value: salesEdges.length,
            icon: ShoppingBag,
        },
        {
            label: 'Purchase paths',
            value: purchasesEdges.length,
            icon: Package,
        },
        {
            label: 'Source entity kinds',
            value: new Set(catalog.map((e) => e.fromKind)).size,
            icon: ArrowRight,
        },
    ];

    return (
        <EntityListShell
            title="Conversions"
            subtitle="Catalog of supported parent → child transformations across the CRM. Conversion runs inline when you create a child entity from one of these parents."
        >
            <HubKpiGrid kpis={kpis} />

            <Card variant="soft" className="space-y-2">
                <h2 className="text-[14px] font-medium text-[var(--st-text)]">
                    How conversion works here
                </h2>
                <p className="text-[12.5px] leading-relaxed text-[var(--st-text-secondary)]">
                    There is no separate &quot;convert&quot; action or record. The Rust
                    BFF&apos;s{' '}
                    <code className="rounded bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[11.5px]">
                        crm-conversions
                    </code>{' '}
                    crate exposes pure transformations (quotation → invoice, PO → GRN, …)
                    that the child-entity create handlers call when they receive{' '}
                    <code className="rounded bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[11.5px]">
                        fromKind
                    </code>{' '}
                    +{' '}
                    <code className="rounded bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[11.5px]">
                        fromId
                    </code>
                    . Lineage extends forward and the parent gets a back-link in its{' '}
                    <code className="rounded bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[11.5px]">
                        linked*Ids
                    </code>{' '}
                    array.
                </p>
                <p className="text-[12.5px] leading-relaxed text-[var(--st-text-secondary)]">
                    To run a conversion, open the parent entity (e.g. a quotation), pick a
                    target from its detail page, or click an edge below to jump to the child
                    create form. Programmatic callers can use the typed helpers in{' '}
                    <code className="rounded bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[11.5px]">
                        src/app/actions/crm/conversions.actions.ts
                    </code>{' '}
                    (e.g.{' '}
                    <code className="rounded bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[11.5px]">
                        convertQuotationToInvoice()
                    </code>
                    ).
                </p>
            </Card>

            <AnalyticsDashboard />

            <ConversionSection meta={SECTION_META.sales} edges={salesEdges} />
            <ConversionSection meta={SECTION_META.purchases} edges={purchasesEdges} />
        </EntityListShell>
    );
}
