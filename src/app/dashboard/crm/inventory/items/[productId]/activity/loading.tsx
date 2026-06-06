import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from "@/components/crm/entity-detail-shell";

export default function ActivityLoading() {
  return (
    <EntityDetailShell
      title="Loading..."
      eyebrow="ITEM ACTIVITY"
    >
      <div className="space-y-6 mt-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </EntityDetailShell>
  );
}
