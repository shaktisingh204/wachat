import {
  Card,
  Skeleton,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
} from '@/components/sabcrm/20ui';

export default function LoadingShortUrl() {
  return (
    <div className="flex min-h-full flex-col gap-6">
      {/* Breadcrumb Skeleton */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <Skeleton width={48} height={16} radius={4} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Skeleton width={96} height={16} radius={4} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Skeleton width={64} height={16} radius={4} />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Skeleton */}
      <Card>
        <div className="flex flex-col gap-3">
          <Skeleton width="33%" height={24} radius={4} />
          <Skeleton width="50%" height={16} radius={4} />
          <div className="mt-2 flex gap-4">
            <Skeleton width={96} height={16} radius={4} />
            <Skeleton width={96} height={16} radius={4} />
          </div>
        </div>
      </Card>

      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="flex flex-col gap-2">
            <Skeleton width={80} height={16} radius={4} />
            <Skeleton width={64} height={32} radius={4} />
          </Card>
        ))}
      </div>

      {/* Tabs Skeleton */}
      <Card>
        <div className="mb-4 flex gap-4 border-b border-[var(--st-border)] pb-4">
          <Skeleton width={80} height={24} radius={4} />
          <Skeleton width={80} height={24} radius={4} />
          <Skeleton width={80} height={24} radius={4} />
        </div>
        <Skeleton width="100%" height={320} radius={6} />
      </Card>
    </div>
  );
}
