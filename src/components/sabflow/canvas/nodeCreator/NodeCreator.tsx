'use client';
/**
 * NodeCreator - port of n8n's NodeCreator.vue (trimmed).
 *
 * Search-driven picker panel. Opens from:
 *   - the canvas "+" button
 *   - the edge midpoint "+" (splicing a node onto an existing connection)
 *   - a drag-from-handle that didn't land on an input
 *   - keyboard shortcut (Tab)
 * Sourced from the unified app catalog (native + rust + forge + preset),
 * so every executable app is pickable here — not just the static registry.
 * Categories are drill-down; search filters across label/description/slug.
 * Keyboard: Up/Down to move, Enter to select, Esc to close.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Search, SearchX, X } from 'lucide-react';
import { BrandIcon } from '@/components/sabflow/BrandIcon';
import { Field, Input, IconButton, EmptyState, Badge } from '@/components/sabcrm/20ui';
import {
  useAppCatalog,
  type AppCatalogEntry,
} from '@/lib/sabflow/editor-catalog/useAppCatalog';
import type { BlockType } from '@/lib/sabflow/types';
import type { NodeCreatorState } from './useNodeCreator';

type Props = {
  state: NodeCreatorState;
  onClose: () => void;
  onPick: (type: BlockType, options?: Record<string, unknown>) => void;
};

/** Core categories keep their palette accent colors. */
const GROUP_COLORS: Record<string, string> = {
  Bubbles: '#6366f1',
  Inputs: '#0ea5e9',
  Logic: '#f97316',
};

export function NodeCreator({ state, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { entries, loading } = useAppCatalog();

  useEffect(() => {
    if (state.open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [state.open]);

  // Defer filtering so typing stays responsive against ~1.4k entries.
  const deferredQuery = useDeferredValue(query);

  const flatEntries = useMemo(() => {
    const lower = deferredQuery.trim().toLowerCase();
    const allowed = state.allow ? new Set<string>(state.allow) : null;
    return entries.filter((entry) => {
      if (allowed && !allowed.has(entry.blockType)) return false;
      if (!lower) return true;
      return (
        entry.label.toLowerCase().includes(lower) ||
        entry.description.toLowerCase().includes(lower) ||
        entry.slug.includes(lower)
      );
    });
  }, [entries, deferredQuery, state.allow]);

  const grouped = useMemo(() => {
    const map = new Map<string, { catLabel: string; catColor: string; entries: AppCatalogEntry[] }>();
    for (const entry of flatEntries) {
      const existing = map.get(entry.category);
      if (existing) existing.entries.push(entry);
      else
        map.set(entry.category, {
          catLabel: entry.category,
          catColor: GROUP_COLORS[entry.category] ?? 'var(--st-text-tertiary)',
          entries: [entry],
        });
    }
    return [...map.values()];
  }, [flatEntries]);

  // Keep keyboard order in sync with render order (grouped).
  const flatForNav = useMemo(
    () => grouped.flatMap((g) => g.entries),
    [grouped],
  );

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
          onPick(picked.blockType, picked.defaultOptions);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state.open, flatForNav, activeIndex, onPick, onClose]);

  if (!state.open) return null;

  let runningIndex = 0;
  return (
    <div
      className="sabflow-node-creator 20ui"
      data-testid="sabflow-node-creator"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 p-2.5 border-b border-[var(--st-border)]">
        <Field className="flex-1" label="Search nodes">
          <Input
            ref={inputRef}
            inputSize="sm"
            value={query}
            placeholder="Search nodes & apps"
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
            title={loading ? 'Loading apps...' : 'No nodes found'}
            description={
              loading
                ? undefined
                : query
                  ? `Nothing matches "${query}".`
                  : 'No nodes available here.'
            }
          />
        ) : (
          grouped.map((group) => (
            <div
              key={group.catLabel}
              // Cheap render skip for offscreen groups — the full catalog is
              // ~1.4k rows; content-visibility keeps initial paint fast
              // without restructuring the drill-down DOM for a virtualizer.
              style={{
                contentVisibility: 'auto',
                containIntrinsicSize: `auto ${group.entries.length * 48 + 28}px`,
              }}
            >
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
                const fallbackIcon = <Icon className="h-3.5 w-3.5" aria-hidden="true" />;
                return (
                  <div
                    key={entry.key}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={0}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--st-radius)] cursor-pointer text-[12.5px] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]${
                      isActive ? ' bg-[var(--st-bg-secondary)]' : ''
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => onPick(entry.blockType, entry.defaultOptions)}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
                      style={{ backgroundColor: entry.color + '22', color: entry.color }}
                    >
                      {entry.brandIcon ? (
                        <BrandIcon
                          icon={entry.brandIcon}
                          className="h-3.5 w-3.5"
                          fallback={fallbackIcon}
                          aria-hidden
                        />
                      ) : (
                        fallbackIcon
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{entry.label}</span>
                        {entry.draft && (
                          <Badge tone="neutral" className="shrink-0 !text-[9px]">
                            draft
                          </Badge>
                        )}
                      </span>
                      <span className="block text-[11px] leading-[1.25] text-[var(--st-text-secondary)] truncate">
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
