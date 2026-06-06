import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function Loading() {
  return (
    <EntityDetailShell
      title="Loading..."
      eyebrow="PORTAL USER"
      back={{ href: '/dashboard/crm/portal', label: 'All users' }}
    >
      <div className="space-y-4">
        <Skeleton className="h-[200px] w-full" />
      </div>
    </EntityDetailShell>
  );
}
