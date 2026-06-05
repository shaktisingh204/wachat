'use client';

import React, { useState, useEffect } from 'react';
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
import { DocArticle, SortOption, ApiError } from '../lib/types';
import { fetchArticles } from '../lib/mockApi';
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
  const [articles, setArticles] = useState<DocArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');

  const loadArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchArticles();
      setArticles(data);
    } catch (err: any) {
      setError({
        message: err?.message || 'Failed to fetch documentation articles',
        code: err?.code || 'UNKNOWN_ERROR',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          article.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || article.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const sortedArticles = [...filteredArticles].sort((a, b) => {
    switch (sortOption) {
      case 'date-desc':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case 'date-asc':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case 'title-asc':
        return a.title.localeCompare(b.title);
      case 'title-desc':
        return b.title.localeCompare(a.title);
      default:
        return 0;
    }
  });

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
            <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={loadArticles} className="w-fit">
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

function ArticleCard({ article }: { article: DocArticle }) {
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
