import { PageHeader, PageHeading, PageTitle, PageDescription } from '@/components/sabcrm/20ui/compat';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function SabFlowLoading() {
  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      <PageHeader bordered={false}>
        <PageHeading>
          <PageTitle>Overview</PageTitle>
          <PageDescription>
            Monitor your Sabflow executions, active workflows, and system health.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 w-full lg:col-span-2" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
