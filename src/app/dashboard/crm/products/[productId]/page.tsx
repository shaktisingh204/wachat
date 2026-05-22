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

import { ItemDetailBody } from '../../inventory/items/_components/item-detail-body';

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
    (product.reorderPoint as number | undefined) ??
    product.inventory?.[0]?.reorderPoint ??
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
    </EntityDetailShell>
  );
}
