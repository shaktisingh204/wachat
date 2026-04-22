'use client';
/**
 * NodeCreator — port of n8n's NodeCreator.vue (trimmed).
 *
 * Search-driven picker panel. Opens from:
 *   • the canvas "+" button
 *   • the edge midpoint "+" (splicing a node onto an existing connection)
 *   • a drag-from-handle that didn't land on an input
 *   • keyboard shortcut (Tab)
 * Categories are drill-down; search filters across label/description.
 * Keyboard: Up/Down to move, Enter to select, Esc to close.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuX, LuSearch } from 'react-icons/lu';
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
    <div className="sabflow-node-creator" onMouseDown={(e) => e.stopPropagation()}>
      <div className="sabflow-node-creator__header">
        <LuSearch className="h-3.5 w-3.5 text-[var(--gray-9)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search nodes…"
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          className="sabflow-node-creator__search"
        />
        <button
          type="button"
          aria-label="Close"
          className="sabflow-node-creator__close"
          onClick={onClose}
        >
          <LuX className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="sabflow-node-creator__body">
        {grouped.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-[var(--gray-9)]">
            No nodes match &ldquo;{query}&rdquo;
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.catLabel}>
              <div className="sabflow-node-creator__group-label" style={{ color: group.catColor }}>
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
                    className={`sabflow-node-creator__item${isActive ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => onPick(entry.type)}
                  >
                    <span
                      className="sabflow-node-creator__item-icon"
                      style={{ backgroundColor: entry.color + '22', color: entry.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      {entry.label}
                      <span className="sabflow-node-creator__item-desc">{entry.description}</span>
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
