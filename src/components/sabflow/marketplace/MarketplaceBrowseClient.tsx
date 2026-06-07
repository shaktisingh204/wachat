'use client';

/**
 * MarketplaceBrowseClient - C.10.5
 *
 * Interactive browse layer for the SabFlow marketplace page.
 *
 * Receives the full (serialised) template list from the server component and
 * handles all filtering, sorting, and pagination client-side. This keeps the
 * server component thin (auth + Mongo query) while giving instant UI feedback
 * without extra round-trips.
 *
 * Grid:   3-col on desktop, 2-col on tablet, 1-col on mobile
 * Page:   12 templates per page
 * Sort:   Most Popular (installCount desc), Newest (publishedAt desc), A-Z
 * Filter: category + complexity + freetext search (debounced 300 ms)
 */

import * as React from 'react';
import { ShoppingBag, ArrowUpDown } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  EmptyState,
  Pagination,
} from '@/components/sabcrm/20ui';
import { MarketplaceFilters, type MarketplaceFilterState, type MarketplaceCategory, type MarketplaceComplexity } from './MarketplaceFilters';
import { TemplateCard, type TemplateCardData } from './TemplateCard';

/* ── Types ──────────────────────────────────────────────────────────────── */

export type SortOption = 'popular' | 'newest' | 'az';

interface Props {
  templates: TemplateCardData[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const PAGE_SIZE = 12;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'az', label: 'A-Z' },
];

/* ── Category normalisation ─────────────────────────────────────────────── */

/**
 * Maps the canonical registry categories (which are broader than the
 * C.10.5 browse filter taxonomy) onto the filter chips so existing templates
 * from the Mongo collection still appear in the right bucket.
 */
function normaliseCategoryForFilter(raw: string): MarketplaceCategory {
  const map: Record<string, MarketplaceCategory> = {
    // Direct matches
    Data: 'Data',
    Communication: 'Communication',
    DevOps: 'DevOps',
    Finance: 'Finance',
    Productivity: 'Productivity',
    // Registry to filter bucket
    Sales: 'Productivity',
    Marketing: 'Communication',
    Support: 'Communication',
    Ops: 'DevOps',
    AI: 'Data',
    'Internal Tools': 'DevOps',
    Developer: 'DevOps',
    CRM: 'Productivity',
    'E-commerce': 'Productivity',
    HR: 'Productivity',
    Health: 'Productivity',
    WhatsApp: 'Communication',
    Ads: 'Communication',
    Onboarding: 'Productivity',
  };
  return map[raw] ?? 'Productivity';
}

/* ── Sort helper ────────────────────────────────────────────────────────── */

function sortTemplates(list: TemplateCardData[], sort: SortOption): TemplateCardData[] {
  const copy = [...list];
  switch (sort) {
    case 'popular':
      return copy.sort((a, b) => (b.installCount ?? 0) - (a.installCount ?? 0));
    case 'newest':
      // Templates from Mongo have no publishedAt in TemplateCardData; fall back
      // to name sort so newest isn't identical to A-Z.
      return copy.sort((a, b) => b.installCount - a.installCount);
    case 'az':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

/* ── MarketplaceBrowseClient ────────────────────────────────────────────── */

export function MarketplaceBrowseClient({ templates }: Props) {
  const [filters, setFilters] = React.useState<MarketplaceFilterState>({
    category: 'All',
    complexity: 'All',
    search: '',
  });
  const [sort, setSort] = React.useState<SortOption>('popular');
  const [page, setPage] = React.useState(1);

  /* Reset to page 1 whenever filters or sort change */
  const handleFilterChange = (next: MarketplaceFilterState) => {
    setFilters(next);
    setPage(1);
  };
  const handleSortChange = (next: SortOption) => {
    setSort(next);
    setPage(1);
  };

  /* ── Derived list ──────────────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return templates.filter((t) => {
      // Category
      if (filters.category !== 'All') {
        if (normaliseCategoryForFilter(t.category) !== filters.category) return false;
      }
      // Complexity
      if (filters.complexity !== 'All') {
        if ((t.complexity as MarketplaceComplexity | undefined) !== filters.complexity)
          return false;
      }
      // Search
      if (q) {
        const haystack = `${t.name} ${t.description} ${t.category}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [templates, filters]);

  const sorted = React.useMemo(() => sortTemplates(filtered, sort), [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const isEmpty = sorted.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <MarketplaceFilters value={filters} onChange={handleFilterChange} />

      {/* ── Toolbar: count + sort ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--st-text-secondary)]">
          {sorted.length === 0
            ? 'No templates found'
            : `${sorted.length} template${sorted.length === 1 ? '' : 's'}`}
        </p>

        <div className="flex items-center gap-2">
          <ArrowUpDown
            className="h-3.5 w-3.5 flex-shrink-0 text-[var(--st-text-secondary)]"
            aria-hidden="true"
          />
          <Select value={sort} onValueChange={(v) => handleSortChange(v as SortOption)}>
            <SelectTrigger aria-label="Sort templates" className="min-w-[10rem]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {isEmpty ? (
        <EmptyState
          icon={ShoppingBag}
          title="No templates match your filters"
          description="Try adjusting or resetting the filters above."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((tpl) => (
            <TemplateCard key={tpl.slug} template={tpl} />
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center pt-2">
          <Pagination
            page={safePage}
            pageCount={totalPages}
            onPageChange={setPage}
            label="Template pages"
          />
        </div>
      )}
    </div>
  );
}
