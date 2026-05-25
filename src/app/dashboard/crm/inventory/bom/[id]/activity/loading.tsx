import { Skeleton } from '@/components/zoruui/skeleton';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function BomActivityLoading() {
  return (
    <EntityDetailShell
      eyebrow="BOM ACTIVITY"
      title="Activity Loading..."
      back={{ href: '#', label: 'Back to BOM' }}
    >
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-4 border-l-2 border-zoru-line ml-3 pl-6">
          <div className="space-y-2 relative">
            <div className="absolute w-3 h-3 bg-zoru-line rounded-full -left-[1.95rem] top-1" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-2 relative">
            <div className="absolute w-3 h-3 bg-zoru-line rounded-full -left-[1.95rem] top-1" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="space-y-2 relative">
            <div className="absolute w-3 h-3 bg-zoru-line rounded-full -left-[1.95rem] top-1" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </EntityDetailShell>
  );
}
