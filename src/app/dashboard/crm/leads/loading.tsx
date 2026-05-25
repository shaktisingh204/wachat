import { Skeleton } from '@/components/zoruui/skeleton';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function LeadsLoading() {
  return (
    <EntityListShell
      title="Leads"
      subtitle="Loading leads..."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-[250px]" />
          <Skeleton className="h-10 w-[100px]" />
        </div>
        <div className="rounded-md border">
          <div className="border-b p-4">
            <Skeleton className="h-6 w-full" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b p-4 last:border-0">
              <div className="space-y-2">
                <Skeleton className="h-5 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
              <Skeleton className="h-8 w-[100px]" />
            </div>
          ))}
        </div>
      </div>
    </EntityListShell>
  );
}
