import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Terminal } from 'lucide-react';

import { FEATURES, FEATURES_BY_CATEGORY } from '@/lib/features/catalog';
import { FEATURE_CATEGORIES } from '@/lib/features/types';
import { FeatureHeader, FeatureFooter } from '@/components/features/FeatureChrome';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sabnode.com';

export const metadata: Metadata = {
  title: 'Features API | SabNode',
  description: 'SabNode Features - Monochrome OpenAPI layout.',
  alternates: { canonical: `${SITE_URL}/features` },
};

export default function FeaturesIndexPage() {
  const totalCount = FEATURES.length;

  return (
    <div className="sn-root relative min-h-screen bg-white text-black font-mono selection:bg-black selection:text-white flex flex-col">
      <FeatureHeader />
      
      <main className="flex-1 flex flex-col lg:flex-row border-y border-black">
        {/* Left Column: Descriptions */}
        <div className="w-full lg:w-[55%] p-6 md:p-12 lg:p-20 overflow-y-auto">
          <div className="mb-20">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase mb-6">
              Features API
            </h1>
            <p className="text-lg leading-relaxed max-w-xl mb-8">
              Explore the entire catalog of SabNode capabilities. Strict monochrome. Zero color. 
              {totalCount} features exposed via this OpenAPI-inspired documentation layout.
            </p>
            <div className="flex gap-4 items-center">
              <Link href="/signup" className="border border-black px-6 py-3 uppercase tracking-widest text-sm font-bold hover:bg-black hover:text-white transition-colors flex items-center gap-2">
                Init Session <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="space-y-24">
            {FEATURE_CATEGORIES.map(cat => {
              const items = FEATURES_BY_CATEGORY[cat.id] ?? [];
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
        </div>

        {/* Right Column: Code Blocks / Interactive */}
        <div className="w-full lg:w-[45%] bg-black text-white p-6 md:p-12 lg:p-20 lg:sticky lg:top-0 lg:h-screen overflow-y-auto border-l border-black">
          <div className="flex items-center gap-3 mb-10 text-white/50 border-b border-white/20 pb-4">
            <Terminal className="w-5 h-5" />
            <span className="uppercase tracking-widest text-xs font-bold">Interactive Output</span>
          </div>

          <div className="space-y-12">
            <div className="font-mono text-sm">
              <div className="text-white/40 mb-2">// GET /api/v1/features/meta</div>
              <pre className="bg-white/5 p-4 border border-white/20 overflow-x-auto">
                <code>
{`{
  "total_features": ${totalCount},
  "categories": ${FEATURE_CATEGORIES.length},
  "status": "operational",
  "theme": "monochrome_strict"
}`}
                </code>
              </pre>
            </div>

            {FEATURE_CATEGORIES.map(cat => {
              const items = FEATURES_BY_CATEGORY[cat.id] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={`code-${cat.id}`} className="font-mono text-sm opacity-80 hover:opacity-100 transition-opacity">
                  <div className="text-white/40 mb-2">// GET /api/v1/features?category={cat.id}</div>
                  <pre className="bg-white/5 p-4 border border-white/20 overflow-x-auto">
                    <code>
{`{
  "category": "${cat.label}",
  "endpoints": [
${items.map(f => `    "/features/${f.slug}"`).join(',\n')}
  ]
}`}
                    </code>
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <FeatureFooter />
    </div>
  );
}
