import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  Plus,
  Truck } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';

/**
 * Shipping zones list — `/dashboard/crm/store/shipping`.
 */

import Link from 'next/link';

import {
    getShippingZoneList,
    getStorefrontList,
} from '@/app/actions/crm-store.actions';
import { StorefrontFilterClient } from '../products/_components/storefront-filter';

export const dynamic = 'force-dynamic';

function statusVariant(
    status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'success';
    if (s === 'archived') return 'danger';
    return 'ghost';
}

interface PageProps {
    searchParams: Promise<{ storefrontId?: string }>;
}

export default async function ShippingZoneListPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const storefrontId = sp.storefrontId ?? '';

    const [{ items }, { items: storefronts }] = await Promise.all([
        getShippingZoneList(storefrontId || undefined),
        getStorefrontList(),
    ]);

    const newHref = storefrontId
        ? `/dashboard/crm/store/shipping/new?storefrontId=${storefrontId}`
        : '/dashboard/crm/store/shipping/new';

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Shipping zones"
                subtitle="Country / state coverage with per-method rates."
                icon={Truck}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    { label: 'Shipping' },
                ]}
                actions={
                    <ZoruButton variant="outline" asChild>
                        <Link href={newHref}>
                            <Plus className="h-4 w-4" />
                            New zone
                        </Link>
                    </ZoruButton>
                }
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
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">All shipping zones</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Countries</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Methods</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {items.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={4}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        No shipping zones yet.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                items.map((z) => {
                                    const id = String(
                                        (z as Record<string, unknown>)._id ?? '',
                                    );
                                    const status =
                                        ((z as Record<string, unknown>).status as
                                            | string
                                            | undefined) ?? 'draft';
                                    const countries = Array.isArray(z.countries)
                                        ? (z.countries as unknown[]).map((c) =>
                                              String(c),
                                          )
                                        : [];
                                    const methodCount = Array.isArray(z.methods)
                                        ? (z.methods as unknown[]).length
                                        : 0;
                                    return (
                                        <ZoruTableRow
                                            key={id}
                                            className="border-zoru-line"
                                        >
                                            <ZoruTableCell className="text-zoru-ink">
                                                <Link
                                                    href={`/dashboard/crm/store/shipping/${id}`}
                                                    className="hover:underline"
                                                >
                                                    {(z.name as string) || 'Untitled'}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {countries.length > 0
                                                    ? countries.join(', ')
                                                    : '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {methodCount}
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
