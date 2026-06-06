import { Skeleton, Card } from '@/components/sabcrm/20ui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function NewFixedAssetLoading() {
  return (
    <EntityDetailShell
      eyebrow="FIXED ASSET"
      title="New fixed asset"
      back={{ href: '/dashboard/crm/fixed-assets', label: 'Fixed Assets' }}
    >
      <div className="space-y-6">
        <Card className="p-6">
          <Skeleton className="h-4 w-24 mb-4" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <Skeleton className="h-4 w-24 mb-4" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </Card>
      </div>
    </EntityDetailShell>
  );
}
