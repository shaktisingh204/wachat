/**
 * SabCRM — Routing route loading skeleton (`/sabcrm/routing`), 20ui.
 *
 * Mirrors the page layout (header + actions + table rows) so the swap to
 * real content is layout-stable.
 */

import * as React from 'react';

import { Skeleton } from '@/components/sabcrm/20ui';

import '@/components/sabcrm/20ui/surface-crm-base.css';

export default function SabcrmRoutingLoading(): React.JSX.Element {
  return (
    <div
      className="mx-auto w-full max-w-[1120px] px-6 pb-12 pt-6"
      aria-busy="true"
      aria-label="Loading routing rules"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
