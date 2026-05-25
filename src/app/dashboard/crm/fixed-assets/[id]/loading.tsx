import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton } from '@/components/zoruui';

export default function FixedAssetLoading() {
  return (
    <EntityDetailShell
      title={<Skeleton className="h-8 w-48" />}
      back={{ href: '/dashboard/crm/fixed-assets', label: 'Back to Fixed Assets' }}
    >
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </EntityDetailShell>
  );
}
