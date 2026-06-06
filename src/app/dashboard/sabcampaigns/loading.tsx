import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function DripCampaignsLoading() {
  return (
    <EntityListShell
      title="Drip Campaigns"
      subtitle="Manage your Drip Campaigns seamlessly."
    >
      <div className="rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-[250px]" />
            <Skeleton className="h-10 w-[100px]" />
          </div>
          <div className="rounded-md border">
            <div className="h-12 border-b px-4 py-3">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <div className="flex w-1/4 justify-end space-x-2">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </EntityListShell>
  );
}
