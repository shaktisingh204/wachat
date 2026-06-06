'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Input,
  Select,
  Button,
  Alert,
  Badge,
  Skeleton,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { SortOption, ApiError } from '../lib/types';
import {
  listSetupKbArticles,
  type SetupKbArticleView,
} from '@/app/actions/wachat-setup-kb.actions';
import { AlertCircle, Search, RefreshCw } from 'lucide-react';

// Custom hook to handle isomorphic dates (preventing hydration mismatch)
function useIsomorphicDate(isoString: string) {
  const [dateStr, setDateStr] = useState<string>('');
  useEffect(() => {
    try {
      const date = new Date(isoString);
      setDateStr(new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date));
    } catch (e) {
      setDateStr(isoString);
    }
  }, [isoString]);
  return dateStr;
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'setup', label: 'Setup' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
  { value: 'best-practices', label: 'Best Practices' },
];

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'title-asc', label: 'Title (A-Z)' },
  { value: 'title-desc', label: 'Title (Z-A)' },
];

export function DocumentationList() {
  const [articles, setArticles] = useState<SetupKbArticleView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');

  // Search / category / sort all run server-side in the Rust KB handler, so the
  // current filter state IS the query. Search is debounced to avoid a request
  // per keystroke.
  const loadArticles = useCallback(
    async (q: string, category: string, sort: SortOption) => {
      setLoading(true);
      setError(null);
      const result = await listSetupKbArticles({ q, category, sort });
      if ('error' in result && result.error) {
        setError({ message: result.error, code: 'KB_FETCH_ERROR' });
        setArticles([]);
      } else {
        setArticles(result.articles ?? []);
      }
      setLoading(false);
    },
    [],
  );

  const reload = useCallback(() => {
    void loadArticles(searchQuery, categoryFilter, sortOption);
  }, [loadArticles, searchQuery, categoryFilter, sortOption]);

  // Re-fetch when category or sort change immediately; debounce the search box.
  useEffect(() => {
    const handle = setTimeout(() => {
      void loadArticles(searchQuery, categoryFilter, sortOption);
    }, 300);
    return () => clearTimeout(handle);
  }, [loadArticles, searchQuery, categoryFilter, sortOption]);

  const sortedArticles = articles;

  return (
    <div className="space-y-6">
      <Card variant="outlined" padding="md">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="w-full sm:max-w-xs">
            <Input
              iconLeft={Search}
              placeholder="Search documentation..."
              aria-label="Search documentation"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-[150px]">
              <Select
                value={categoryFilter}
                onChange={(val) => setCategoryFilter(val ?? 'all')}
                options={CATEGORY_OPTIONS}
                placeholder="Category"
                aria-label="Filter by category"
              />
            </div>
            <div className="w-full sm:w-[150px]">
              <Select
                value={sortOption}
                onChange={(val) => setSortOption((val ?? 'date-desc') as SortOption)}
                options={SORT_OPTIONS}
                placeholder="Sort By"
                aria-label="Sort articles"
              />
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <Alert
          tone="danger"
          icon={AlertCircle}
          title={`Error Loading Articles (${error.code})`}
        >
          <div className="flex flex-col gap-2">
            <p>{error.message}</p>
            <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={reload} className="w-fit">
              Try Again
            </Button>
          </div>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} padding="none" className="overflow-hidden">
              <CardHeader>
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/4" />
              </CardHeader>
              <CardBody>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sortedArticles.length === 0 && !error ? (
            <div className="col-span-2">
              <EmptyState
                icon={Search}
                title="No articles found"
                description="No articles found matching your criteria."
              />
            </div>
          ) : (
            sortedArticles.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article }: { article: SetupKbArticleView }) {
  const formattedDate = useIsomorphicDate(article.updatedAt);

  return (
    <Card padding="none" className="flex flex-col h-full">
      <CardHeader>
        <div className="flex justify-between items-start mb-1 gap-2">
          <Badge tone="neutral" className="capitalize">
            {article.category.replace('-', ' ')}
          </Badge>
          <span
            className="text-xs whitespace-nowrap text-[var(--st-text-secondary)]"
          >
            {formattedDate || '...'}
          </span>
        </div>
        <CardTitle className="text-lg leading-tight">{article.title}</CardTitle>
      </CardHeader>
      <CardBody className="flex-1">
        <p
          className="text-sm line-clamp-3 text-[var(--st-text-secondary)]"
        >
          {article.content}
        </p>
      </CardBody>
    </Card>
  );
}
