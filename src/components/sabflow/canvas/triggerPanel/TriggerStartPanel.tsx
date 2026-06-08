'use client';
/**
 * TriggerStartPanel - port of n8n's "What triggers this workflow?" rail.
 *
 * Auto-opens on the right side of the canvas when a flow has no trigger
 * events. Picking a row creates the corresponding SabFlowEvent and closes
 * the panel. Search filters across label + description; the list is
 * grouped by SabNode product category (Wachat, CRM, Calls, Broadcasts).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Field, Input, IconButton, EmptyState } from '@/components/sabcrm/20ui';
import type { EventType } from '@/lib/sabflow/types';
import {
  TRIGGER_OPTIONS,
  TRIGGER_CATEGORY_META,
  type TriggerCategory,
  type TriggerOption,
} from './triggerOptions';

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (eventType: EventType, appEvent: string) => void;
};

export function TriggerStartPanel({ open, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return TRIGGER_OPTIONS;
    return TRIGGER_OPTIONS.filter(
      (o) =>
        o.label.toLowerCase().includes(lower) ||
        o.description.toLowerCase().includes(lower) ||
        o.appEvent.toLowerCase().includes(lower),
    );
  }, [query]);

  /** Filtered options grouped by category, in TRIGGER_CATEGORY_META.order. */
  const grouped = useMemo(() => {
    const buckets = new Map<TriggerCategory, TriggerOption[]>();
    for (const opt of filtered) {
      const arr = buckets.get(opt.category);
      if (arr) arr.push(opt);
      else buckets.set(opt.category, [opt]);
    }
    return [...buckets.entries()]
      .sort(
        ([a], [b]) =>
          (TRIGGER_CATEGORY_META[a]?.order ?? 999) -
          (TRIGGER_CATEGORY_META[b]?.order ?? 999),
      )
      .map(([key, options]) => ({
        key,
        meta: TRIGGER_CATEGORY_META[key],
        options,
      }));
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const picked = filtered[activeIndex];
        if (picked) onPick(picked.eventType, picked.appEvent);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIndex, onClose, onPick]);

  if (!open) return null;

  let runningIndex = 0;
  return (
    <div
      className="20ui absolute right-3 top-3 z-30 flex max-h-[calc(100%-1.5rem)] w-[360px] flex-col overflow-hidden rounded-[12px] border border-[var(--st-border)] bg-[var(--st-bg)] shadow-[0_24px_48px_-12px_var(--st-border)]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="relative border-b border-[var(--st-border)] px-4 pb-3 pt-4">
        <div className="text-[14px] font-semibold leading-[1.3] text-[var(--st-text)]">
          What triggers this workflow?
        </div>
        <div className="mt-1 pr-6 text-[12px] leading-[1.4] text-[var(--st-text-secondary)]">
          A trigger is a step that starts your workflow
        </div>
        <IconButton
          label="Close trigger picker"
          icon={X}
          variant="ghost"
          size="sm"
          className="absolute right-3 top-3"
          onClick={onClose}
        />
      </div>

      <div className="border-b border-[var(--st-border)] p-3">
        <Field label="Search triggers">
          <Input
            ref={inputRef}
            type="text"
            inputSize="sm"
            value={query}
            placeholder="Search triggers..."
            iconLeft={Search}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
          />
        </Field>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5" role="listbox" aria-label="Triggers">
        {grouped.length === 0 ? (
          <EmptyState
            icon={Search}
            size="sm"
            title="No triggers found"
            description={`Nothing matches "${query}".`}
          />
        ) : (
          grouped.map((group) => (
            <div key={group.key} className="mb-1">
              <div
                className="sticky top-0 z-[1] bg-[var(--st-bg)] px-3 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: group.meta?.color }}
              >
                {group.meta?.label ?? group.key}
              </div>
              {group.options.map((option) => {
                const Icon = option.icon;
                const idx = runningIndex++;
                const isActive = idx === activeIndex;
                return (
                  <div
                    key={option.appEvent}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={0}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-[var(--st-radius)] px-3 py-2.5 text-left text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]${
                      isActive ? ' bg-[var(--st-bg-secondary)]' : ''
                    }`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => onPick(option.eventType, option.appEvent)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPick(option.eventType, option.appEvent);
                      }
                    }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
                      style={{
                        backgroundColor: option.color + '1f',
                        color: option.color,
                      }}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13px] font-medium leading-[1.3] text-[var(--st-text)]">
                        {option.label}
                      </span>
                      <span className="text-[11.5px] leading-[1.4] text-[var(--st-text-secondary)]">
                        {option.description}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
