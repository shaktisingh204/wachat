'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Field,
  Input,
  Card,
  CardBody,
  Badge,
  EmptyState,
  Skeleton,
  Pagination,
} from '@/components/sabcrm/20ui';
import { ArrowRight, Search, SearchX } from 'lucide-react';
import type { GlobalSearchResult } from '@/types/platform';

export function GlobalSearchClient({
  initialQuery,
  currentPage,
  total,
  limit,
  data,
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

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const firstResult = total > 0 ? (currentPage - 1) * limit + 1 : 0;
  const lastResult = Math.min(currentPage * limit, total);

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Platform Search</PageTitle>
          <PageDescription>
            Find anything across CRM, HRM, Organizations, and more instantly.
          </PageDescription>
        </PageHeaderHeading>
        <div className="w-full sm:w-72">
          <Field label="Search" className="[&_.u-field__label]:sr-only">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search deals, contacts, settings..."
              iconLeft={Search}
            />
          </Field>
        </div>
      </PageHeader>

      {isPending ? (
        <div className="space-y-2" aria-live="polite" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card className="flex min-h-[240px] items-center justify-center">
          <EmptyState
            icon={SearchX}
            title={initialQuery ? `No results for "${initialQuery}"` : 'Start a search'}
            description={
              initialQuery
                ? 'Try searching for something else.'
                : 'Enter a search term to begin.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <Link key={item.id} href={item.url} className="group block no-underline">
              <Card variant="interactive" padding="none">
                <CardBody className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Badge tone="accent" kind="soft" className="uppercase tracking-wider">
                      {item.type}
                    </Badge>
                    <h3 className="mt-2 truncate text-lg font-semibold text-[var(--st-text)] transition-colors group-hover:text-[var(--st-accent)]">
                      {item.title}
                    </h3>
                    <p className="mt-1 truncate text-sm text-[var(--st-text-secondary)]">
                      {item.subtitle}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-5 w-5 shrink-0 text-[var(--st-text-tertiary)] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-[var(--st-accent)] group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {total > 0 ? (
        <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
          <span className="text-sm text-[var(--st-text-secondary)]">
            Showing {firstResult} to {lastResult} of {total} results
          </span>
          <Pagination
            page={currentPage}
            pageCount={totalPages}
            onPageChange={(p) => handleSearch(query, p)}
          />
        </div>
      ) : null}
    </div>
  );
}
