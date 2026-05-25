'use client';

import React, { useState, useEffect } from 'react';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Input, Select, Button, Alert, ZoruAlertTitle, ZoruAlertDescription, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/zoruui';
import { DocArticle, SortOption, ApiError } from '../lib/types';
import { fetchArticles } from '../lib/mockApi';
import { AlertCircle, Search, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/zoruui';

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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/30 p-4 rounded-lg">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search documentation..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="setup">Setup</SelectItem>
              <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
              <SelectItem value="best-practices">Best Practices</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOption} onValueChange={(val: SortOption) => setSortOption(val)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest First</SelectItem>
              <SelectItem value="date-asc">Oldest First</SelectItem>
              <SelectItem value="title-asc">Title (A-Z)</SelectItem>
              <SelectItem value="title-desc">Title (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Error Loading Articles ({error.code})</ZoruAlertTitle>
          <ZoruAlertDescription className="flex flex-col gap-2">
            <p>{error.message}</p>
            <Button variant="outline" size="sm" onClick={loadArticles} className="w-fit">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </ZoruAlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="overflow-hidden">
              <ZoruCardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/4" />
              </ZoruCardHeader>
              <ZoruCardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </ZoruCardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sortedArticles.length === 0 && !error ? (
            <div className="col-span-2 text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              No articles found matching your criteria.
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
    <Card className="flex flex-col h-full hover:border-primary/50 transition-colors">
      <ZoruCardHeader className="pb-2">
        <div className="flex justify-between items-start mb-1 gap-2">
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary capitalize">
            {article.category.replace('-', ' ')}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formattedDate || '...'}
          </span>
        </div>
        <ZoruCardTitle className="text-lg leading-tight">{article.title}</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent className="flex-1">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {article.content}
        </p>
      </ZoruCardContent>
    </Card>
  );
}
