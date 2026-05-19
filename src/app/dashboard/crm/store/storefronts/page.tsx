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
import { Plus } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';

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
        <EntityListShell
            title="Storefronts"
            subtitle="Manage online stores, custom domains and homepage layout."
            primaryAction={
                <ZoruButton variant="outline" asChild>
                    <Link href="/dashboard/crm/store/storefronts/new">
                        <Plus className="h-4 w-4" />
                        New storefront
                    </Link>
                </ZoruButton>
            }
        >

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
                                                <EntityRowLink
                                                    href={`/dashboard/crm/store/storefronts/${id}`}
                                                    label={(sf.name as string) || 'Untitled'}
                                                    subtitle={
                                                        (sf.slug as string) || undefined
                                                    }
                                                />
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
        </EntityListShell>
    );
}
