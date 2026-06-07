'use client';

/**
 * MarketplaceFilters - C.10.5
 *
 * Category + complexity segmented filters, a debounced search input, and a
 * "Reset filters" action. Fully controlled: all state lives in the parent
 * (`MarketplaceBrowseClient`) and is passed down via props so the page URL
 * can remain the single source of truth.
 *
 * Built entirely on the 20ui design system.
 */

import * as React from 'react';
import { Search, X } from 'lucide-react';

import {
  Field,
  Input,
  SegmentedControl,
  type SegmentedItem,
  IconButton,
  Button,
} from '@/components/sabcrm/20ui';

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

const CATEGORY_ITEMS: ReadonlyArray<SegmentedItem<MarketplaceCategory>> = [
  { value: 'All', label: 'All' },
  { value: 'Data', label: 'Data' },
  { value: 'Communication', label: 'Communication' },
  { value: 'DevOps', label: 'DevOps' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Productivity', label: 'Productivity' },
];

const COMPLEXITY_ITEMS: ReadonlyArray<SegmentedItem<MarketplaceComplexity>> = [
  { value: 'All', label: 'All' },
  { value: 'Starter', label: 'Starter' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'Advanced', label: 'Advanced' },
];

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
      <Field label="Search templates">
        <div className="relative">
          <Input
            type="search"
            placeholder="Search templates..."
            value={rawSearch}
            onChange={handleSearchChange}
            iconLeft={Search}
            className="pr-9"
          />
          {rawSearch ? (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <IconButton
                size="sm"
                label="Clear search"
                icon={X}
                onClick={clearSearch}
              />
            </span>
          ) : null}
        </div>
      </Field>

      {/* ── Category ────────────────────────────────────────────────────────── */}
      <SegmentedControl<MarketplaceCategory>
        aria-label="Category filter"
        items={CATEGORY_ITEMS}
        value={value.category}
        onChange={setCategory}
        size="sm"
      />

      {/* ── Complexity ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-[var(--st-text-secondary)]">
          Complexity:
        </span>
        <SegmentedControl<MarketplaceComplexity>
          aria-label="Complexity filter"
          items={COMPLEXITY_ITEMS}
          value={value.complexity}
          onChange={setComplexity}
          size="sm"
        />
      </div>

      {/* ── Reset ───────────────────────────────────────────────────────────── */}
      {isDirty ? (
        <div>
          <Button variant="ghost" size="sm" iconLeft={X} onClick={reset}>
            Reset filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
