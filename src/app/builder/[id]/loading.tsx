import React from 'react';

export default function BuilderLoading() {
  return (
    <div className="flex h-screen w-full bg-[var(--st-text)] text-white overflow-hidden">
      {/* Sidebar Skeleton */}
      <div className="w-64 border-r border-[var(--st-border)] bg-[var(--st-text)] flex flex-col p-4 animate-pulse">
        <div className="h-8 w-3/4 bg-[var(--st-text)] rounded mb-8"></div>
        <div className="space-y-4">
          <div className="h-10 w-full bg-[var(--st-text)] rounded"></div>
          <div className="h-10 w-full bg-[var(--st-text)] rounded"></div>
          <div className="h-10 w-full bg-[var(--st-text)] rounded"></div>
          <div className="h-10 w-full bg-[var(--st-text)] rounded"></div>
        </div>
      </div>

      {/* Main Canvas Skeleton */}
      <div className="flex-1 flex flex-col bg-black">
        {/* Topbar Skeleton */}
        <div className="h-14 border-b border-[var(--st-border)] bg-[var(--st-text)]/50 flex items-center justify-between px-6 animate-pulse">
          <div className="h-6 w-32 bg-[var(--st-text)] rounded"></div>
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-[var(--st-text)] rounded"></div>
            <div className="h-8 w-24 bg-[var(--st-text)] rounded"></div>
          </div>
        </div>

        {/* Canvas Area Skeleton */}
        <div className="flex-1 p-8 flex items-center justify-center animate-pulse">
          <div className="w-full max-w-3xl h-[600px] bg-[var(--st-text)]/30 border border-[var(--st-border)] rounded-xl"></div>
        </div>
      </div>
      
      {/* Right Properties Panel Skeleton */}
      <div className="w-80 border-l border-[var(--st-border)] bg-[var(--st-text)] flex flex-col p-6 animate-pulse">
        <div className="h-6 w-1/2 bg-[var(--st-text)] rounded mb-6"></div>
        <div className="space-y-6">
          <div>
            <div className="h-4 w-1/3 bg-[var(--st-text)] rounded mb-2"></div>
            <div className="h-10 w-full bg-[var(--st-text)] rounded"></div>
          </div>
          <div>
            <div className="h-4 w-1/4 bg-[var(--st-text)] rounded mb-2"></div>
            <div className="h-10 w-full bg-[var(--st-text)] rounded"></div>
          </div>
          <div>
            <div className="h-4 w-2/5 bg-[var(--st-text)] rounded mb-2"></div>
            <div className="h-24 w-full bg-[var(--st-text)] rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
