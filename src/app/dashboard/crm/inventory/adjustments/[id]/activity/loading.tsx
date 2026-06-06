'use client';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function StockAdjustmentActivityLoading() {
  return (
    <EntityDetailShell
      title="Loading Activity..."
      eyebrow="STOCK ADJUSTMENT ACTIVITY"
      back={{
        href: '#',
        label: 'Back to adjustment',
      }}
    >
      <div className="flex flex-col gap-6 p-4">
        <div className="flex justify-end mb-4">
          <Skeleton className="h-9 w-[200px]" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </EntityDetailShell>
  );
}
