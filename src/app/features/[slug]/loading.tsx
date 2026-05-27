import React from 'react';
import { Sparkles } from 'lucide-react';

export default function FeatureLoading() {
  return (
    <div className="sn-root relative min-h-screen overflow-x-clip antialiased bg-white text-zoru-ink animate-pulse">
      {/* Header skeleton */}
      <div className="h-16 border-b sn-hair bg-zoru-surface-2 flex items-center px-6">
        <div className="h-6 w-32 bg-zoru-surface-2 rounded"></div>
      </div>
      <div className="h-10 border-b sn-hair bg-zoru-surface-2/50 flex items-center px-6">
        <div className="h-4 w-48 bg-zoru-surface-2 rounded"></div>
      </div>

      <nav aria-label="Breadcrumb" className="container mx-auto px-4 md:px-6 pt-6">
        <div className="flex items-center gap-1.5 h-4 w-64 bg-zoru-surface-2 rounded"></div>
      </nav>

      {/* Hero Skeleton */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6 pt-12 md:pt-16 pb-10 md:pb-16 relative">
          <div className="grid grid-cols-12 gap-6 md:gap-10 items-end">
            <div className="col-span-12 md:col-span-8">
              <div className="h-7 w-32 bg-zoru-surface-2 rounded-md mb-5"></div>
              <div className="h-16 w-3/4 bg-zoru-surface-2 rounded-lg mb-6"></div>
              <div className="h-6 w-full bg-zoru-surface-2 rounded mb-2"></div>
              <div className="h-6 w-5/6 bg-zoru-surface-2 rounded mb-7"></div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl mb-8">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-5 w-full bg-zoru-surface-2 rounded"></div>
                ))}
              </div>

              <div className="flex gap-2.5">
                <div className="h-11 w-32 bg-zoru-surface-2 rounded-full"></div>
                <div className="h-11 w-32 bg-zoru-surface-2 rounded-full"></div>
              </div>
            </div>

            <aside className="col-span-12 md:col-span-4">
              <div className="rounded-2xl p-6 border sn-hair bg-white h-64 flex flex-col items-center justify-center">
                <Sparkles className="h-8 w-8 text-zoru-ink-muted mb-4 animate-spin-slow" />
                <div className="h-4 w-32 bg-zoru-surface-2 rounded"></div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Problem Skeleton */}
      <section className="border-t sn-hair py-14">
        <div className="container mx-auto px-4 md:px-6">
          <div className="h-10 w-64 bg-zoru-surface-2 rounded mb-4"></div>
          <div className="h-4 w-full bg-zoru-surface-2 rounded mb-2"></div>
          <div className="h-4 w-full bg-zoru-surface-2 rounded mb-2"></div>
          <div className="h-4 w-3/4 bg-zoru-surface-2 rounded"></div>
        </div>
      </section>
    </div>
  );
}
