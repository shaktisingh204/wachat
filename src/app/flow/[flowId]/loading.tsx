import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gray-2)] p-4">
      <div
        className="w-full flex flex-col overflow-hidden shadow-2xl bg-white"
        style={{
          maxWidth: '640px',
          height: '700px',
          maxHeight: '100dvh',
          borderRadius: '1rem',
        }}
      >
        {/* Header Skeleton */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
          <div className="h-9 w-9 rounded-full bg-[var(--st-bg-muted)] animate-pulse" />
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-24 bg-[var(--st-bg-muted)] rounded animate-pulse" />
            <div className="h-3 w-32 bg-[var(--st-bg-muted)] rounded animate-pulse" />
          </div>
        </div>

        {/* Message Stream Skeleton */}
        <div className="flex-1 px-4 py-6 flex flex-col gap-4">
          <div className="flex justify-start">
            <div className="h-10 w-48 bg-[var(--st-bg-muted)] rounded-2xl rounded-tl-sm animate-pulse" />
          </div>
          <div className="flex justify-end">
            <div className="h-10 w-40 bg-[var(--st-bg-muted)] rounded-2xl rounded-tr-sm animate-pulse" />
          </div>
          <div className="flex justify-start">
            <div className="h-16 w-64 bg-[var(--st-bg-muted)] rounded-2xl rounded-tl-sm animate-pulse" />
          </div>
        </div>

        {/* Input Bar Skeleton */}
        <div className="shrink-0 flex items-center gap-2.5 border-t px-3 py-2.5 bg-[var(--st-bg-muted)] border-[var(--st-border)]">
          <div className="flex-1 h-9 bg-[var(--st-bg-muted)] rounded-md animate-pulse" />
          <div className="h-8 w-8 rounded-xl bg-[var(--st-bg-muted)] animate-pulse shrink-0" />
        </div>
      </div>
    </div>
  );
}
