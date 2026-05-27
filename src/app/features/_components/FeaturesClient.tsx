'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { FEATURE_CATEGORIES, Feature } from '@/lib/features/types';
import { FEATURES } from '@/lib/features/catalog';
import { FilterBar } from './FilterBar';
import { FeatureList } from './FeatureList';
import { SkeletonList } from './SkeletonList';
import { InteractiveConsole } from './InteractiveConsole';

interface FeaturesApiResponse {
  data: Feature[];
  total: number;
}

// Simulated API Call
async function fetchFeaturesAPI(query: string, category: string, sort: string): Promise<FeaturesApiResponse> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (query.toLowerCase() === 'error') {
        reject(new Error('500 Internal Server Error: Database connection failed.'));
        return;
      }

      let results = [...FEATURES];
      
      if (category && category !== 'all') {
        results = results.filter(f => f.category === category);
      }
      
      if (query) {
        const q = query.toLowerCase();
        results = results.filter(f => 
          f.name.toLowerCase().includes(q) || 
          f.tagline.toLowerCase().includes(q)
        );
      }

      if (sort === 'name-asc') {
        results.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sort === 'name-desc') {
        results.sort((a, b) => b.name.localeCompare(a.name));
      } else {
        // default category sort is already preserved in FEATURES basically, but let's just keep as is
      }

      resolve({
        data: results,
        total: results.length,
      });
    }, 600);
  });
}

export function FeaturesClient() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('default');
  
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeatures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFeaturesAPI(query, category, sort);
      setFeatures(res.data);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred while fetching features.');
    } finally {
      setLoading(false);
    }
  }, [query, category, sort]);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  const totalCount = FEATURES.length;

  return (
    <main className="flex-1 flex flex-col lg:flex-row border-y border-black">
      {/* Left Column */}
      <div className="w-full lg:w-[55%] p-6 md:p-12 lg:p-20 overflow-y-auto">
        <div className="mb-16">
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

        <FilterBar 
          query={query} 
          setQuery={setQuery} 
          category={category} 
          setCategory={setCategory}
          sort={sort}
          setSort={setSort}
        />

        <div className="mt-12 min-h-[400px]">
          {loading ? (
            <SkeletonList />
          ) : error ? (
            <div className="border border-black p-6 bg-zoru-surface-2 text-zoru-ink">
              <div className="flex items-center gap-2 mb-2 font-bold uppercase tracking-widest">
                <AlertTriangle className="w-5 h-5" />
                API Error
              </div>
              <p className="font-mono text-sm mb-4">{error}</p>
              <button 
                onClick={() => loadFeatures()}
                className="border border-zoru-line px-4 py-2 text-xs uppercase tracking-widest font-bold hover:bg-zoru-ink hover:text-white transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-3 h-3" /> Retry Request
              </button>
            </div>
          ) : (
            <FeatureList features={features} />
          )}
        </div>
      </div>

      {/* Right Column: Code Blocks / Interactive */}
      <div className="w-full lg:w-[45%] bg-black text-white p-6 md:p-12 lg:p-20 lg:sticky lg:top-0 lg:h-screen overflow-y-auto border-l border-black">
        <InteractiveConsole 
          activeCategory={category} 
          activeQuery={query}
          isError={!!error}
          isLoading={loading}
          resultCount={features.length}
        />
      </div>
    </main>
  );
}
