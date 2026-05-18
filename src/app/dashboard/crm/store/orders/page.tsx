import { ZoruBadge, ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import {
  ShoppingBag } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';

/**
 * Store orders list — `/dashboard/crm/store/orders`.
 *
 * Orders are created from the public storefront; this admin surface is
 * read-only at the list level (per CRM_REBUILD_PLAN §6.3 bonus).
 */

import Link from 'next/link';

import {
    getStorefrontList,
    getStoreOrders,
} from '@/app/actions/crm-store.actions';
import { StorefrontFilterClient } from '../products/_components/storefront-filter';

export const dynamic = 'force-dynamic';

function statusVariant(
    status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
    const s = (status || '').toLowerCase();
    if (s === 'paid' || s === 'fulfilled') return 'success';
    if (s === 'pending' || s === 'awaiting_fulfillment') return 'warning';
    if (s === 'cancelled' || s === 'refunded') return 'danger';
    return 'ghost';
}

function fmtMoney(n: unknown, currency = 'INR'): string {
    const num = typeof n === 'number' ? n : parseFloat(String(n ?? ''));
    if (Number.isNaN(num)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
        }).format(num);
    } catch {
        return `${currency} ${num}`;
    }
}

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string | number | Date);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

interface PageProps {
    searchParams: Promise<{ storefrontId?: string }>;
}

export default async function StoreOrdersPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const storefrontId = sp.storefrontId ?? '';

    const [{ items }, { items: storefronts }] = await Promise.all([
        getStoreOrders(storefrontId || undefined),
        getStorefrontList(),
    ]);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Store orders"
                subtitle="Orders captured from the storefront — payment and fulfillment state."
                icon={ShoppingBag}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    { label: 'Orders' },
                ]}
            />

            <ZoruCard className="p-4">
                <StorefrontFilterClient
                    storefronts={storefronts.map((sf) => ({
                        id: String((sf as Record<string, unknown>)._id ?? ''),
                        name:
                            ((sf as Record<string, unknown>).name as string) ??
                            'Untitled',
                    }))}
                    selectedId={storefrontId}
                />
            </ZoruCard>

            <ZoruCard className="p-6">
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Order #</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Customer</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Total</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Placed</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {items.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={5}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        No orders yet.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                items.map((o) => {
                                    const id = String(
                                        (o as Record<string, unknown>)._id ?? '',
                                    );
                                    const status =
                                        ((o as Record<string, unknown>).status as
                                            | string
                                            | undefined) ?? 'pending';
                                    const orderNo =
                                        ((o as Record<string, unknown>)
                                            .orderNo as string) ??
                                        `#${id.slice(-6)}`;
                                    return (
                                        <ZoruTableRow
                                            key={id}
                                            className="border-zoru-line"
                                        >
                                            <ZoruTableCell className="text-zoru-ink">
                                                <Link
                                                    href={`/dashboard/crm/store/orders/${id}`}
                                                    className="hover:underline"
                                                >
                                                    {orderNo}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {(o.customerEmail as string) ||
                                                    (o.customerName as string) ||
                                                    '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtMoney(
                                                    (o.totals as Record<
                                                        string,
                                                        unknown
                                                    > | null)?.total ?? o.total,
                                                    (o.currency as string) ||
                                                        'INR',
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtDate(
                                                    (o as Record<string, unknown>)
                                                        .createdAt,
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge
                                                    variant={statusVariant(status)}
                                                >
                                                    {status}
                                                </ZoruBadge>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
