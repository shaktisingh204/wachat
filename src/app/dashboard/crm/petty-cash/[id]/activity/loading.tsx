import { Skeleton } from '@/components/sabcrm/20ui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function PettyCashActivityLoading() {
  return (
    <EntityDetailShell
      title="Activity Timeline"
      eyebrow="PETTY CASH"
      back={{ href: '/dashboard/crm/petty-cash', label: 'All floats' }}
    >
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </EntityDetailShell>
  );
}
