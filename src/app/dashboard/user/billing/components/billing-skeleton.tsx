'use client';

import React from 'react';

import { Card, Skeleton } from '@/components/sabcrm/20ui';

export const BillingSkeleton = () => {
  return (
    <div className="20ui flex flex-col gap-[var(--st-space-7)]" aria-busy="true">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton width={220} height={28} radius={8} />
        <Skeleton width={360} height={16} radius={8} />
      </div>

      {/* Current plan + wallet */}
      <div className="grid grid-cols-1 gap-[var(--st-space-5)] lg:grid-cols-12">
        <Card variant="outlined" padding="none" className="lg:col-span-8 h-56" />
        <Card variant="outlined" padding="none" className="lg:col-span-4 h-56" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton width={220} height={36} radius={8} />
        <div className="flex gap-2">
          <Skeleton width={200} height={36} radius={8} />
          <Skeleton width={180} height={36} radius={8} />
        </div>
      </div>

      {/* One category row of cards */}
      <div className="space-y-3">
        <Skeleton width={140} height={16} radius={8} />
        <div className="flex gap-[var(--st-space-4)] overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} variant="outlined" padding="none" className="h-80 w-[300px] shrink-0" />
          ))}
        </div>
      </div>
    </div>
  );
};
