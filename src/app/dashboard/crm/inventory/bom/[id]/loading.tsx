import { Skeleton, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function BomDetailLoading() {
  return (
    <EntityDetailShell
      eyebrow="BILL OF MATERIALS"
      title="Loading..."
      status={{ label: 'Loading', tone: 'neutral' }}
      back={{ href: '/dashboard/crm/inventory/bom', label: 'Back to all BOMs' }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      }
      rightRail={
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Versions / variants</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <div className="px-4 py-3 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Related production orders</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <div className="px-4 py-3 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </CardBody>
          </Card>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Header</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-32" /></div>
              <div className="space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-32" /></div>
              <div className="space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-32" /></div>
              <div className="space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-32" /></div>
              <div className="space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-32" /></div>
              <div className="space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-32" /></div>
            </div>
          </CardBody>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardBody>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Cost rollup</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <div className="space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-24" /></div>
              <div className="space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-24" /></div>
              <div className="space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-24" /></div>
              <div className="space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-24" /></div>
            </div>
          </CardBody>
        </Card>
      </div>
    </EntityDetailShell>
  );
}
