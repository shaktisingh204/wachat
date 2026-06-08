import * as React from 'react';
import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Card,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function Loading(): React.JSX.Element {
  return (
    <div className="20ui mx-auto flex w-full max-w-[1180px] flex-col gap-[var(--st-space-5)] px-6 py-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Marketing</PageEyebrow>
          <PageTitle>Cart abandonment</PageTitle>
          <PageDescription>
            Track carts customers left behind and follow the value you recover back into revenue.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full" radius={12} />
        ))}
      </div>

      <Card padding="none">
        <div
          className="flex flex-col"
          role="status"
          aria-busy="true"
          aria-live="polite"
          aria-label="Loading abandoned carts"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-[var(--st-border)] px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20" radius={999} />
              <Skeleton className="h-8 w-8" radius={8} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
