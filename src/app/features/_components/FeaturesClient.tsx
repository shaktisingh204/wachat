'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { FEATURE_CATEGORIES, Feature } from '@/lib/features/types';
import { FEATURES } from '@/lib/features/catalog';
import { Button } from '@/components/sabcrm/20ui';
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { Alert } from '@/components/sabcrm/20ui';
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
  const router = useRouter();
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
    <main className="flex-1 flex flex-col lg:flex-row border-y border-[var(--st-border)]">
      {/* Left Column */}
      <div className="w-full lg:w-[55%] p-6 md:p-12 lg:p-20 overflow-y-auto">
        <PageHeader bordered={false} className="mb-16">
          <PageHeaderHeading>
            <PageTitle>Features API</PageTitle>
            <PageDescription>
              Explore the entire catalog of SabNode capabilities. {totalCount} features exposed
              via this OpenAPI-inspired documentation layout.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button
              variant="primary"
              iconRight={ArrowRight}
              onClick={() => router.push('/signup')}
            >
              Init Session
            </Button>
          </PageActions>
        </PageHeader>

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
            <Alert tone="danger" title="API Error">
              <p className="font-mono text-sm mb-4">{error}</p>
              <Button
                variant="danger"
                size="sm"
                iconLeft={RefreshCw}
                onClick={() => loadFeatures()}
              >
                Retry Request
              </Button>
            </Alert>
          ) : (
            <FeatureList features={features} />
          )}
        </div>
      </div>

      {/* Right Column: Code Blocks / Interactive */}
      <div className="w-full lg:w-[45%] bg-[var(--st-text)] text-[var(--st-bg)] p-6 md:p-12 lg:p-20 lg:sticky lg:top-0 lg:h-screen overflow-y-auto border-l border-[var(--st-border)]">
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
