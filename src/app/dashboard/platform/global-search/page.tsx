export const dynamic = "force-dynamic";
import { Suspense } from 'react';
import { performGlobalSearch } from '@/app/actions/platform/global-search.actions';
import { GlobalSearchClient } from './global-search-client';
import { Skeleton } from '@/components/sabcrm/20ui';
import type { GlobalSearchResult } from '@/types/platform';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function GlobalSearchPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const query = typeof searchParams.q === 'string' ? searchParams.q : '';
  const pageStr = typeof searchParams.page === 'string' ? searchParams.page : '1';
  const page = parseInt(pageStr, 10) || 1;
  const limit = 5;

  let data: GlobalSearchResult[] = [];
  let total = 0;

  if (query) {
    const res = await performGlobalSearch(query, page, limit);
    data = res.data;
    total = res.total;
  }

  return (
    <div className="20ui mx-auto w-full max-w-5xl">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton height={32} width={220} radius="var(--st-radius)" />
            <Skeleton height={56} className="w-full" radius="var(--st-radius)" />
            <div className="mt-2 flex flex-col gap-2">
              <Skeleton height={72} className="w-full" radius="var(--st-radius)" />
              <Skeleton height={72} className="w-full" radius="var(--st-radius)" />
              <Skeleton height={72} className="w-full" radius="var(--st-radius)" />
            </div>
          </div>
        }
      >
        <GlobalSearchClient
          initialQuery={query}
          currentPage={page}
          total={total}
          limit={limit}
          data={data}
        />
      </Suspense>
    </div>
  );
}
