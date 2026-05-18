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
  Tag } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';

/**
 * Pricing rules list — `/dashboard/crm/store/pricing`.
 */

import Link from 'next/link';

import {
    getPricingRuleList,
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

export default async function PricingRulesPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const storefrontId = sp.storefrontId ?? '';

    const [{ items }, { items: storefronts }] = await Promise.all([
        getPricingRuleList(storefrontId || undefined),
        getStorefrontList(),
    ]);

    const newHref = storefrontId
        ? `/dashboard/crm/store/pricing/new?storefrontId=${storefrontId}`
        : '/dashboard/crm/store/pricing/new';

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Pricing rules"
                subtitle="Discount engine — percent off, fixed off, BXGY and bundles."
                icon={Tag}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    { label: 'Pricing' },
                ]}
                actions={
                    <ZoruButton variant="outline" asChild>
                        <Link href={newHref}>
                            <Plus className="h-4 w-4" />
                            New rule
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
                    <h2 className="text-[16px] text-zoru-ink">All pricing rules</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                        Higher priority rules run first.
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Kind</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Value</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Priority</ZoruTableHead>
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
                                        No pricing rules yet.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                items.map((r) => {
                                    const id = String(
                                        (r as Record<string, unknown>)._id ?? '',
                                    );
                                    const status =
                                        ((r as Record<string, unknown>).status as
                                            | string
                                            | undefined) ?? 'draft';
                                    return (
                                        <ZoruTableRow
                                            key={id}
                                            className="border-zoru-line"
                                        >
                                            <ZoruTableCell className="text-zoru-ink">
                                                <Link
                                                    href={`/dashboard/crm/store/pricing/${id}`}
                                                    className="hover:underline"
                                                >
                                                    {(r.name as string) || 'Untitled'}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {(r.kind as string) || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {String(r.value ?? '—')}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {String(r.priority ?? 0)}
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
