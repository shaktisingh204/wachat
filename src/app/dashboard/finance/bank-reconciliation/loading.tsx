'use client';

import {
  Card,
  CardBody,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div
      className="ui20 flex w-full flex-col gap-4"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Page title block */}
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Bank Reconciliation</PageTitle>
          <PageDescription>Loading reconciliation data.</PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {/* Toolbar placeholders: search + action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-9 w-full max-w-xs" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Table placeholder */}
      <Card padding="none">
        <CardBody>
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-5 shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
