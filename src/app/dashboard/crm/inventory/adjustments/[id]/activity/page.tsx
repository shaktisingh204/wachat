/**
 * Stock-adjustment activity (audit log) — server route.
 *
 * Linked from the adjustment detail page. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'stock_adjustment'`.
 */

import { notFound } from 'next/navigation';

import { FilteredAuditTimeline } from '../../_components/filtered-audit-timeline';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { mapToStockAdjustmentDto } from '../../types';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ eventType?: string }>;
}

export default async function StockAdjustmentActivityPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const { eventType } = resolvedSearch;
  const { id } = resolvedParams;
  const rawAdj = await getCrmStockAdjustmentById(id);
  const adj = mapToStockAdjustmentDto(rawAdj);
  if (!rawAdj) notFound();

  const productName = adj.productName as string | undefined;
  const title = productName
    ? `${productName} (${adj.quantity > 0 ? '+' : ''}${adj.quantity})`
    : `Adjustment #${id.slice(-6)}`;

  return (
    <EntityDetailShell
      title={title}
      eyebrow="STOCK ADJUSTMENT ACTIVITY"
      back={{
        href: `/dashboard/crm/inventory/adjustments/${id}`,
        label: 'Back to adjustment',
      }}
    >
      <div className="mb-4 flex items-center justify-end">
        <form className="flex items-center gap-2">
          <label htmlFor="eventType" className="text-sm text-zinc-500">Filter by event:</label>
          <select 
            id="eventType" 
            name="eventType" 
            className="rounded-md border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-800"
            defaultValue={eventType || ''}
          >
            <option value="">All events</option>
            <option value="create">Created</option>
            <option value="update">Updated</option>
            <option value="status_change">Status Changed</option>
          </select>
          <button type="submit" className="rounded bg-zinc-100 px-3 py-1 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">Filter</button>
        </form>
      </div>
      <FilteredAuditTimeline entityKind="stock_adjustment" entityId={id} eventType={eventType} />
    </EntityDetailShell>
  );
}
