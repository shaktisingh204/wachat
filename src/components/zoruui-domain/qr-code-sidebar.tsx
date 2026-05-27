'use client';

import {
  Button,
  Input,
  Separator,
  cn,
} from '@/components/zoruui';
import { Filter, Search } from 'lucide-react';

export type SortKey = 'newest' | 'oldest' | 'name-asc' | 'name-desc';
export type DynamicFilter = 'all' | 'dynamic' | 'static';
export type TypeFilter = 'all' | 'url' | 'text' | 'email' | 'phone' | 'sms' | 'wifi';

const TYPE_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'url', label: 'URL' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'sms', label: 'SMS' },
  { value: 'wifi', label: 'WiFi' },
];

const DYNAMIC_OPTIONS: Array<{ value: DynamicFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'dynamic', label: 'Dynamic only' },
  { value: 'static', label: 'Static only' },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
];

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  typeFilter: TypeFilter;
  onTypeChange: (v: TypeFilter) => void;
  dynamicFilter: DynamicFilter;
  onDynamicChange: (v: DynamicFilter) => void;
  sortKey: SortKey;
  onSortChange: (v: SortKey) => void;
}

export function QrCodeSidebar({
  search,
  onSearchChange,
  typeFilter,
  onTypeChange,
  dynamicFilter,
  onDynamicChange,
  sortKey,
  onSortChange,
}: Props) {
  const hasFilters =
    !!search || typeFilter !== 'all' || dynamicFilter !== 'all' || sortKey !== 'newest';

  const clearAll = () => {
    onSearchChange('');
    onTypeChange('all');
    onDynamicChange('all');
    onSortChange('newest');
  };

  return (
    <aside className="w-full lg:w-60 flex-shrink-0 flex flex-col gap-4">
      <div className="px-1">
        <Input
          placeholder="Search by name..."
          leadingSlot={<Search />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="text-[12.5px]"
        />
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] uppercase tracking-wider text-zoru-ink-muted/60">
          Content Type
        </div>
        <nav className="flex flex-col gap-0.5">
          {TYPE_OPTIONS.map((opt) => {
            const active = typeFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTypeChange(opt.value)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-[12.5px] rounded-md mx-2 transition-colors text-left',
                  active
                    ? 'bg-zoru-surface-2 text-zoru-ink'
                    : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </nav>
      </div>

      <Separator />

      {/* Dynamic / Static */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] uppercase tracking-wider text-zoru-ink-muted/60">
          Tracking
        </div>
        <nav className="flex flex-col gap-0.5">
          {DYNAMIC_OPTIONS.map((opt) => {
            const active = dynamicFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onDynamicChange(opt.value)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-[12.5px] rounded-md mx-2 transition-colors text-left',
                  active
                    ? 'bg-zoru-surface-2 text-zoru-ink'
                    : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </nav>
      </div>

      <Separator />

      {/* Sort */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] uppercase tracking-wider text-zoru-ink-muted/60">
          Sort by
        </div>
        <nav className="flex flex-col gap-0.5">
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSortChange(opt.value)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-[12.5px] rounded-md mx-2 transition-colors text-left',
                  active
                    ? 'bg-zoru-surface-2 text-zoru-ink'
                    : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </nav>
      </div>

      {hasFilters ? (
        <>
          <Separator />
          <div className="px-2">
            <Button variant="ghost" size="sm" onClick={clearAll} className="w-full justify-start">
              <Filter className="h-3.5 w-3.5" />
              Reset filters
            </Button>
          </div>
        </>
      ) : null}
    </aside>
  );
}
