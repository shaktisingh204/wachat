import { Card, CardBody, CardFooter, CardHeader, Skeleton } from '@/components/sabcrm/20ui';

function FormCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-4 w-56" />
      </CardHeader>
      <CardBody className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </CardBody>
      <CardFooter>
        <Skeleton className="h-9 w-32" />
      </CardFooter>
    </Card>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-full sm:w-64" />
      </div>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <FormCardSkeleton rows={4} />
        <FormCardSkeleton rows={3} />
      </div>

      <FormCardSkeleton rows={3} />
    </div>
  );
}
