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
import { Button, IconButton, Input, EmptyState } from '@/components/sabcrm/20ui';
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
      className="ui20 sabflow-trigger-panel"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="sabflow-trigger-panel__head">
        <div className="sabflow-trigger-panel__title">What triggers this workflow?</div>
        <div className="sabflow-trigger-panel__subtitle">
          A trigger is a step that starts your workflow
        </div>
        <IconButton
          label="Close trigger picker"
          icon={X}
          variant="ghost"
          size="sm"
          className="sabflow-trigger-panel__close"
          onClick={onClose}
        />
      </div>

      <div className="sabflow-trigger-panel__search">
        <Input
          ref={inputRef}
          type="text"
          inputSize="sm"
          value={query}
          placeholder="Search triggers..."
          aria-label="Search triggers"
          iconLeft={Search}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
        />
      </div>

      <div className="sabflow-trigger-panel__body">
        {grouped.length === 0 ? (
          <EmptyState
            icon={Search}
            size="sm"
            title="No triggers found"
            description={`Nothing matches "${query}".`}
          />
        ) : (
          grouped.map((group) => (
            <div key={group.key} className="sabflow-trigger-panel__group">
              <div
                className="sabflow-trigger-panel__group-label"
                style={{ color: group.meta?.color }}
              >
                {group.meta?.label ?? group.key}
              </div>
              {group.options.map((option) => {
                const Icon = option.icon;
                const idx = runningIndex++;
                const isActive = idx === activeIndex;
                return (
                  <Button
                    key={option.appEvent}
                    variant="ghost"
                    role="option"
                    aria-selected={isActive}
                    className={`sabflow-trigger-panel__item${isActive ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => onPick(option.eventType, option.appEvent)}
                  >
                    <span
                      className="sabflow-trigger-panel__item-icon"
                      style={{
                        backgroundColor: option.color + '1f',
                        color: option.color,
                      }}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="sabflow-trigger-panel__item-text">
                      <span className="sabflow-trigger-panel__item-label">{option.label}</span>
                      <span className="sabflow-trigger-panel__item-desc">{option.description}</span>
                    </span>
                  </Button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
