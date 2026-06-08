'use client';

import React from 'react';

import { Card, Skeleton } from '@/components/sabcrm/20ui';

export const BillingSkeleton = () => {
  return (
    <div className="20ui flex flex-col gap-10 w-full" aria-busy="true">
      {/* Hero header area skeleton */}
      <Card variant="elevated" padding="lg" className="relative overflow-hidden h-48">
        <Skeleton width={128} height={24} radius={999} className="mb-4" />
        <Skeleton width={256} height={40} radius={8} className="mb-3" />
        <Skeleton width={384} height={24} radius={8} />
      </Card>

      {/* Current plan and wallet grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <Card variant="outlined" padding="none" className="lg:col-span-8 h-64" />
        <Card variant="outlined" padding="none" className="lg:col-span-4 h-64" />
      </div>

      <div className="my-4 h-px w-full bg-[var(--st-border)] opacity-50" />

      {/* Pricing tiers skeleton */}
      <div className="space-y-12 pb-12">
        <div className="text-center max-w-2xl mx-auto mb-10 flex flex-col items-center">
          <Skeleton width={256} height={32} radius={8} className="mb-4" />
          <Skeleton width={384} height={16} radius={8} />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton width={160} height={24} radius={8} />
            <div className="h-px flex-1 bg-[var(--st-border)]" />
          </div>
          <div className="flex space-x-6 overflow-hidden">
            <Card variant="outlined" padding="none" className="w-[340px] h-96 shrink-0" />
            <Card variant="outlined" padding="none" className="w-[340px] h-96 shrink-0" />
            <Card variant="outlined" padding="none" className="w-[340px] h-96 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
};
