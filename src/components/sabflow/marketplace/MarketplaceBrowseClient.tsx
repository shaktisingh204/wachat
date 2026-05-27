'use client';

/**
 * MarketplaceBrowseClient — C.10.5
 *
 * Interactive browse layer for the SabFlow marketplace page.
 *
 * Receives the full (serialised) template list from the server component and
 * handles all filtering, sorting, and pagination client-side.  This keeps the
 * server component thin (auth + Mongo query) while giving instant UI feedback
 * without extra round-trips.
 *
 * Grid:   3-col on desktop  ·  2-col on tablet  ·  1-col on mobile
 * Page:   12 templates per page
 * Sort:   Most Popular (installCount desc)  ·  Newest (publishedAt desc)  ·  A–Z
 * Filter: category + complexity + freetext search (debounced 300 ms)
 */

import * as React from 'react';
import { LuShoppingBag, LuArrowUpDown } from 'react-icons/lu';
import { cn } from '@/lib/utils';
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
  { value: 'az', label: 'A–Z' },
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
    // Registry → filter bucket
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
        <p className="text-[12px] text-zoru-ink">
          {sorted.length === 0
            ? 'No templates found'
            : `${sorted.length} template${sorted.length === 1 ? '' : 's'}`}
        </p>

        <div className="flex items-center gap-2">
          <LuArrowUpDown className="h-3.5 w-3.5 text-zoru-ink flex-shrink-0" />
          <select
            aria-label="Sort templates"
            value={sort}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className={cn(
              'rounded-lg border border-zoru-line bg-zoru-ink py-1.5 pl-2.5 pr-7',
              'text-[12px] text-white outline-none',
              'focus:border-zoru-line focus:ring-2 focus:ring-zoru-line/30',
              'transition-colors cursor-pointer',
            )}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zoru-line py-16 text-center">
          <LuShoppingBag className="h-8 w-8 text-zoru-ink" strokeWidth={1.2} />
          <p className="text-[13px] font-medium text-zoru-ink-muted">No templates match your filters</p>
          <p className="text-[12px] text-zoru-ink">
            Try adjusting or resetting the filters above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((tpl) => (
            <TemplateCard key={tpl.slug} template={tpl} />
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <PaginationButton
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            aria-label="Previous page"
          >
            ‹
          </PaginationButton>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <PaginationButton
              key={p}
              onClick={() => setPage(p)}
              active={p === safePage}
              aria-label={`Page ${p}`}
              aria-current={p === safePage ? 'page' : undefined}
            >
              {p}
            </PaginationButton>
          ))}

          <PaginationButton
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            aria-label="Next page"
          >
            ›
          </PaginationButton>
        </div>
      )}
    </div>
  );
}

/* ── PaginationButton ───────────────────────────────────────────────────── */

function PaginationButton({
  children,
  onClick,
  disabled = false,
  active = false,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  'aria-label'?: string;
  'aria-current'?: 'page' | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border text-[12px] font-medium px-2',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-line',
        active
          ? 'border-zoru-line bg-zoru-ink text-white'
          : 'border-zoru-line bg-zoru-ink text-zoru-ink-muted hover:border-zoru-line hover:text-white',
        disabled && 'pointer-events-none opacity-40',
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
