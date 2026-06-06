'use client';

import {
  Card,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
} from '@/components/sabcrm/20ui';

/**
 * Loading skeleton for the Vendor Portal list page.
 * Pure 20ui: PageHeader chrome plus a Card-wrapped row skeleton that mirrors
 * the shape of the table that is about to appear.
 */
export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-4 p-4" aria-busy="true" aria-live="polite">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Vendor Portal</PageTitle>
        </PageHeaderHeading>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-64" radius="var(--st-radius)" />
          <Skeleton className="h-9 w-32" radius="var(--st-radius)" />
        </div>
      </PageHeader>

      <Card className="p-2">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" radius="var(--st-radius)" />
          ))}
        </div>
      </Card>
    </div>
  );
}
