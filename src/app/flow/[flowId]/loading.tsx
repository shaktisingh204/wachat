import React from 'react';

import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="20ui min-h-screen flex items-center justify-center bg-[var(--st-bg-secondary)] p-4">
      <div className="w-full max-w-[640px] h-[700px] max-h-[100dvh] flex flex-col overflow-hidden rounded-[var(--st-radius-lg)] shadow-2xl bg-[var(--st-bg)]">
        {/* Header skeleton */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
          <Skeleton circle width={36} />
          <div className="flex flex-col gap-1.5">
            <Skeleton width={96} height={16} />
            <Skeleton width={128} height={12} />
          </div>
        </div>

        {/* Message stream skeleton */}
        <div className="flex-1 px-4 py-6 flex flex-col gap-4">
          <div className="flex justify-start">
            <Skeleton width={192} height={40} radius={16} />
          </div>
          <div className="flex justify-end">
            <Skeleton width={160} height={40} radius={16} />
          </div>
          <div className="flex justify-start">
            <Skeleton width={256} height={64} radius={16} />
          </div>
        </div>

        {/* Input bar skeleton */}
        <div className="shrink-0 flex items-center gap-2.5 border-t border-[var(--st-border)] px-3 py-2.5 bg-[var(--st-bg-muted)]">
          <Skeleton className="flex-1" height={36} radius={6} />
          <Skeleton width={32} height={32} radius={10} />
        </div>
      </div>
    </div>
  );
}
