'use client';

/**
 * MarketplaceFilters — C.10.5
 *
 * Category + complexity filter chips, a debounced search input, and a
 * "Reset filters" link.  Fully controlled: all state lives in the parent
 * (`MarketplaceBrowseClient`) and is passed down via props so the page URL
 * can remain the single source of truth.
 *
 * No external UI library — Tailwind only, dark-theme matching the SabFlow
 * editor palette.
 */

import * as React from 'react';
import { LuSearch, LuX } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ──────────────────────────────────────────────────────────────── */

export type MarketplaceCategory =
  | 'All'
  | 'Data'
  | 'Communication'
  | 'DevOps'
  | 'Finance'
  | 'Productivity';

export type MarketplaceComplexity = 'All' | 'Starter' | 'Intermediate' | 'Advanced';

export interface MarketplaceFilterState {
  category: MarketplaceCategory;
  complexity: MarketplaceComplexity;
  search: string;
}

interface Props {
  value: MarketplaceFilterState;
  onChange: (next: MarketplaceFilterState) => void;
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const CATEGORIES: MarketplaceCategory[] = [
  'All',
  'Data',
  'Communication',
  'DevOps',
  'Finance',
  'Productivity',
];

const COMPLEXITIES: MarketplaceComplexity[] = ['All', 'Starter', 'Intermediate', 'Advanced'];

const COMPLEXITY_COLOURS: Record<MarketplaceComplexity, string> = {
  All: '',
  Starter:
    'data-[active=true]:border-[var(--st-border)] data-[active=true]:bg-[var(--st-text)]/40 data-[active=true]:text-[var(--st-text-secondary)]',
  Intermediate:
    'data-[active=true]:border-[var(--st-border)] data-[active=true]:bg-[var(--st-text)]/40 data-[active=true]:text-[var(--st-text-secondary)]',
  Advanced:
    'data-[active=true]:border-[var(--st-border)] data-[active=true]:bg-[var(--st-text)]/40 data-[active=true]:text-[var(--st-text-secondary)]',
};

const DEBOUNCE_MS = 300;

/* ── MarketplaceFilters ─────────────────────────────────────────────────── */

export function MarketplaceFilters({ value, onChange }: Props) {
  /* Local state for the raw input so we can debounce before propagating */
  const [rawSearch, setRawSearch] = React.useState(value.search);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Keep local search in sync if the parent resets it */
  React.useEffect(() => {
    setRawSearch(value.search);
  }, [value.search]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setRawSearch(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ ...value, search: next });
    }, DEBOUNCE_MS);
  };

  const clearSearch = () => {
    setRawSearch('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange({ ...value, search: '' });
  };

  const setCategory = (cat: MarketplaceCategory) =>
    onChange({ ...value, category: cat });

  const setComplexity = (cmp: MarketplaceComplexity) =>
    onChange({ ...value, complexity: cmp });

  const isDirty =
    value.category !== 'All' || value.complexity !== 'All' || value.search.trim() !== '';

  const reset = () => {
    setRawSearch('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange({ category: 'All', complexity: 'All', search: '' });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="relative">
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text)]" />
        <input
          type="search"
          aria-label="Search templates"
          placeholder="Search templates…"
          value={rawSearch}
          onChange={handleSearchChange}
          className={cn(
            'w-full rounded-xl border border-[var(--st-border)] bg-[var(--st-text)] py-2.5 pl-9 pr-9',
            'text-[13px] text-white placeholder-[var(--st-text)]',
            'outline-none transition-colors',
            'focus:border-[var(--st-border)] focus:ring-2 focus:ring-[var(--st-border)]/30',
          )}
        />
        {rawSearch && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--st-text)] hover:text-[var(--st-text-secondary)] transition-colors"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Category chips ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Category filter">
        {CATEGORIES.map((cat) => {
          const isActive = value.category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              data-active={isActive}
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium',
                'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)]',
                isActive
                  ? 'border-[var(--st-border)] bg-[var(--st-text)] text-white'
                  : 'border-[var(--st-border)] bg-[var(--st-text)] text-[var(--st-text-secondary)] hover:border-[var(--st-border)] hover:text-white',
              )}
              aria-pressed={isActive}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* ── Complexity chips ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Complexity filter">
        <span className="text-[11px] font-medium text-[var(--st-text)] mr-1">Complexity:</span>
        {COMPLEXITIES.map((cmp) => {
          const isActive = value.complexity === cmp;
          const colourClass = COMPLEXITY_COLOURS[cmp];
          return (
            <button
              key={cmp}
              type="button"
              onClick={() => setComplexity(cmp)}
              data-active={isActive}
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium',
                'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)]',
                isActive
                  ? cn('border-[var(--st-border)] bg-[var(--st-text)] text-white', colourClass)
                  : 'border-[var(--st-border)] bg-[var(--st-text)] text-[var(--st-text-secondary)] hover:border-[var(--st-border)] hover:text-white',
              )}
              aria-pressed={isActive}
            >
              {cmp}
            </button>
          );
        })}
      </div>

      {/* ── Reset ───────────────────────────────────────────────────────────── */}
      {isDirty && (
        <div>
          <button
            type="button"
            onClick={reset}
            className="text-[11px] text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-white transition-colors"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
