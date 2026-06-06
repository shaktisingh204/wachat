/**
 * Stock-adjustment activity (audit log) — server route.
 *
 * Linked from the adjustment detail page. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'stock_adjustment'`.
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { FilteredAuditTimeline } from '../../_components/filtered-audit-timeline';
import { mapToStockAdjustmentDto } from '../../types';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';
import { ActivityFilter } from './activity-filter';
import { Skeleton } from '@/components/sabcrm/20ui';

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
  if (!rawAdj) notFound();
  
  const adj = mapToStockAdjustmentDto(rawAdj);

  const productName = adj.productName as string | undefined;
  const quantity = adj.quantity ?? 0;
  const title = productName
    ? `${productName} (${quantity > 0 ? '+' : ''}${quantity})`
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
        <Suspense fallback={<div className="h-9 w-[260px] animate-pulse rounded-md bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]" />}>
          <ActivityFilter />
        </Suspense>
      </div>
      <Suspense fallback={
        <div className="space-y-4 py-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      }>
        <FilteredAuditTimeline entityKind="stock_adjustment" entityId={id} eventType={eventType} />
      </Suspense>
    </EntityDetailShell>
  );
}
