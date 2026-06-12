/**
 * SabCRM — Sequences route loading skeleton (`/sabcrm/sequences`), 20ui.
 *
 * Mirrors the page layout (header + actions + table rows) so the swap to
 * real content is layout-stable.
 */

import * as React from 'react';

import { Skeleton } from '@/components/sabcrm/20ui';

import '@/components/sabcrm/20ui/surface-crm-base.css';

export default function SabcrmSequencesLoading(): React.JSX.Element {
  return (
    <div
      className="mx-auto w-full max-w-[1040px] px-6 pb-12 pt-6"
      aria-busy="true"
      aria-label="Loading sequences"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
