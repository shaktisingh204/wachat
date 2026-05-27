import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton } from '@/components/zoruui';

export default function EditStockTransferLoading() {
  return (
    <EntityDetailShell
      eyebrow="STOCK TRANSFER"
      title="Loading Transfer..."
      back={{ href: '/dashboard/crm/inventory/stock-transfers', label: 'Back to transfers' }}
    >
      <div className="space-y-6 rounded-lg border border-zoru-line bg-zoru-surface p-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-[150px]" />
          <Skeleton className="h-4 w-[250px]" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-6 border-t border-zoru-line">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </EntityDetailShell>
  );
}
