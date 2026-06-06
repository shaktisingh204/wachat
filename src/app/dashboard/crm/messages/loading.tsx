import { Skeleton } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card } from '@/components/sabcrm/20ui';

export default function MessagesLoading() {
  return (
    <EntityListShell
      title="Messages"
      subtitle="Loading messages..."
    >
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <Card className="flex min-h-[480px] items-center justify-center p-6">
          <Skeleton className="h-12 w-12 rounded-full mb-4" />
          <Skeleton className="h-6 w-[200px] mb-2" />
          <Skeleton className="h-4 w-[250px]" />
        </Card>
      </div>
    </EntityListShell>
  );
}
