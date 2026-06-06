/**
 * Product detail — `/dashboard/crm/products/[productId]`.
 *
 * Server component: fetches the product via `getCrmProductById`
 * (dual-impl) and renders the shared inventory `<ItemDetailBody>`
 * cards inside an `<EntityDetailShell>`. Mirrors the inventory-item
 * detail page; the header exposes Edit + Duplicate, matching the
 * `new`/`edit` routes that already live alongside this one.
 *
 * Per CRM_REBUILD_PLAN §1D.3.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { WithId } from 'mongodb';
import { Copy, Pencil } from 'lucide-react';
import nextDynamic from 'next/dynamic';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Button, Card, CardHeader, CardTitle, CardBody, Skeleton } from '@/components/sabcrm/20ui';
import { getCrmProductById } from '@/app/actions/crm-products.actions';
import type { CrmProduct } from '@/lib/definitions';

import { ItemDetailBody } from '../../inventory/items/_components/item-detail-body';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

// Dynamic import with for zero hydration discrepancies in ProductHistoryGraph
const ProductHistoryGraph = nextDynamic(
  () => import('../_components/product-history-graph').then((m) => m.ProductHistoryGraph),
  {  loading: () => <ProductHistoryGraphSkeleton /> }
);

function ProductHistoryGraphSkeleton() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Price & Stock History</CardTitle>
      </CardHeader>
      <CardBody className="h-64 flex items-center justify-center bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--st-border)] border-t-transparent" />
          <span className="text-sm text-[var(--st-text)]">Loading chart history...</span>
        </div>
      </CardBody>
    </Card>
  );
}

function ActivityTimelineSkeleton() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Activity</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

interface PageProps {
  params: Promise<{ productId: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { productId } = await params;
  const product = (await getCrmProductById(productId)) as
    | (WithId<CrmProduct> & Record<string, unknown>)
    | null;
  if (!product) notFound();

  /* Stock summary for the header status pill. */
  const tracking = product.isTrackInventory;
  const totalStock = product.totalStock ?? 0;
  const reorderPoint =
    product.inventory?.[0]?.reorderPoint ??
    (product.reorderPoint as number | undefined) ??
    0;
  const outOfStock = tracking && totalStock <= 0;
  const lowStock =
    tracking && totalStock > 0 && reorderPoint > 0 && totalStock <= reorderPoint;

  const stockTone: 'green' | 'amber' | 'red' | 'neutral' = !tracking
    ? 'neutral'
    : outOfStock
      ? 'red'
      : lowStock
        ? 'amber'
        : 'green';
  const stockLabel = !tracking ? 'Not tracked' : `${totalStock} in stock`;

  return (
    <EntityDetailShell
      eyebrow={`PRODUCT · ${String(product.itemType ?? 'goods').toUpperCase()}`}
      title={product.name}
      status={{ label: stockLabel, tone: stockTone }}
      back={{ href: '/dashboard/crm/products', label: 'Products' }}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link
              href={`/dashboard/crm/products/new?fromKind=product&fromId=${productId}`}
            >
              <Copy className="h-4 w-4" /> Duplicate
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/crm/products/${productId}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
        </div>
      }
      audit={
        <React.Suspense fallback={<ActivityTimelineSkeleton />}>
          <EntityAuditTimeline entityKind="item" entityId={productId} />
        </React.Suspense>
      }
    >
      <ItemDetailBody product={product} productId={productId} />
      
      {/* Supplier Information Card */}
      <Card className="mt-6 border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Supplier Information</CardTitle>
        </CardHeader>
        <CardBody>
          {product.supplierName ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-[var(--st-text-secondary)]">Supplier Name</p>
                <p className="font-medium">{String(product.supplierName)}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--st-text-secondary)]">Contact</p>
                <p className="font-medium">{product.supplierContact ? String(product.supplierContact) : '—'}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--st-text-secondary)]">Lead Time</p>
                <p className="font-medium">{product.supplierLeadTime ? `${product.supplierLeadTime} Days` : '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--st-text-secondary)]">No supplier information available for this product.</p>
          )}
        </CardBody>
      </Card>

      {/* History Graph */}
      <React.Suspense fallback={<ProductHistoryGraphSkeleton />}>
        <ProductHistoryGraph />
      </React.Suspense>
    </EntityDetailShell>
  );
}
