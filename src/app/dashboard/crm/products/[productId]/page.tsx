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

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { WithId } from 'mongodb';
import { Copy, Pencil } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Button } from '@/components/zoruui';
import { getCrmProductById } from '@/app/actions/crm-products.actions';
import type { CrmProduct } from '@/lib/definitions';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/zoruui';
import { ItemDetailBody } from '../../inventory/items/_components/item-detail-body';
import { ProductHistoryGraph } from '../_components/product-history-graph';

export const dynamic = 'force-dynamic';

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
    >
      <ItemDetailBody product={product} productId={productId} />
      
      {/* Supplier Information Card */}
      <Card className="mt-6 border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Supplier Information</CardTitle>
        </CardHeader>
        <CardContent>
          {product.supplierName ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-zoru-ink-muted">Supplier Name</p>
                <p className="font-medium">{String(product.supplierName)}</p>
              </div>
              <div>
                <p className="text-sm text-zoru-ink-muted">Contact</p>
                <p className="font-medium">{product.supplierContact ? String(product.supplierContact) : '—'}</p>
              </div>
              <div>
                <p className="text-sm text-zoru-ink-muted">Lead Time</p>
                <p className="font-medium">{product.supplierLeadTime ? `${product.supplierLeadTime} Days` : '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zoru-ink-muted">No supplier information available for this product.</p>
          )}
        </CardContent>
      </Card>

      {/* History Graph */}
      <ProductHistoryGraph />
    </EntityDetailShell>
  );
}
