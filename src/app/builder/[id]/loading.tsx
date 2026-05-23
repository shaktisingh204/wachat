import React from 'react';

export default function BuilderLoading() {
  return (
    <div className="flex h-screen w-full bg-zinc-950 text-white overflow-hidden">
      {/* Sidebar Skeleton */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-900 flex flex-col p-4 animate-pulse">
        <div className="h-8 w-3/4 bg-zinc-800 rounded mb-8"></div>
        <div className="space-y-4">
          <div className="h-10 w-full bg-zinc-800 rounded"></div>
          <div className="h-10 w-full bg-zinc-800 rounded"></div>
          <div className="h-10 w-full bg-zinc-800 rounded"></div>
          <div className="h-10 w-full bg-zinc-800 rounded"></div>
        </div>
      </div>

      {/* Main Canvas Skeleton */}
      <div className="flex-1 flex flex-col bg-black">
        {/* Topbar Skeleton */}
        <div className="h-14 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6 animate-pulse">
          <div className="h-6 w-32 bg-zinc-800 rounded"></div>
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-zinc-800 rounded"></div>
            <div className="h-8 w-24 bg-zinc-800 rounded"></div>
          </div>
        </div>

        {/* Canvas Area Skeleton */}
        <div className="flex-1 p-8 flex items-center justify-center animate-pulse">
          <div className="w-full max-w-3xl h-[600px] bg-zinc-900/30 border border-zinc-800 rounded-xl"></div>
        </div>
      </div>
      
      {/* Right Properties Panel Skeleton */}
      <div className="w-80 border-l border-zinc-800 bg-zinc-900 flex flex-col p-6 animate-pulse">
        <div className="h-6 w-1/2 bg-zinc-800 rounded mb-6"></div>
        <div className="space-y-6">
          <div>
            <div className="h-4 w-1/3 bg-zinc-800 rounded mb-2"></div>
            <div className="h-10 w-full bg-zinc-800 rounded"></div>
          </div>
          <div>
            <div className="h-4 w-1/4 bg-zinc-800 rounded mb-2"></div>
            <div className="h-10 w-full bg-zinc-800 rounded"></div>
          </div>
          <div>
            <div className="h-4 w-2/5 bg-zinc-800 rounded mb-2"></div>
            <div className="h-24 w-full bg-zinc-800 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
