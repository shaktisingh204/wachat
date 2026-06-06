import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function PettyCashDetailLoading() {
  return (
    <EntityDetailShell
      title="Loading..."
      eyebrow="PETTY CASH"
      back={{ href: '/dashboard/crm/petty-cash', label: 'All floats' }}
    >
      <div className="space-y-4">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </EntityDetailShell>
  );
}
