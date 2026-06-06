/**
 * SabBigin products list, simplified vs full CRM products.
 *
 * Reuses the existing `getCrmProducts` server action; renders a single
 * name / SKU / price table. No stock dashboards, no item-type filters,
 * no per-product KPIs.
 */

import Link from 'next/link';
import { Package, Plus } from 'lucide-react';

import {
    Card,
    EmptyState,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCrmProducts } from '@/app/actions/crm-products.actions';

import { SabbiginNav } from '../_components/sabbigin-shell';
import { formatCurrency } from '../_components/sabbigin-data';

export const dynamic = 'force-dynamic';

interface SearchParams {
    page?: string;
    q?: string;
}

interface PageProps {
    searchParams: Promise<SearchParams>;
}

export default async function SabbiginProductsPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const page = Math.max(1, Number(sp.page) || 1);
    const q = (sp.q ?? '').trim();

    const { products, total } = await getCrmProducts(page, 25, q || undefined);

    return (
        <EntityListShell
            title="Products"
            subtitle={`${total.toLocaleString()} product${total === 1 ? '' : 's'}`}
            primaryAction={
                // Navigation target, so this is a Link styled with the 20ui
                // button classes. The 20ui Button renders a <button> and cannot
                // be an anchor, so a styled Link is the correct link-as-button.
                <Link
                    href="/dashboard/crm/sales-crm/products/new"
                    className="u-btn u-btn--outline u-btn--sm"
                >
                    <Plus size={13} aria-hidden="true" />
                    <span className="u-btn__label">New product (full CRM)</span>
                </Link>
            }
        >
            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/products" />

                {products.length === 0 ? (
                    <Card padding="none">
                        <EmptyState
                            icon={Package}
                            title="No products yet"
                            description="Add your first one from the full CRM. The create form lives there."
                            action={
                                <Link
                                    href="/dashboard/crm/sales-crm/products/new"
                                    className="u-btn u-btn--primary u-btn--sm"
                                >
                                    <Plus size={13} aria-hidden="true" />
                                    <span className="u-btn__label">New product (full CRM)</span>
                                </Link>
                            }
                        />
                    </Card>
                ) : (
                    <Card padding="none" className="overflow-hidden">
                        <Table hover>
                            <THead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th>SKU</Th>
                                    <Th align="right">Price</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {products.map((p) => {
                                    const id = String(p._id);
                                    const price =
                                        (p as { price?: number; rate?: number }).price ??
                                        (p as { rate?: number }).rate ??
                                        0;
                                    const sku = (p as { sku?: string }).sku ?? '';
                                    return (
                                        <Tr key={id}>
                                            <Td>
                                                <Link
                                                    href={`/dashboard/crm/sales-crm/products/${id}`}
                                                    className="font-medium text-[var(--st-text)] hover:underline"
                                                >
                                                    {p.name ?? 'Product'}
                                                </Link>
                                            </Td>
                                            <Td>
                                                <span className="text-[var(--st-text-secondary)]">
                                                    {sku || 'No SKU'}
                                                </span>
                                            </Td>
                                            <Td align="right">
                                                <span className="font-medium text-[var(--st-text)]">
                                                    {formatCurrency(price)}
                                                </span>
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </Card>
                )}
            </div>
        </EntityListShell>
    );
}
