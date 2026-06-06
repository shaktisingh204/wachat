import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function Loading() {
  return (
    <EntityDetailShell
      title="Loading..."
      eyebrow="PORTAL ACTIVITY"
      back={{ href: '/dashboard/crm/portal', label: 'All users' }}
    >
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </EntityDetailShell>
  );
}
