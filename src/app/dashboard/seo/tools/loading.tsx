import { Card, CardBody } from '@/components/sabcrm/20ui';

export default function SeoToolsLoading() {
  return (
    <div className="flex flex-col gap-6 w-full animate-pulse">
      {/* Title skeleton */}
      <div>
        <div className="h-8 bg-[var(--st-bg-muted)] rounded w-48 mb-2"></div>
        <div className="h-4 bg-[var(--st-bg-muted)] rounded w-3/4 max-w-md"></div>
      </div>

      {/* Main content skeleton */}
      <Card className="border-[var(--st-border)]">
        <CardBody className="p-6 space-y-4">
          <div className="flex gap-4">
            <div className="h-10 bg-[var(--st-bg-muted)] rounded flex-1"></div>
            <div className="h-10 bg-[var(--st-bg-muted)] rounded w-24"></div>
          </div>
          <div className="space-y-2 mt-8">
            <div className="h-4 bg-[var(--st-bg-muted)] rounded w-full"></div>
            <div className="h-4 bg-[var(--st-bg-muted)] rounded w-5/6"></div>
            <div className="h-4 bg-[var(--st-bg-muted)] rounded w-4/6"></div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
