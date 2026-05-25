import { Skeleton } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function StockTransfersLoading() {
  return (
    <EntityListShell
      title="Stock transfers"
      subtitle="Move inventory between warehouses with full audit trail."
      loading={true}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-[100px] w-full" />
          <Skeleton className="h-[100px] w-full" />
          <Skeleton className="h-[100px] w-full" />
          <Skeleton className="h-[100px] w-full" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    </EntityListShell>
  );
}
