import { Card, CardBody, CardHeader, Skeleton } from '@/components/sabcrm/20ui';

export default function NewProductionOrderLoading() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-24" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardBody className="space-y-6">
          {/* General Information Section */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-24 w-full" />
            </div>
          </div>

          {/* Dates Section */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-4 mt-6">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
