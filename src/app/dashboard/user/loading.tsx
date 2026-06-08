import { Card, CardHeader, CardBody, CardFooter, Skeleton } from '@/components/sabcrm/20ui';

export default function UserDashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
      {/* header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-[var(--st-radius)]" />
        ))}
      </div>

      {/* identity + security */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-2 h-4 w-40" />
          </CardHeader>
          <CardBody className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-28" />
            </div>
          </CardBody>
          <CardFooter>
            <Skeleton className="h-8 w-28" />
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-2 h-4 w-36" />
          </CardHeader>
          <CardBody className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-[var(--st-radius)]" />
            ))}
          </CardBody>
          <CardFooter>
            <Skeleton className="h-8 w-32" />
          </CardFooter>
        </Card>
      </div>

      {/* workspaces */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-2 h-4 w-36" />
        </CardHeader>
        <CardBody className="space-y-3">
          <Skeleton className="h-12 w-full rounded-[var(--st-radius)]" />
          <Skeleton className="h-8 w-full" />
        </CardBody>
        <CardFooter>
          <Skeleton className="h-8 w-40" />
        </CardFooter>
      </Card>

      {/* business profile */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-2 h-4 w-64" />
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-[var(--st-radius)]" />
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
