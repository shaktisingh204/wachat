'use client';

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Cog,
  Package,
  ShoppingBag,
  ShoppingCart,
  Store,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getCatalogs } from '@/app/actions/catalog.actions';

/**
 * /dashboard/facebook/commerce — Meta Commerce hub.
 *
 * Lightweight landing page for the commerce sub-module: live counts of
 * catalogs and links into the existing detail pages. Backed by the
 * `meta-suite` Rust crate via the `getCatalogs` server action.
 */

import * as React from 'react';

interface Tile {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const TILES: Tile[] = [
  {
    key: 'catalogs',
    label: 'Catalogs',
    description: 'Browse Meta Business catalogs and their products.',
    href: '/dashboard/facebook/catalog',
    icon: <ShoppingBag />,
  },
  {
    key: 'products',
    label: 'Products & Collections',
    description: 'Products, collections and product sets per catalog.',
    href: '/dashboard/facebook/commerce/products',
    icon: <Package />,
  },
  {
    key: 'shop',
    label: 'Shop Setup',
    description: 'Configure the on-Facebook Shop for this Page.',
    href: '/dashboard/facebook/commerce/shop',
    icon: <Store />,
  },
  {
    key: 'orders',
    label: 'Orders',
    description: 'Buyer orders captured by the Meta Commerce Manager.',
    href: '/dashboard/facebook/commerce/orders',
    icon: <ShoppingCart />,
  },
  {
    key: 'collections',
    label: 'Collections',
    description: 'Curated product sets surfaced inside the Shop.',
    href: '/dashboard/facebook/commerce/collections',
    icon: <Package />,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Sales, traffic, and shop conversion metrics.',
    href: '/dashboard/facebook/commerce/analytics',
    icon: <BarChart3 />,
  },
  {
    key: 'api',
    label: 'API',
    description: 'Webhooks and access tokens for the Commerce Manager.',
    href: '/dashboard/facebook/commerce/api',
    icon: <Cog />,
  },
];

export default function FacebookCommercePage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [catalogCount, setCatalogCount] = useState<number | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const res = await getCatalogs(projectId);
      const list = (res.catalogs ?? []) as Array<{ product_count?: number }>;
      setCatalogCount(list.length);
      setProductCount(
        list.reduce((sum, c) => sum + (c.product_count ?? 0), 0),
      );
    })();
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<ShoppingBag />}
          title="No project selected"
          description="Pick a Facebook page / project to see its Commerce setup."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">Dashboard</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Commerce</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header>
        <h1 className="text-2xl text-zoru-ink">Commerce</h1>
        <p className="mt-1 text-sm text-zoru-ink-muted">
          Catalogs, products, orders and Shop setup for this Meta Business.
          Data comes from the <code>meta-suite</code> Rust crate.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">
            Catalogs
          </p>
          <p className="mt-1 text-2xl text-zoru-ink">
            {catalogCount === null ? '—' : catalogCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">
            Products
          </p>
          <p className="mt-1 text-2xl text-zoru-ink">
            {productCount === null ? '—' : productCount.toLocaleString()}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Card key={t.key} className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zoru-surface-2 text-zoru-ink-muted [&_svg]:size-4">
                {t.icon}
              </div>
              <div>
                <p className="text-sm text-zoru-ink">{t.label}</p>
              </div>
            </div>
            <p className="text-xs text-zoru-ink-muted">{t.description}</p>
            <footer className="flex items-center justify-between border-t border-zoru-line pt-3">
              <Badge variant="ghost">live</Badge>
              <Button asChild variant="ghost" size="sm">
                <Link href={t.href} className="inline-flex items-center">
                  Open
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </footer>
          </Card>
        ))}
      </div>
    </div>
  );
}
