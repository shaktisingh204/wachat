/**
 * SabCRM root loading skeleton (`/sabcrm`), 20ui.
 *
 * Matches the overview/index layout: page header + grid of object cards.
 * Each card shows a title line, a body block, and a footer chip/count row.
 * Renders inside `layout.tsx`'s `SabcrmSuiteFrame` (which carries the 20ui
 * token scope), so this is pure 20ui — no `.sabcrm-twenty` / `.st-*` classes.
 */

import * as React from 'react';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import { Skeleton } from '@/components/sabcrm/20ui';

export default function SabcrmLoading(): React.JSX.Element {
  return (
    <main
      className="mx-auto w-full max-w-6xl px-6 py-8"
      aria-busy="true"
      aria-label="Loading SabCRM"
    >
      <header className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-[18px] w-[120px]" />
      </header>

      <ul className="m-0 mt-6 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="mt-3 block h-9 w-full" />
              <div className="mt-3 flex items-center gap-2">
                <Skeleton className="h-5 w-[72px]" />
                <Skeleton className="h-[14px] w-14" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
