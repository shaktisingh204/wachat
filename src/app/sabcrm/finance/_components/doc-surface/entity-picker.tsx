'use client';

/**
 * doc-surface — EntityPicker.
 *
 * An async 20ui `Combobox` over any fetcher (records engine, crate API):
 * shows label + meta line per row, caches picked labels so a committed
 * value NEVER renders as a raw ObjectId (the cached option is fed back
 * through the Combobox's static `options` pool, which it prefers for
 * closed-state display). Reusable for customer / vendor / item /
 * account pickers.
 */

import * as React from 'react';
import { Combobox, type ComboboxOption } from '@/components/sabcrm/20ui';
import type { DocEntityOption } from './types';

export interface EntityPickerProps {
  /** Selected entity id (24-char hex) or null. */
  value: string | null;
  /**
   * Display label for `value` — required whenever the form opens with a
   * preselected entity (edit mode) so the closed input shows a name.
   */
  valueLabel?: string | null;
  /** Fired with the picked option (or null when cleared). */
  onChange: (option: DocEntityOption | null) => void;
  /** Async search fetcher. Errors resolve to an empty list upstream. */
  search: (q: string) => Promise<DocEntityOption[]>;
  placeholder?: string;
  emptyText?: React.ReactNode;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-label'?: string;
}

export function EntityPicker({
  value,
  valueLabel,
  onChange,
  search,
  placeholder = 'Search…',
  emptyText = 'No matches',
  disabled = false,
  invalid = false,
  id,
  'aria-label': ariaLabel,
}: EntityPickerProps): React.JSX.Element {
  // id → option cache, so labels survive re-renders + re-opens.
  const cacheRef = React.useRef(new Map<string, DocEntityOption>());
  if (value && valueLabel && !cacheRef.current.has(value)) {
    cacheRef.current.set(value, { id: value, label: valueLabel });
  }

  const handleSearch = React.useCallback(
    async (q: string): Promise<ComboboxOption[]> => {
      let results: DocEntityOption[] = [];
      try {
        results = await search(q);
      } catch {
        results = [];
      }
      for (const r of results) cacheRef.current.set(r.id, r);
      return results.map((r) => ({
        value: r.id,
        label: r.label,
        description: r.meta,
      }));
    },
    [search],
  );

  // The static pool the Combobox uses for closed-state display — only
  // the selected option (search results drive the open list).
  const selected = value ? cacheRef.current.get(value) : undefined;
  const staticOptions = React.useMemo<ComboboxOption[]>(() => {
    if (!value) return [];
    const opt = selected ?? { id: value, label: valueLabel ?? '…' };
    return [{ value: opt.id, label: opt.label }];
  }, [value, selected, valueLabel]);

  return (
    <Combobox
      id={id}
      value={value}
      options={staticOptions}
      onSearch={handleSearch}
      onChange={(next) => {
        if (!next) {
          onChange(null);
          return;
        }
        onChange(cacheRef.current.get(next) ?? null);
      }}
      placeholder={placeholder}
      emptyText={emptyText}
      disabled={disabled}
      invalid={invalid}
      aria-label={ariaLabel}
    />
  );
}
