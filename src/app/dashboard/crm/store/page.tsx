import { Button, Card, StatCard } from '@/components/sabcrm/20ui/compat';
import {
  Store,
  Package,
  Tag,
  Truck,
  ShoppingBag,
  AlertTriangle,
  ArrowRight,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * Store overview — `/dashboard/crm/store`.
 *
 * Server component. Aggregates store-wide KPIs across the 5 sub-modules
 * (storefronts, products, pricing, shipping, orders, abandoned carts).
 *
 * Per CRM_REBUILD_PLAN §6.3.
 */

import Link from 'next/link';

import { getStoreOverviewKpis } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

interface QuickLink {
    href: string;
    label: string;
    description: string;
    icon: typeof Store;
}

const QUICK_LINKS: QuickLink[] = [
    {
        href: '/dashboard/crm/store/storefronts',
        label: 'Storefronts',
        description: 'Manage online stores, domains and homepage layout.',
        icon: Store,
    },
    {
        href: '/dashboard/crm/store/products',
        label: 'Products',
        description: 'Catalog with images, pricing and inventory toggles.',
        icon: Package,
    },
    {
        href: '/dashboard/crm/store/pricing',
        label: 'Pricing rules',
        description: 'Discount engine — percent off, fixed off, BXGY and bundles.',
        icon: Tag,
    },
    {
        href: '/dashboard/crm/store/shipping',
        label: 'Shipping zones',
        description: 'Country / state coverage with per-method rates.',
        icon: Truck,
    },
    {
        href: '/dashboard/crm/store/orders',
        label: 'Orders',
        description: 'Storefront orders with payment and fulfillment state.',
        icon: ShoppingBag,
    },
    {
        href: '/dashboard/crm/store/abandoned-cart',
        label: 'Abandoned carts',
        description: 'Drop-off carts with recovery email dispatch.',
        icon: AlertTriangle,
    },
];

export default async function StoreOverviewPage() {
    const kpi = await getStoreOverviewKpis();

    return (
        <EntityListShell
            title="Online store"
            subtitle="Storefronts, products, pricing rules, shipping zones and orders."
            primaryAction={
                <Button asChild variant="outline">
                    <Link href="/dashboard/crm/store/storefronts/new">
                        New storefront
                    </Link>
                </Button>
            }
        >

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard
                    label="Published storefronts"
                    value={kpi.publishedStorefronts}
                />
                <StatCard label="Total products" value={kpi.totalProducts} />
                <StatCard label="Live pricing rules" value={kpi.liveRules} />
                <StatCard label="Pending orders" value={kpi.pendingOrders} />
                <StatCard
                    label="Abandoned carts"
                    value={kpi.abandonedCarts}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {QUICK_LINKS.map((link) => {
                    const Icon = link.icon;
                    return (
                        <Card key={link.href} className="p-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-[var(--st-bg-muted)]">
                                    <Icon
                                        className="h-4.5 w-4.5 text-[var(--st-text)]"
                                        strokeWidth={1.75}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-[14px] font-medium text-[var(--st-text)]">
                                        {link.label}
                                    </h3>
                                    <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                                        {link.description}
                                    </p>
                                    <Link
                                        href={link.href}
                                        className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-[var(--st-text)] hover:underline"
                                    >
                                        Open <ArrowRight className="h-3 w-3" />
                                    </Link>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </EntityListShell>
    );
}
