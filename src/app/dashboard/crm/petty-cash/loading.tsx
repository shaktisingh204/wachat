import { Skeleton } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Loading..."
      subtitle="Fetching petty cash data..."
    >
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </EntityListShell>
  );
}
