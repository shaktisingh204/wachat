/**
 * SabBigin products list, simplified vs full CRM products.
 *
 * Reuses the existing `getCrmProducts` server action; renders a single
 * name / SKU / price table. No stock dashboards, no item-type filters,
 * no per-product KPIs. The create form lives in the full CRM.
 */

import Link from 'next/link';
import { Package, Plus, Tag } from 'lucide-react';

import {
    Card,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';
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
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin</PageEyebrow>
                    <PageTitle>Products</PageTitle>
                    <PageDescription>
                        {total.toLocaleString()} product{total === 1 ? '' : 's'} in your catalogue.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    {/* Navigation target, so this is a Link styled with the 20ui button classes. */}
                    <Link
                        href="/dashboard/crm/sales-crm/products/new"
                        className="u-btn u-btn--primary u-btn--sm"
                    >
                        <Plus size={13} aria-hidden="true" />
                        <span className="u-btn__label">New product</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <SabbiginNav active="/dashboard/sabbigin/products" />

            {products.length === 0 ? (
                <Card padding="none" className="flex min-h-[280px] items-center justify-center">
                    <EmptyState
                        icon={Package}
                        title="No products yet"
                        description="Add your first product in the full CRM. The create form lives there."
                        action={
                            <Link
                                href="/dashboard/crm/sales-crm/products/new"
                                className="u-btn u-btn--primary u-btn--sm"
                            >
                                <Plus size={13} aria-hidden="true" />
                                <span className="u-btn__label">New product</span>
                            </Link>
                        }
                    />
                </Card>
            ) : (
                <Card padding="none" className="overflow-hidden">
                    <Table density="comfortable" hover>
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
                                                className="-mx-1 flex items-center gap-2.5 rounded-[var(--st-radius-sm)] px-1 py-0.5 font-medium text-[var(--st-text)] transition-colors hover:text-[var(--st-accent)]"
                                            >
                                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                                    <Package className="h-3.5 w-3.5" aria-hidden="true" />
                                                </span>
                                                <span className="truncate">{p.name ?? 'Product'}</span>
                                            </Link>
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            <span className="inline-flex items-center gap-1.5 font-mono text-[12px]">
                                                {sku ? (
                                                    <>
                                                        <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                        {sku}
                                                    </>
                                                ) : (
                                                    'No SKU'
                                                )}
                                            </span>
                                        </Td>
                                        <Td align="right">
                                            <span className="font-semibold tabular-nums text-[var(--st-text)]">
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
    );
}
