/**
 * SabBigin products list — simplified vs full CRM products.
 *
 * Reuses the existing `getCrmProducts` server action; renders a single
 * name / SKU / price column. No stock dashboards, no item-type filters,
 * no per-product KPIs.
 */

import Link from 'next/link';

import { Button, Card } from '@/components/sabcrm/20ui/compat';
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
                <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/crm/sales-crm/products/new">
                        New product (full CRM)
                    </Link>
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/products" />

                {products.length === 0 ? (
                    <Card className="p-6 text-sm text-[var(--st-text-secondary)]">
                        No products yet. Add your first one from the full CRM (the create form lives there).
                    </Card>
                ) : (
                    <Card className="overflow-hidden p-0">
                        <ul className="divide-y divide-[var(--st-border)]">
                            {products.map((p) => {
                                const id = String(p._id);
                                const price = (p as { price?: number; rate?: number }).price ?? (p as { rate?: number }).rate ?? 0;
                                const sku = (p as { sku?: string }).sku ?? '';
                                return (
                                    <li key={id}>
                                        <Link
                                            href={`/dashboard/crm/sales-crm/products/${id}`}
                                            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--st-bg-muted)]"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[var(--st-text)]">{p.name ?? 'Product'}</p>
                                                <p className="truncate text-xs text-[var(--st-text-secondary)]">{sku || '—'}</p>
                                            </div>
                                            <p className="shrink-0 text-sm font-medium text-[var(--st-text)]">
                                                {formatCurrency(price)}
                                            </p>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>
                )}
            </div>
        </EntityListShell>
    );
}
