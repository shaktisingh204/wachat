import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton } from '@/components/zoruui';

export default function EditProductionOrderLoading() {
  return (
    <EntityDetailShell
      eyebrow="PRODUCTION ORDER"
      title="Loading..."
      back={{ href: `/dashboard/crm/inventory/production-orders`, label: 'Back' }}
    >
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </EntityDetailShell>
  );
}
