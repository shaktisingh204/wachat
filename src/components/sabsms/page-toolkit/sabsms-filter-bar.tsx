"use client";

import * as React from "react";
import { ArrowDownUp, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";

import {
  Badge,
  Button,
  ZoruDateRangePicker,
  DropdownMenu,
  ZoruDropdownMenuCheckboxItem,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from "@/components/zoruui";

import { useSabsmsUrlState } from "./use-sabsms-url-state";

/**
 * Shared filter bar covering features S6 (debounced search), S7 (faceted
 * filter chips), S8 (date range), S9 (sort), S28 (URL sync).
 *
 * Every page that lists data should mount this above its table.
 */

export interface SabsmsFacet {
  /** URL param key, e.g. "status". */
  key: string;
  label: string;
  options: { value: string; label: string }[];
  /** Allow multi-select chips. */
  multi?: boolean;
}

export interface SabsmsSortOption {
  value: string;
  label: string;
}

export interface SabsmsFilterBarProps {
  searchKey?: string;
  searchPlaceholder?: string;
  facets?: SabsmsFacet[];
  sortOptions?: SabsmsSortOption[];
  defaultSort?: string;
  dateRangeKey?: { from: string; to: string };
  trailing?: React.ReactNode;
  className?: string;
}

const DEBOUNCE_MS = 300;

export function SabsmsFilterBar({
  searchKey = "q",
  searchPlaceholder = "Search…",
  facets = [],
  sortOptions,
  defaultSort,
  dateRangeKey,
  trailing,
  className,
}: SabsmsFilterBarProps) {
  const url = useSabsmsUrlState();
  const [searchInput, setSearchInput] = React.useState(url.get(searchKey) ?? "");
  const sortValue = url.get("sort") ?? defaultSort;

  React.useEffect(() => {
    const handle = setTimeout(() => {
      const current = url.get(searchKey) ?? "";
      if (searchInput !== current) {
        url.setOne(searchKey, searchInput || null);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, searchKey]);

  const activeFilterCount = facets.reduce((sum, f) => {
    const values = f.multi ? url.getAll(f.key) : url.get(f.key) ? [url.get(f.key)!] : [];
    return sum + values.length;
  }, 0);

  function clearAll() {
    setSearchInput("");
    const keys: string[] = [searchKey, "sort"];
    facets.forEach((f) => keys.push(f.key));
    if (dateRangeKey) keys.push(dateRangeKey.from, dateRangeKey.to);
    url.clear(keys);
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-md border border-[var(--st-border)] bg-white p-2 ${className ?? ""}`}
    >
      <div className="relative flex min-w-[220px] flex-1 items-center">
        <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8"
          aria-label={searchPlaceholder}
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            className="absolute right-2 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {facets.map((facet) => (
        <FacetChip key={facet.key} facet={facet} />
      ))}

      {dateRangeKey && (
        <ZoruDateRangePicker
          value={(() => {
            const fromStr = url.get(dateRangeKey.from);
            const toStr = url.get(dateRangeKey.to);
            const from = fromStr ? new Date(fromStr) : undefined;
            const to = toStr ? new Date(toStr) : undefined;
            return from || to ? { from, to } : undefined;
          })()}
          onChange={(range) =>
            url.set({
              [dateRangeKey.from]: range?.from ? range.from.toISOString() : null,
              [dateRangeKey.to]: range?.to ? range.to.toISOString() : null,
            })
          }
          align="start"
        />
      )}

      {sortOptions && sortOptions.length > 0 && (
        <Select
          value={sortValue}
          onValueChange={(v) => url.setOne("sort", v)}
        >
          <ZoruSelectTrigger className="w-[180px]">
            <ArrowDownUp className="mr-1.5 h-3.5 w-3.5 text-[var(--st-text)]" />
            <ZoruSelectValue placeholder="Sort" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {sortOptions.map((s) => (
              <ZoruSelectItem key={s.value} value={s.value}>
                {s.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
      )}

      {activeFilterCount > 0 && (
        <Badge variant="secondary">
          {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
        </Badge>
      )}

      <div className="ml-auto flex items-center gap-2">
        {trailing}
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
        </Button>
      </div>
    </div>
  );
}

function FacetChip({ facet }: { facet: SabsmsFacet }) {
  const url = useSabsmsUrlState();
  const values = facet.multi
    ? url.getAll(facet.key)
    : url.get(facet.key)
      ? [url.get(facet.key)!]
      : [];
  const selectedLabels = values
    .map((v) => facet.options.find((o) => o.value === v)?.label ?? v)
    .filter(Boolean);

  return (
    <DropdownMenu>
      <ZoruDropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {facet.label}
          {selectedLabels.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {selectedLabels.length}
            </Badge>
          )}
        </Button>
      </ZoruDropdownMenuTrigger>
      <ZoruDropdownMenuContent align="start">
        <ZoruDropdownMenuLabel>{facet.label}</ZoruDropdownMenuLabel>
        <ZoruDropdownMenuSeparator />
        {facet.options.map((opt) => {
          const checked = values.includes(opt.value);
          return (
            <ZoruDropdownMenuCheckboxItem
              key={opt.value}
              checked={checked}
              onCheckedChange={() => {
                if (facet.multi) {
                  url.toggleInList(facet.key, opt.value);
                } else {
                  url.setOne(facet.key, checked ? null : opt.value);
                }
              }}
            >
              {opt.label}
            </ZoruDropdownMenuCheckboxItem>
          );
        })}
      </ZoruDropdownMenuContent>
    </DropdownMenu>
  );
}
