'use client';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Skeleton,
} from '@/components/sabcrm/20ui';

/**
 * Route-level loading fallback for the Asset Depreciation list. Pure 20ui:
 * a PageHeader title block plus shimmer rows that mirror the table about to
 * load. The skeleton region announces its busy state to assistive tech.
 */
export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Asset Depreciation</PageTitle>
          <PageDescription>
            Track assets and their depreciation over time.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Skeleton width={128} height={36} radius={8} />
        </PageActions>
      </PageHeader>

      <div
        className="flex flex-col gap-2"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading assets"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="w-full" height={48} radius={8} />
        ))}
      </div>
    </div>
  );
}
