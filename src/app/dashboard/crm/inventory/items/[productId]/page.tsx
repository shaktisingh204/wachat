/**
 * Inventory item detail page — server component.
 *
 * Per CRM_REBUILD_PLAN §1D.2. Header action group (9 buttons), body
 * cards (Overview, Pricing, Inventory-per-warehouse, Variants, Vendors,
 * Accounting, Images, Dimensions, Specs, Custom attrs, Tags), right
 * rail (Stock summary, Quick actions, Related entities), and an
 * activity footer.
 *
 * Supports `?print=1` (barcode sheet) and `?qr=1` (QR sheet) for label
 * printing — the print path renders `<ItemPrintView>` instead of the
 * normal detail shell.
 */

import { notFound } from 'next/navigation';
import type { WithId } from 'mongodb';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmProductById } from '@/app/actions/crm-products.actions';
import type { CrmProduct } from '@/lib/definitions';

import { ItemDetailActions } from '../_components/item-detail-actions';
import { ItemDetailBody } from '../_components/item-detail-body';
import { ItemRelatedRail } from '../_components/item-related-rail';
import { ItemPrintView } from '../_components/item-print-view';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

async function fetchWithTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn('MongoDB fetch timeout exceeded');
      resolve(fallback);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}


interface PageProps {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ print?: string; qr?: string; tab?: string }>;
}

export default async function InventoryItemDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ productId }, sp] = await Promise.all([params, searchParams]);
  const product = await fetchWithTimeout(getCrmProductById(productId), 8000, null) as (WithId<CrmProduct> & Record<string, unknown>) | null;
  if (!product) notFound();

  /* Print / QR sheet variants */
  if (sp.print === '1' || sp.qr === '1') {
    return (
      <ItemPrintView
        variant={sp.qr === '1' ? 'qr' : 'barcode'}
        productId={productId}
        productName={product.name}
        sku={product.sku}
        barcode={product.barcode as string | undefined}
        sellingPrice={product.sellingPrice ?? 0}
        currency={product.currency || 'INR'}
      />
    );
  }

  /* Status + stock derivations for the header / rail. */
  const status = (product.status as string | undefined) ?? 'active';
  const tracking = product.isTrackInventory;
  const reorderPoint =
    (product.reorderPoint as number | undefined) ??
    product.inventory?.[0]?.reorderPoint ??
    0;
  const outOfStock = tracking && (product.totalStock ?? 0) <= 0;
  const lowStock =
    tracking &&
    (product.totalStock ?? 0) > 0 &&
    reorderPoint > 0 &&
    (product.totalStock ?? 0) <= reorderPoint;

  const stockTone: 'green' | 'amber' | 'red' | 'neutral' = !tracking
    ? 'neutral'
    : outOfStock
      ? 'red'
      : lowStock
        ? 'amber'
        : 'green';

  const stockLabel = !tracking
    ? 'Not tracked'
    : `${product.totalStock ?? 0} in stock`;

  return (
    <EntityDetailShell
      eyebrow={`INVENTORY ITEM · ${String(product.itemType ?? 'goods').toUpperCase()}`}
      title={product.name}
      status={{ label: stockLabel, tone: stockTone }}
      back={{ href: '/dashboard/crm/inventory/items', label: 'Back to all items' }}
      actions={
        <ItemDetailActions
          productId={productId}
          productName={product.name}
          status={status}
        />
      }
      rightRail={
        <ItemRelatedRail
          productId={productId}
          totalStock={product.totalStock ?? 0}
          lowStock={Boolean(lowStock)}
          outOfStock={Boolean(outOfStock)}
          lastUpdated={
            product.updatedAt
              ? new Date(product.updatedAt).toISOString()
              : undefined
          }
        />
      }
      audit={<EntityAuditTimeline entityKind="item" entityId={productId} />}
    >
      <ItemDetailBody product={product} productId={productId} defaultTab={sp.tab} />
    </EntityDetailShell>
  );
}
