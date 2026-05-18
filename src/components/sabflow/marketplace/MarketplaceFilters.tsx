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
    'data-[active=true]:border-emerald-500 data-[active=true]:bg-emerald-950/40 data-[active=true]:text-emerald-300',
  Intermediate:
    'data-[active=true]:border-amber-500 data-[active=true]:bg-amber-950/40 data-[active=true]:text-amber-300',
  Advanced:
    'data-[active=true]:border-rose-500 data-[active=true]:bg-rose-950/40 data-[active=true]:text-rose-300',
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
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          aria-label="Search templates"
          placeholder="Search templates…"
          value={rawSearch}
          onChange={handleSearchChange}
          className={cn(
            'w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pl-9 pr-9',
            'text-[13px] text-zinc-100 placeholder-zinc-500',
            'outline-none transition-colors',
            'focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30',
          )}
        />
        {rawSearch && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
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
                'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500',
                isActive
                  ? 'border-zinc-400 bg-zinc-700 text-zinc-100'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
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
        <span className="text-[11px] font-medium text-zinc-500 mr-1">Complexity:</span>
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
                'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500',
                isActive
                  ? cn('border-zinc-400 bg-zinc-700 text-zinc-100', colourClass)
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
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
            className="text-[11px] text-zinc-400 underline underline-offset-2 hover:text-zinc-200 transition-colors"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
