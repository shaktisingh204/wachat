'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Feature } from '@/lib/features/types';
import { FEATURE_CATEGORIES } from '@/lib/features/types';

export function FeatureList({ features }: { features: Feature[] }) {
  if (features.length === 0) {
    return (
      <div className="text-center py-20 border border-black border-dashed">
        <p className="uppercase tracking-widest text-sm font-bold opacity-50">
          No features found matching the criteria.
        </p>
      </div>
    );
  }

  // Group by category to maintain structure, unless it's just a raw list.
  // We'll maintain the category grouping for better readability.
  const grouped = features.reduce((acc, f) => {
    (acc[f.category] ||= []).push(f);
    return acc;
  }, {} as Record<string, Feature[]>);

  return (
    <div className="space-y-24">
      {FEATURE_CATEGORIES.map(cat => {
        const items = grouped[cat.id] ?? [];
        if (items.length === 0) return null;
        return (
          <section key={cat.id} id={cat.id} className="scroll-mt-32">
            <div className="border-b border-black pb-4 mb-8">
              <h2 className="text-2xl font-bold uppercase tracking-widest">
                {cat.label}
              </h2>
              <p className="text-sm mt-2 opacity-70">
                {cat.blurb}
              </p>
            </div>

            <div className="space-y-12">
              {items.map(f => (
                <div key={f.slug} id={`feat-${f.slug}`} className="group">
                  <div className="flex items-baseline justify-between mb-2">
                    <Link href={`/features/${f.slug}`} className="text-xl font-bold hover:underline decoration-2 underline-offset-4">
                      {f.name}
                    </Link>
                    {f.brand && (
                      <span className="text-xs border border-black px-2 py-0.5 uppercase tracking-wider">
                        {f.brand}
                      </span>
                    )}
                  </div>
                  <p className="text-base leading-relaxed mb-4">
                    {f.tagline}
                  </p>
                  <Link href={`/features/${f.slug}`} className="text-xs uppercase tracking-widest font-bold border-b border-black pb-0.5 hover:opacity-50 transition-opacity">
                    View details &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
