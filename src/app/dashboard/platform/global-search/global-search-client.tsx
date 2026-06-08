'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query !== initialQuery) {
        handleSearch(query, 1);
      }
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform</PageEyebrow>
          <PageTitle>Platform search</PageTitle>
          <PageDescription>
            Find anything across CRM, HRM, organizations, and settings instantly.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card padding="md">
        <Field label="Search the platform" className="[&_.u-field__label]:sr-only">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deals, contacts, settings…"
            iconLeft={Search}
            autoFocus
          />
        </Field>
        {initialQuery && total > 0 ? (
          <p className="mt-3 text-sm text-[var(--st-text-secondary)]">
            <strong className="text-[var(--st-text)]">{total}</strong> result
            {total === 1 ? '' : 's'} for{' '}
            <span className="font-medium text-[var(--st-text)]">"{initialQuery}"</span>
          </p>
        ) : null}
      </Card>

      {isPending ? (
        <div className="space-y-2" aria-live="polite" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full" radius="var(--st-radius)" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card className="flex min-h-[240px] items-center justify-center">
          <EmptyState
            icon={SearchX}
            title={initialQuery ? `No results for "${initialQuery}"` : 'Start a search'}
            description={
              initialQuery
                ? 'Try a different term or check your spelling.'
                : 'Enter a search term above to look across every module.'
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
                    <Badge tone="accent" kind="soft" className="uppercase tracking-wide">
                      {item.type}
                    </Badge>
                    <h3 className="mt-2 truncate text-base font-semibold text-[var(--st-text)] transition-colors group-hover:text-[var(--st-accent)]">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 truncate text-sm text-[var(--st-text-secondary)]">
                      {item.subtitle}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-5 w-5 shrink-0 text-[var(--st-text-tertiary)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--st-accent)]"
                    aria-hidden="true"
                  />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {total > 0 ? (
        <div className="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row">
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
