'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card, Button } from '@/components/sabcrm/20ui/compat';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { GlobalSearchResult } from '@/types/platform';

export function GlobalSearchClient({ 
  initialQuery, 
  currentPage, 
  total, 
  limit, 
  data 
}: { 
  initialQuery: string; 
  currentPage: number; 
  total: number; 
  limit: number; 
  data: GlobalSearchResult[]; 
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query !== initialQuery) {
        handleSearch(query, 1);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [query, initialQuery]);

  const handleSearch = (q: string, p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (q) {
      params.set('q', q);
      params.set('page', p.toString());
    } else {
      params.delete('q');
      params.delete('page');
    }
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <EntityListShell
      title="Platform Search"
      subtitle="Find anything across CRM, HRM, Organizations, and more instantly."
      search={{
        value: query,
        onChange: setQuery,
        placeholder: 'Search deals, contacts, settings...',
      }}
      loading={isPending}
      empty={
        data.length === 0 ? (
          initialQuery ? (
            <div className="text-center py-12 text-[var(--st-text-tertiary)]">
              No results found for "{initialQuery}". Try searching for something else.
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--st-text-tertiary)]">
              Enter a search term to begin.
            </div>
          )
        ) : null
      }
      pagination={
        total > 0 ? (
          <div className="flex items-center justify-between pt-4 mt-6">
            <span className="text-sm text-[var(--st-text-tertiary)]">
              Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, total)} of {total} results
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSearch(query, currentPage - 1)}
                disabled={currentPage <= 1 || isPending}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm px-2 text-[var(--st-text-tertiary)]">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSearch(query, currentPage + 1)}
                disabled={currentPage >= totalPages || isPending}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      {data.length > 0 && (
        <div className="space-y-4">
          {data.map(item => (
            <Link key={item.id} href={item.url} className="block">
              <Card className="p-4 flex items-center justify-between hover:border-[var(--st-accent)] transition-colors group cursor-pointer shadow-none">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs uppercase font-bold tracking-wider text-[var(--st-accent)]">{item.type}</span>
                  </div>
                  <h3 className="font-semibold text-lg text-[var(--st-text)] mt-1 group-hover:text-[var(--st-accent)] transition-colors">{item.title}</h3>
                  <p className="text-[var(--st-text-tertiary)] mt-1">{item.subtitle}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--st-text-tertiary)] group-hover:text-[var(--st-accent)] transition-colors opacity-0 group-hover:opacity-100" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </EntityListShell>
  );
}
