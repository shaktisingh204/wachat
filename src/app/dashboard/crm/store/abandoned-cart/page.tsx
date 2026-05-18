import {
  ZoruBadge,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  AlertTriangle } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';

/**
 * Abandoned carts list — `/dashboard/crm/store/abandoned-cart`.
 *
 * KPI strip + filter + per-row "Send recovery email" (stub).
 */

import {
    getAbandonedCarts,
    getStorefrontList,
} from '@/app/actions/crm-store.actions';
import { StorefrontFilterClient } from '../products/_components/storefront-filter';
import { RecoveryButton } from './_components/recovery-button';

export const dynamic = 'force-dynamic';

function statusVariant(
    status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
    const s = (status || '').toLowerCase();
    if (s === 'recovered') return 'success';
    if (s === 'email_queued') return 'warning';
    if (s === 'lost') return 'danger';
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
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

interface PageProps {
    searchParams: Promise<{
        storefrontId?: string;
        from?: string;
        to?: string;
    }>;
}

export default async function AbandonedCartsPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const storefrontId = sp.storefrontId ?? '';
    const fromDate = sp.from ?? '';
    const toDate = sp.to ?? '';

    const [{ items, kpi }, { items: storefronts }] = await Promise.all([
        getAbandonedCarts({
            storefrontId: storefrontId || undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
        }),
        getStorefrontList(),
    ]);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Abandoned carts"
                subtitle="Drop-off carts with recovery email dispatch."
                icon={AlertTriangle}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    { label: 'Abandoned cart' },
                ]}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <ZoruStatCard label="Total" value={kpi.total} />
                <ZoruStatCard label="Recovered" value={kpi.recovered} />
                <ZoruStatCard
                    label="Recovery rate"
                    value={`${kpi.recoveryRate.toFixed(1)}%`}
                />
                <ZoruStatCard
                    label="Last 7 days revenue lost"
                    value={fmtMoney(kpi.lostLast7Days)}
                />
            </div>

            <ZoruCard className="p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <StorefrontFilterClient
                        storefronts={storefronts.map((sf) => ({
                            id: String(
                                (sf as Record<string, unknown>)._id ?? '',
                            ),
                            name:
                                ((sf as Record<string, unknown>)
                                    .name as string) ?? 'Untitled',
                        }))}
                        selectedId={storefrontId}
                    />
                    <form className="flex flex-wrap items-end gap-3" method="get">
                        {storefrontId ? (
                            <input
                                type="hidden"
                                name="storefrontId"
                                value={storefrontId}
                            />
                        ) : null}
                        <div className="flex flex-col gap-1.5">
                            <ZoruLabel htmlFor="from">From</ZoruLabel>
                            <ZoruInput
                                id="from"
                                name="from"
                                type="date"
                                defaultValue={fromDate}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <ZoruLabel htmlFor="to">To</ZoruLabel>
                            <ZoruInput
                                id="to"
                                name="to"
                                type="date"
                                defaultValue={toDate}
                            />
                        </div>
                        <button
                            type="submit"
                            className="h-9 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 text-[13px] text-zoru-ink hover:bg-zoru-surface-2"
                        >
                            Apply
                        </button>
                    </form>
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Customer email</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Items</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Subtotal</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Last interaction</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">
                                    Action
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {items.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={6}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        No abandoned carts yet.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                items.map((c) => {
                                    const id = String(
                                        (c as Record<string, unknown>)._id ?? '',
                                    );
                                    const itemsArr = Array.isArray(c.items)
                                        ? (c.items as unknown[])
                                        : [];
                                    const status =
                                        ((c as Record<string, unknown>)
                                            .recoveryStatus as
                                            | string
                                            | undefined) ?? 'open';
                                    return (
                                        <ZoruTableRow
                                            key={id}
                                            className="border-zoru-line"
                                        >
                                            <ZoruTableCell className="text-zoru-ink">
                                                {(c.customerEmail as string) ||
                                                    '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {itemsArr.length}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtMoney(
                                                    c.subtotal,
                                                    (c.currency as string) ||
                                                        'INR',
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtDate(c.lastInteractionAt)}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge
                                                    variant={statusVariant(status)}
                                                >
                                                    {status}
                                                </ZoruBadge>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <RecoveryButton cartId={id} />
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
