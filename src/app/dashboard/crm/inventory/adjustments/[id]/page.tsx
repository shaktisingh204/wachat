/**
 * Stock-adjustment detail page — server component.
 *
 * Linked from the adjustments list. Uses <EntityDetailShell> with eyebrow,
 * title, back link, reason pill, and an "Edit" action.
 *
 * Fetches the adjustment via `getCrmStockAdjustmentById`. Activity footer
 * is rendered via `audit: { entityKind: 'stock_adjustment', entityId }`.
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
import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function quantityTone(qty: number): EntityStatusTone {
  if (qty > 0) return 'green';
  if (qty < 0) return 'red';
  return 'neutral';
}

export default async function StockAdjustmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const adj = await getCrmStockAdjustmentById(id);
  if (!adj) notFound();

  const qty = typeof adj.quantity === 'number' ? adj.quantity : 0;
  const productName = (adj as any).productName as string | undefined;
  const warehouseName = (adj as any).warehouseName as string | undefined;
  const title = productName
    ? `${productName} — ${qty > 0 ? '+' : ''}${qty}`
    : `Adjustment #${String(adj._id).slice(-6)}`;

  return (
    <EntityDetailShell
      eyebrow="STOCK ADJUSTMENT"
      title={title}
      status={{
        label: `${qty > 0 ? '+' : ''}${qty}`,
        tone: quantityTone(qty),
      }}
      back={{
        href: '/dashboard/crm/inventory/adjustments',
        label: 'Back to all adjustments',
      }}
      actions={
        <>
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href={`/dashboard/crm/inventory/adjustments/${id}/activity`}>
              View activity
            </Link>
          </ZoruButton>
          <ZoruButton size="sm" asChild>
            <Link href={`/dashboard/crm/inventory/adjustments/${id}/edit`}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              Edit
            </Link>
          </ZoruButton>
        </>
      }
      audit={{ entityKind: 'stock_adjustment', entityId: id }}
    >
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Details</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Date</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {formatDate(adj.date)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Reason</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{adj.reason || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Product</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {productName || String(adj.productId)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Warehouse</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {warehouseName || String(adj.warehouseId)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Quantity</dt>
              <dd
                className={
                  qty > 0
                    ? 'font-medium text-emerald-600 dark:text-emerald-400'
                    : qty < 0
                      ? 'font-medium text-red-600 dark:text-red-400'
                      : 'text-zinc-900 dark:text-zinc-100'
                }
              >
                {qty > 0 ? '+' : ''}
                {qty}
              </dd>
            </div>
            {adj.referenceNumber ? (
              <div>
                <dt className="text-xs text-zinc-500">Reference</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {adj.referenceNumber}
                </dd>
              </div>
            ) : null}
            {adj.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">Notes</dt>
                <dd className="whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                  {adj.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        </ZoruCardContent>
      </ZoruCard>
    </EntityDetailShell>
  );
}
