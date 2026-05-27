'use client';

import React from 'react';

export function SkeletonList() {
  return (
    <div className="space-y-16 animate-pulse">
      {[1, 2, 3].map((section) => (
        <section key={section}>
          <div className="border-b border-zoru-line pb-4 mb-8">
            <div className="h-6 w-48 bg-zoru-surface-2 mb-2"></div>
            <div className="h-4 w-96 bg-zoru-surface-2"></div>
          </div>
          
          <div className="space-y-12">
            {[1, 2].map((item) => (
              <div key={item}>
                <div className="flex justify-between mb-2">
                  <div className="h-6 w-32 bg-zoru-surface-2"></div>
                  <div className="h-4 w-16 bg-zoru-surface-2"></div>
                </div>
                <div className="h-4 w-full bg-zoru-surface-2 mb-2"></div>
                <div className="h-4 w-3/4 bg-zoru-surface-2 mb-4"></div>
                <div className="h-4 w-24 bg-zoru-surface-2"></div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
