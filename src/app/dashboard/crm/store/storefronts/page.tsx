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
  Store } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';

/**
 * Storefronts list — `/dashboard/crm/store/storefronts`.
 */

import Link from 'next/link';

import { getStorefrontList } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

function statusVariant(
    status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
    const s = (status || '').toLowerCase();
    if (s === 'published') return 'success';
    if (s === 'archived') return 'danger';
    return 'ghost';
}

export default async function StorefrontListPage() {
    const { items, error } = await getStorefrontList();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Storefronts"
                subtitle="Manage online stores, custom domains and homepage layout."
                icon={Store}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    { label: 'Storefronts' },
                ]}
                actions={
                    <ZoruButton variant="outline" asChild>
                        <Link href="/dashboard/crm/store/storefronts/new">
                            <Plus className="h-4 w-4" />
                            New storefront
                        </Link>
                    </ZoruButton>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">All storefronts</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                        Each storefront has its own currency, domain and homepage.
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Slug</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Domain</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Currency</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {error ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={5}
                                        className="h-20 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        Couldn&apos;t load storefronts — {error}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : items.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={5}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        No storefronts yet. Create one to start selling.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                items.map((sf) => {
                                    const id = String(
                                        (sf as Record<string, unknown>)._id ?? '',
                                    );
                                    const status =
                                        ((sf as Record<string, unknown>).status as
                                            | string
                                            | undefined) ?? 'draft';
                                    return (
                                        <ZoruTableRow
                                            key={id || (sf.slug as string)}
                                            className="border-zoru-line"
                                        >
                                            <ZoruTableCell className="text-zoru-ink">
                                                <Link
                                                    href={`/dashboard/crm/store/storefronts/${id}`}
                                                    className="hover:underline"
                                                >
                                                    {(sf.name as string) || 'Untitled'}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {(sf.slug as string) || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {(sf.domain as string) || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {(sf.currency as string) || 'INR'}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge variant={statusVariant(status)}>
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
