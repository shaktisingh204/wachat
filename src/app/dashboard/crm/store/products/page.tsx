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
  Package } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * Products list — `/dashboard/crm/store/products`.
 *
 * Server component. Reads `?storefrontId=` from the URL to filter the
 * list. The top-of-page picker re-emits the filter via a plain link
 * select (no client island required).
 */

import Link from 'next/link';

import {
    getProductList,
    getStorefrontList,
} from '@/app/actions/crm-store.actions';
import { StorefrontFilterClient } from './_components/storefront-filter';

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

export default async function ProductListPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const storefrontId = sp.storefrontId ?? '';

    const [{ items }, { items: storefronts }] = await Promise.all([
        getProductList(storefrontId || undefined),
        getStorefrontList(),
    ]);

    const newHref = storefrontId
        ? `/dashboard/crm/store/products/new?storefrontId=${storefrontId}`
        : '/dashboard/crm/store/products/new';

    return (
        <EntityListShell
            title="Products"
            subtitle="Catalog with images, pricing and inventory toggles."
            primaryAction={
                <ZoruButton variant="outline" asChild>
                    <Link href={newHref}>
                        <Plus className="h-4 w-4" />
                        New product
                    </Link>
                </ZoruButton>
            }
        >

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
                    <h2 className="text-[16px] text-zoru-ink">All products</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                        {storefrontId
                            ? 'Showing products for the selected storefront.'
                            : 'Showing products across every storefront.'}
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">SKU</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Price</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Inventory</ZoruTableHead>
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
                                        No products yet.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                items.map((p) => {
                                    const id = String(
                                        (p as Record<string, unknown>)._id ?? '',
                                    );
                                    const status =
                                        ((p as Record<string, unknown>).status as
                                            | string
                                            | undefined) ?? 'draft';
                                    return (
                                        <ZoruTableRow
                                            key={id}
                                            className="border-zoru-line"
                                        >
                                            <ZoruTableCell className="text-zoru-ink">
                                                <Link
                                                    href={`/dashboard/crm/store/products/${id}`}
                                                    className="hover:underline"
                                                >
                                                    {(p.title as string) ||
                                                        'Untitled product'}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {(p.sku as string) || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {typeof p.price === 'number'
                                                    ? `${(p.currency as string) || 'INR'} ${(p.price as number).toFixed(2)}`
                                                    : '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {p.inventoryTracked
                                                    ? 'Tracked'
                                                    : 'Untracked'}
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
        </EntityListShell>
    );
}
