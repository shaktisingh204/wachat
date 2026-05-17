'use client';

/**
 * Right-side slide-over panel that shows the SabFlow template catalog.
 * Reuses the existing `TEMPLATES` registry from
 * `@/components/sabflow/templates` (no parallel stub data needed — the
 * registry is shipped already).
 *
 * On select: creates a fresh blank flow via `createSabFlow`, then materialises
 * the template graph into it via `saveSabFlow`. Navigates to the new flow on
 * success.
 */

import * as React from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LuX, LuSearch, LuChevronRight, LuLoader, LuSparkles } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { createSabFlow, saveSabFlow } from '@/app/actions/sabflow';
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  type TemplateDefinition,
} from '@/components/sabflow/templates';

type CategoryFilter = 'All' | TemplateCategory;

const FILTERS: CategoryFilter[] = ['All', ...TEMPLATE_CATEGORIES];

/**
 * Step 36 — featured-templates pinned to the top of the marketplace.  Order
 * here = order in the strip.  Keep this list short (≤ 6) so the row
 * doesn't out-shout the main grid.
 */
const FEATURED_TEMPLATE_IDS: string[] = [
  'lead-capture',
  'customer-support',
  'faq-bot',
  'newsletter-signup',
  'mortgage-calculator',
  'product-recommendation',
];

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function TemplatesSheet({ open, onClose, onCreated }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<CategoryFilter>('All');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (filter !== 'All' && t.category !== filter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    });
  }, [filter, query]);

  const counts = useMemo<Record<CategoryFilter, number>>(() => {
    const base: Record<CategoryFilter, number> = {
      All: TEMPLATES.length,
      Marketing: 0,
      Support: 0,
      Sales: 0,
      HR: 0,
      'E-commerce': 0,
      Health: 0,
      Other: 0,
    };
    for (const t of TEMPLATES) base[t.category] = (base[t.category] ?? 0) + 1;
    return base;
  }, []);

  function handleSelect(template: TemplateDefinition) {
    if (creating) return;
    setCreating(template.id);
    setError(null);

    startTransition(async () => {
      try {
        const instance = template.build();
        const created = await createSabFlow(template.name);
        if ('error' in created) {
          setError(created.error as string);
          setCreating(null);
          return;
        }

        const saved = await saveSabFlow(created.id, {
          groups: instance.groups,
          edges: instance.edges,
          variables: instance.variables,
          theme: instance.theme,
          settings: instance.settings,
        });

        if ('error' in saved) {
          // Surface the save error but still navigate to the blank flow so the
          // user isn't stranded.
          setError(saved.error as string);
        }

        onCreated();
        router.push(`/dashboard/sabflow/flow-builder/${created.id}`);
      } finally {
        setCreating(null);
      }
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close templates"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Browse templates"
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-[640px]',
          'bg-zinc-950 border-l border-zinc-800 shadow-2xl',
          'flex flex-col',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <LuSparkles className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-100">
              Browse templates
            </span>
            <span className="text-xs text-zinc-500">
              {filtered.length} of {TEMPLATES.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <LuX className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 pt-4 pb-3 space-y-3 shrink-0">
          <div className="relative">
            <LuSearch className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates (e.g. lead, support, quiz)…"
              className="w-full bg-zinc-900 border border-zinc-700/60 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                  filter === cat
                    ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                    : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/60 hover:bg-zinc-700/60',
                )}
              >
                {cat}
                <span
                  className={cn(
                    'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px]',
                    filter === cat
                      ? 'bg-zinc-900/15 text-zinc-700'
                      : 'bg-zinc-900 text-zinc-500',
                  )}
                >
                  {counts[cat] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Featured row — only when there's no active filter / query */}
        {filter === 'All' && !query.trim() && (
          <FeaturedRow
            templates={TEMPLATES.filter((t) => FEATURED_TEMPLATE_IDS.includes(t.id))}
            onSelect={handleSelect}
            disabled={isPending}
            creating={creating}
          />
        )}

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500 py-10 text-center">
              No templates match your filter.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((tpl) => {
                const Icon = tpl.icon;
                const busy = isPending && creating === tpl.id;
                const disabled = isPending && creating !== null;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelect(tpl)}
                    className={cn(
                      'group relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors',
                      'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40',
                      disabled && !busy && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-950">
                        {busy ? (
                          <LuLoader className="h-4 w-4 animate-spin text-zinc-300" />
                        ) : (
                          <Icon className="h-4 w-4 text-zinc-300" strokeWidth={1.75} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-zinc-100 truncate">
                          <span className="mr-1" aria-hidden>
                            {tpl.emoji}
                          </span>
                          {tpl.name}
                        </p>
                        <p className="text-[10.5px] uppercase tracking-wider text-zinc-500 mt-0.5">
                          {tpl.category}
                        </p>
                      </div>
                      <LuChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                    </div>
                    <p className="text-[11.5px] text-zinc-400 leading-snug">
                      {tpl.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── FeaturedRow ─────────────────────────────────────────── */

/**
 * Horizontally-scrollable strip of curated picks shown at the top of the
 * marketplace when no filter or search is active.  Tap → one-click
 * instantiation, same code path as the grid.
 */
function FeaturedRow({
  templates,
  onSelect,
  disabled,
  creating,
}: {
  templates: TemplateDefinition[];
  onSelect: (tpl: TemplateDefinition) => void;
  disabled: boolean;
  creating: string | null;
}) {
  if (templates.length === 0) return null;
  return (
    <div className="px-6 pb-3 shrink-0">
      <div className="mb-2 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-zinc-500">
        <LuSparkles className="h-3 w-3 text-amber-400" />
        Featured
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {templates.map((tpl) => {
          const Icon = tpl.icon;
          const busy = creating === tpl.id;
          return (
            <button
              key={`featured-${tpl.id}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(tpl)}
              className={cn(
                'group shrink-0 w-[220px] rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-zinc-900/60 p-3 text-left transition-colors',
                'hover:border-amber-400/60 hover:from-amber-500/15',
                disabled && !busy && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/30 bg-zinc-950 text-amber-300">
                  {busy ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />}
                </div>
                <p className="flex-1 truncate text-[12.5px] font-semibold text-zinc-100">
                  <span className="mr-1" aria-hidden>{tpl.emoji}</span>
                  {tpl.name}
                </p>
              </div>
              <p className="text-[10.5px] text-zinc-400 leading-snug line-clamp-2">
                {tpl.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
