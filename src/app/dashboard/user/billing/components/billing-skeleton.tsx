import React from 'react';

export const BillingSkeleton = () => {
  return (
    <div className="flex flex-col gap-10 w-full animate-pulse">
      {/* Hero Header Area Skeleton */}
      <div className="relative overflow-hidden rounded-2xl bg-[var(--st-bg-muted)] p-8 md:p-10 border border-[var(--st-border)] shadow-sm h-48">
        <div className="h-6 w-32 bg-[var(--st-border)] rounded-full mb-4"></div>
        <div className="h-10 w-64 bg-[var(--st-border)] rounded-lg mb-3"></div>
        <div className="h-6 w-96 bg-[var(--st-border)] rounded-lg"></div>
      </div>

      {/* Current Plan & Wallet Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-8 flex flex-col h-64 bg-[var(--st-bg-muted)] rounded-lg border border-[var(--st-border)]"></div>
        <div className="lg:col-span-4 flex flex-col h-64 bg-[var(--st-bg-muted)] rounded-lg border border-[var(--st-border)]"></div>
      </div>

      <div className="my-4 h-px w-full bg-[var(--st-border)] opacity-50"></div>

      {/* Pricing Tiers Skeleton */}
      <div className="space-y-12 pb-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="h-8 w-64 bg-[var(--st-border)] rounded-lg mx-auto mb-4"></div>
          <div className="h-4 w-96 bg-[var(--st-border)] rounded-lg mx-auto"></div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-6 w-40 bg-[var(--st-border)] rounded-lg"></div>
            <div className="h-px flex-1 bg-[var(--st-border)]"></div>
          </div>
          <div className="flex space-x-6 overflow-hidden">
            <div className="w-[340px] h-96 bg-[var(--st-bg-muted)] rounded-lg border border-[var(--st-border)] shrink-0"></div>
            <div className="w-[340px] h-96 bg-[var(--st-bg-muted)] rounded-lg border border-[var(--st-border)] shrink-0"></div>
            <div className="w-[340px] h-96 bg-[var(--st-bg-muted)] rounded-lg border border-[var(--st-border)] shrink-0"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
