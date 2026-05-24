'use client';

import { useState, useTransition } from 'react';
import { Button, Card, Input } from '@/components/zoruui';
import { performGlobalSearch } from '@/app/actions/platform/global-search.actions';
import type { GlobalSearchResult } from '@/types/platform';
import { Search, LoaderCircle, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function GlobalSearchPage() {
  const [data, setData] = useState<GlobalSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const limit = 5;

  const handleSearch = (newPage: number = 1) => {
    if (!query) return;
    startTransition(async () => {
      const res = await performGlobalSearch(query, newPage, limit);
      setData(res.data);
      setTotal(res.total);
      setPage(newPage);
      setHasSearched(true);
    });
  };

  const onSearchClick = () => {
    handleSearch(1);
  };

  const handleNextPage = () => {
    if (page * limit < total) {
      handleSearch(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      handleSearch(page - 1);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-8">
      <div className="flex flex-col items-center justify-center space-y-6 pt-12 pb-8">
        <h1 className="text-4xl font-bold text-zoru-ink tracking-tight">Platform Search</h1>
        <p className="text-zoru-ink-light max-w-xl text-center">
          Find anything across CRM, HRM, Organizations, and more instantly.
        </p>
        
        <div className="flex w-full max-w-2xl relative shadow-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zoru-ink-light" />
          <Input 
            className="w-full pl-12 pr-24 py-6 text-lg rounded-full bg-zoru-bg border-zoru-line focus:ring-zoru-accent"
            placeholder="Search deals, contacts, settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchClick()}
          />
          <Button 
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-6"
            onClick={onSearchClick}
            disabled={isPending || !query}
          >
            {isPending ? <LoaderCircle className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {data.map(item => (
          <Link key={item.id} href={item.url} className="block">
            <Card className="p-4 flex items-center justify-between hover:border-zoru-accent transition-colors group cursor-pointer">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-zoru-accent">{item.type}</span>
                </div>
                <h3 className="font-semibold text-lg text-zoru-ink mt-1 group-hover:text-zoru-accent transition-colors">{item.title}</h3>
                <p className="text-zoru-ink-light mt-1">{item.subtitle}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-zoru-ink-light group-hover:text-zoru-accent transition-colors opacity-0 group-hover:opacity-100" />
            </Card>
          </Link>
        ))}
        {data.length === 0 && hasSearched && !isPending && (
          <div className="text-center py-12 text-zoru-ink-light">
            No results found for "{query}". Try searching for an organization name.
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between border-t border-zoru-line pt-4 mt-6">
          <span className="text-sm text-zoru-ink-light">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} results
          </span>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={page === 1 || isPending}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm px-2 text-zoru-ink-light">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={page === totalPages || isPending}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
