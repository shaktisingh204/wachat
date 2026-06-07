'use client';
/**
 * NodeCreator - port of n8n's NodeCreator.vue (trimmed).
 *
 * Search-driven picker panel. Opens from:
 *   - the canvas "+" button
 *   - the edge midpoint "+" (splicing a node onto an existing connection)
 *   - a drag-from-handle that didn't land on an input
 *   - keyboard shortcut (Tab)
 * Categories are drill-down; search filters across label/description.
 * Keyboard: Up/Down to move, Enter to select, Esc to close.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, SearchX, X } from 'lucide-react';
import { Field, Input, IconButton, EmptyState } from '@/components/sabcrm/20ui';
import { REGISTRY_CATEGORIES, type BlockRegistryEntry } from '@/components/sabflow/editor/blockRegistry';
import type { BlockType } from '@/lib/sabflow/types';
import type { NodeCreatorState } from './useNodeCreator';

type Props = {
  state: NodeCreatorState;
  onClose: () => void;
  onPick: (type: BlockType) => void;
};

export function NodeCreator({ state, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [state.open]);

  const flatEntries = useMemo(() => {
    const all = REGISTRY_CATEGORIES.flatMap((c) =>
      c.entries.map((e) => ({ cat: c.key, catLabel: c.label, catColor: c.color, entry: e })),
    );
    const lower = query.trim().toLowerCase();
    const allowed = state.allow ? new Set(state.allow) : null;
    return all.filter(({ entry }) => {
      if (allowed && !allowed.has(entry.type)) return false;
      if (!lower) return true;
      return (
        entry.label.toLowerCase().includes(lower) ||
        entry.description.toLowerCase().includes(lower)
      );
    });
  }, [query, state.allow]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { catLabel: string; catColor: string; entries: BlockRegistryEntry[] }
    >();
    for (const row of flatEntries) {
      const existing = map.get(row.cat);
      if (existing) existing.entries.push(row.entry);
      else
        map.set(row.cat, {
          catLabel: row.catLabel,
          catColor: row.catColor,
          entries: [row.entry],
        });
    }
    return [...map.values()];
  }, [flatEntries]);

  const flatForNav = flatEntries.map((r) => r.entry);

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(flatForNav.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const picked = flatForNav[activeIndex];
        if (picked) {
          onPick(picked.type);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state.open, flatForNav, activeIndex, onPick, onClose]);

  if (!state.open) return null;

  let runningIndex = 0;
  return (
    <div className="sabflow-node-creator ui20" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 p-2.5 border-b border-[var(--st-border)]">
        <Field className="flex-1" label="Search nodes">
          <Input
            ref={inputRef}
            inputSize="sm"
            value={query}
            placeholder="Search nodes"
            iconLeft={Search}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
          />
        </Field>
        <IconButton label="Close" icon={X} size="sm" onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {grouped.length === 0 ? (
          <EmptyState
            size="sm"
            icon={SearchX}
            title="No nodes found"
            description={query ? `Nothing matches "${query}".` : 'No nodes available here.'}
          />
        ) : (
          grouped.map((group) => (
            <div key={group.catLabel}>
              <div
                className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: group.catColor }}
              >
                {group.catLabel}
              </div>
              {group.entries.map((entry) => {
                const Icon = entry.icon;
                const index = runningIndex++;
                const isActive = index === activeIndex;
                return (
                  <div
                    key={entry.type}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={0}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--st-radius)] cursor-pointer text-[12.5px] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]${
                      isActive ? ' bg-[var(--st-bg-secondary)]' : ''
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => onPick(entry.type)}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
                      style={{ backgroundColor: entry.color + '22', color: entry.color }}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span>
                      {entry.label}
                      <span className="block text-[11px] leading-[1.25] text-[var(--st-text-secondary)]">
                        {entry.description}
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
