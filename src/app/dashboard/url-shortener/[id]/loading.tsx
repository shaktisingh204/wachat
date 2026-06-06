import { Card, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/sabcrm/20ui/compat';

export default function LoadingShortUrl() {
  return (
    <div className="flex min-h-full flex-col gap-6 animate-pulse">
      {/* Breadcrumb Skeleton */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <div className="h-4 w-12 bg-[var(--st-hover)] rounded" />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <div className="h-4 w-24 bg-[var(--st-hover)] rounded" />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <div className="h-4 w-16 bg-[var(--st-hover)] rounded" />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Skeleton */}
      <Card className="p-5">
        <div className="flex flex-col gap-3">
          <div className="h-6 w-1/3 bg-[var(--st-hover)] rounded" />
          <div className="h-4 w-1/2 bg-[var(--st-hover)] rounded" />
          <div className="flex gap-4 mt-2">
            <div className="h-4 w-24 bg-[var(--st-hover)] rounded" />
            <div className="h-4 w-24 bg-[var(--st-hover)] rounded" />
          </div>
        </div>
      </Card>

      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5 h-[100px]">
            <div className="h-4 w-20 bg-[var(--st-hover)] rounded mb-2" />
            <div className="h-8 w-16 bg-[var(--st-hover)] rounded" />
          </Card>
        ))}
      </div>

      {/* Tabs Skeleton */}
      <Card className="p-5 h-[400px]">
        <div className="flex gap-4 border-b border-[var(--st-border)] pb-4 mb-4">
          <div className="h-6 w-20 bg-[var(--st-hover)] rounded" />
          <div className="h-6 w-20 bg-[var(--st-hover)] rounded" />
          <div className="h-6 w-20 bg-[var(--st-hover)] rounded" />
        </div>
        <div className="h-full w-full bg-[var(--st-hover)] rounded" />
      </Card>
    </div>
  );
}
