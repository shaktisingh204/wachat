import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton } from '@/components/sabcrm/20ui';

export default function ProductionOrderActivityLoading() {
  return (
    <EntityDetailShell
      title="Loading Activity..."
      eyebrow="PRODUCTION ORDER ACTIVITY"
      back={{ href: '#', label: 'Back to order' }}
    >
      <div className="space-y-6 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-6">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </div>
    </EntityDetailShell>
  );
}
