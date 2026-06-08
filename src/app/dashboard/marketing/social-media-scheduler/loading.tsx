import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="20ui flex w-full flex-col gap-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Social Media Posts</PageTitle>
          <PageDescription>Manage your Social Media Posts seamlessly.</PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full sm:w-64" radius={8} />
        <Skeleton className="h-9 w-28" radius={8} />
      </div>

      <div className="space-y-2" aria-busy="true" aria-live="polite">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" radius={8} />
        ))}
      </div>
    </div>
  );
}
