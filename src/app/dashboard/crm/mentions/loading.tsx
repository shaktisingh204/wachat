import { Skeleton } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function MentionsLoading() {
  return (
    <EntityListShell
      title="Mentions"
      subtitle="Loading mentions..."
    >
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </EntityListShell>
  );
}
