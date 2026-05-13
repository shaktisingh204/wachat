/**
 * Inventory item detail page — server component.
 *
 * Linked from the items list. Uses <EntityDetailShell> with eyebrow,
 * title, back link, status pill, and an "Edit" action.
 *
 * Fetches the product via `getCrmProductById` (dual-impl: rust or legacy).
 * Activity footer is rendered via `audit: { entityKind: 'item', entityId }`.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmProductById } from '@/app/actions/crm-products.actions';

interface PageProps {
  params: Promise<{ productId: string }>;
}

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function fmtMoney(currency: string | undefined, amount: number | undefined): string {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '—';
  return `${currency || ''} ${amount}`.trim();
}

export default async function InventoryItemDetailPage({ params }: PageProps) {
  const { productId } = await params;
  const product = await getCrmProductById(productId);
  if (!product) notFound();

  const tracking = product.isTrackInventory;
  const stockTone: 'green' | 'amber' | 'red' | 'neutral' = !tracking
    ? 'neutral'
    : product.totalStock <= 0
      ? 'red'
      : product.totalStock <= 5
        ? 'amber'
        : 'green';

  const statusLabel = !tracking
    ? 'Not tracked'
    : `${product.totalStock} in stock`;

  return (
    <EntityDetailShell
      eyebrow="INVENTORY ITEM"
      title={product.name}
      status={{ label: statusLabel, tone: stockTone }}
      back={{ href: '/dashboard/crm/inventory/items', label: 'Back to all items' }}
      actions={
        <>
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href={`/dashboard/crm/inventory/items/${productId}/activity`}>
              View activity
            </Link>
          </ZoruButton>
          <ZoruButton size="sm" asChild>
            <Link href={`/dashboard/crm/inventory/items/${productId}/edit`}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              Edit
            </Link>
          </ZoruButton>
        </>
      }
      audit={{ entityKind: 'item', entityId: productId }}
    >
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">SKU</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{fmt(product.sku)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Item type</dt>
              <dd className="capitalize text-zinc-900 dark:text-zinc-100">
                {fmt(product.itemType)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">HSN / SAC</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{fmt(product.hsnSac)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Tax rate</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {typeof product.taxRate === 'number' ? `${product.taxRate}%` : '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-500">Description</dt>
              <dd className="whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                {fmt(product.description)}
              </dd>
            </div>
          </dl>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Pricing</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-zinc-500">Cost price</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {fmtMoney(product.currency, product.costPrice)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Selling price</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {fmtMoney(product.currency, product.sellingPrice)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Currency</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{fmt(product.currency)}</dd>
            </div>
          </dl>
        </ZoruCardContent>
      </ZoruCard>

      {tracking ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Inventory</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500">Total stock</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {fmt(product.totalStock)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Batch tracking</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {product.batchTracking ? 'Yes' : 'No'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">Warehouses</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {Array.isArray(product.inventory) && product.inventory.length > 0
                    ? `${product.inventory.length} location${product.inventory.length === 1 ? '' : 's'}`
                    : 'No locations'}
                </dd>
              </div>
            </dl>
          </ZoruCardContent>
        </ZoruCard>
      ) : null}
    </EntityDetailShell>
  );
}
