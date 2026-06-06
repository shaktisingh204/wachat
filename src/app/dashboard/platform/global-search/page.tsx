export const dynamic = "force-dynamic";
import { Suspense } from 'react';
import { performGlobalSearch } from '@/app/actions/platform/global-search.actions';
import { GlobalSearchClient } from './global-search-client';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function GlobalSearchPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const query = typeof searchParams.q === 'string' ? searchParams.q : '';
  const pageStr = typeof searchParams.page === 'string' ? searchParams.page : '1';
  const page = parseInt(pageStr, 10) || 1;
  const limit = 5;

  let data = [];
  let total = 0;

  if (query) {
    const res = await performGlobalSearch(query, page, limit);
    data = res.data;
    total = res.total;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10">
      <Suspense fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-full max-w-md" />
          <div className="space-y-2 mt-8">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      }>
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
