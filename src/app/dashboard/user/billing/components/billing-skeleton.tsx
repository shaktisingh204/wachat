'use client';

import React from 'react';

import { Card, Skeleton } from '@/components/sabcrm/20ui';

export const BillingSkeleton = () => {
  return (
    <div
      className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-[var(--st-space-7)]"
      aria-busy="true"
    >
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton width={220} height={28} radius={8} />
          <Skeleton width={360} height={16} radius={8} />
        </div>
        <div className="flex gap-2">
          <Skeleton width={132} height={36} radius={8} />
          <Skeleton width={132} height={36} radius={8} />
        </div>
      </div>

      {/* Hero stat strip */}
      <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} variant="outlined" padding="none" className="h-[92px]" />
        ))}
      </div>

      {/* Plan details + wallet */}
      <div className="grid grid-cols-1 gap-[var(--st-space-5)] lg:grid-cols-12">
        <Card variant="outlined" padding="none" className="h-64 lg:col-span-7" />
        <Card variant="outlined" padding="none" className="h-64 lg:col-span-5" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton width={200} height={20} radius={8} />
          <Skeleton width={280} height={14} radius={8} />
        </div>
        <div className="flex gap-2">
          <Skeleton width={200} height={36} radius={8} />
          <Skeleton width={180} height={36} radius={8} />
        </div>
      </div>

      {/* Two category rows of cards */}
      {Array.from({ length: 2 }).map((_, row) => (
        <div key={row} className="space-y-3">
          <Skeleton width={160} height={16} radius={8} />
          <div className="flex gap-[var(--st-space-4)] overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} variant="outlined" padding="none" className="h-80 w-[296px] shrink-0" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
