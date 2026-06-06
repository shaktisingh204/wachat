'use client';

/**
 * Right-side slide-over panel that shows the SabFlow template catalog.
 *
 * Phase C.10.8 #8 — this picker now reads from the **unified** marketplace
 * registry at `@/lib/sabflow/marketplace/registry` instead of the chatbot-only
 * `TEMPLATES` array.  We filter to `kind === 'chatbot'` so the picker keeps
 * its original behaviour (it still creates chatbot-style flows via
 * `template.build()` + `saveSabFlow()`), but the same registry now also
 * powers the marketplace browse page and the install API.
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
// Importing for its registration side-effect — pushes every chatbot template
// into the unified registry so `listChatbotTemplates()` returns the full set.
import '@/components/sabflow/templates';
import {
  listChatbotTemplates,
  type Template as UnifiedTemplate,
} from '@/lib/sabflow/marketplace/registry';
import type { TemplateInstance } from '@/components/sabflow/templates/types';

/* ── Local view-model ────────────────────────────────────── */

/**
 * Adapter shape: keeps the rest of this file's JSX byte-identical to the
 * pre-unification version (it expects `.icon`, `.emoji`, `.color`,
 * `.bgColor`, `.category`, `.build()`).  The unified `Template` stores those
 * in `chrome` + a typed-`unknown` icon; we re-cast here at the boundary.
 */
type ChatbotTemplateView = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  category: string;
  build: () => TemplateInstance;
};

function toView(t: UnifiedTemplate): ChatbotTemplateView | null {
  if (t.kind !== 'chatbot' || !t.chrome || !t.build) return null;
  return {
    id: t.id,
    name: t.displayName,
    description: t.description,
    emoji: t.chrome.emoji,
    color: t.chrome.color,
    bgColor: t.chrome.bgColor,
    icon: t.chrome.icon as ChatbotTemplateView['icon'],
    category: t.category,
    build: t.build,
  };
}

// Snapshot the chatbot subset once per module load — the registry is fully
// populated by the side-effect import above.
const CHATBOT_TEMPLATES: ChatbotTemplateView[] = listChatbotTemplates()
  .map(toView)
  .filter((t): t is ChatbotTemplateView => t !== null);

// Distinct canonical categories present in the chatbot subset, in stable
// display order.
const CHATBOT_CATEGORIES: string[] = Array.from(
  new Set(CHATBOT_TEMPLATES.map((t) => t.category)),
);

type CategoryFilter = 'All' | string;

const FILTERS: CategoryFilter[] = ['All', ...CHATBOT_CATEGORIES];

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
    return CHATBOT_TEMPLATES.filter((t) => {
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
      All: CHATBOT_TEMPLATES.length,
    };
    for (const c of CHATBOT_CATEGORIES) base[c] = 0;
    for (const t of CHATBOT_TEMPLATES) {
      base[t.category] = (base[t.category] ?? 0) + 1;
    }
    return base;
  }, []);

  function handleSelect(template: ChatbotTemplateView) {
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
          'bg-[var(--st-text)] border-l border-[var(--st-border)] shadow-2xl',
          'flex flex-col',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--st-border)] shrink-0">
          <div className="flex items-center gap-2">
            <LuSparkles className="w-4 h-4 text-[var(--st-text-secondary)]" />
            <span className="text-sm font-semibold text-white">
              Browse templates
            </span>
            <span className="text-xs text-[var(--st-text)]">
              {filtered.length} of {CHATBOT_TEMPLATES.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--st-text)] hover:text-white transition-colors"
          >
            <LuX className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 pt-4 pb-3 space-y-3 shrink-0">
          <div className="relative">
            <LuSearch className="w-3.5 h-3.5 text-[var(--st-text)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates (e.g. lead, support, quiz)…"
              className="w-full bg-[var(--st-text)] border border-[var(--st-border)]/60 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-[var(--st-text)] focus:outline-none focus:border-[var(--st-border)]"
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
                    ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]'
                    : 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/60 hover:bg-[var(--st-text)]/60',
                )}
              >
                {cat}
                <span
                  className={cn(
                    'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px]',
                    filter === cat
                      ? 'bg-[var(--st-text)]/15 text-[var(--st-text)]'
                      : 'bg-[var(--st-text)] text-[var(--st-text)]',
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
          <div className="mx-6 mb-2 px-3 py-2 rounded-lg border border-[var(--st-border)]/40 bg-[var(--st-text)]/10 text-xs text-[var(--st-text-secondary)]">
            {error}
          </div>
        )}

        {/* Featured row — only when there's no active filter / query */}
        {filter === 'All' && !query.trim() && (
          <FeaturedRow
            templates={CHATBOT_TEMPLATES.filter((t) =>
              FEATURED_TEMPLATE_IDS.includes(t.id),
            )}
            onSelect={handleSelect}
            disabled={isPending}
            creating={creating}
          />
        )}

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-[var(--st-text)] py-10 text-center">
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
                      'border-[var(--st-border)] bg-[var(--st-text)]/50 hover:bg-[var(--st-text)] hover:border-[var(--st-border)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)]/40',
                      disabled && !busy && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--st-border)]/60 bg-[var(--st-text)]">
                        {busy ? (
                          <LuLoader className="h-4 w-4 animate-spin text-[var(--st-text-secondary)]" />
                        ) : (
                          <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-white truncate">
                          <span className="mr-1" aria-hidden>
                            {tpl.emoji}
                          </span>
                          {tpl.name}
                        </p>
                        <p className="text-[10.5px] uppercase tracking-wider text-[var(--st-text)] mt-0.5">
                          {tpl.category}
                        </p>
                      </div>
                      <LuChevronRight className="h-4 w-4 text-[var(--st-text)] group-hover:text-[var(--st-text-secondary)] transition-colors" />
                    </div>
                    <p className="text-[11.5px] text-[var(--st-text-secondary)] leading-snug">
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
  templates: ChatbotTemplateView[];
  onSelect: (tpl: ChatbotTemplateView) => void;
  disabled: boolean;
  creating: string | null;
}) {
  if (templates.length === 0) return null;
  return (
    <div className="px-6 pb-3 shrink-0">
      <div className="mb-2 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-[var(--st-text)]">
        <LuSparkles className="h-3 w-3 text-[var(--st-text-secondary)]" />
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
                'group shrink-0 w-[220px] rounded-xl border border-[var(--st-border)]/30 bg-gradient-to-br from-[var(--st-text)]/10 to-[var(--st-text)]/60 p-3 text-left transition-colors',
                'hover:border-[var(--st-border)]/60 hover:from-[var(--st-text)]/15',
                disabled && !busy && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--st-border)]/30 bg-[var(--st-text)] text-[var(--st-text-secondary)]">
                  {busy ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />}
                </div>
                <p className="flex-1 truncate text-[12.5px] font-semibold text-white">
                  <span className="mr-1" aria-hidden>{tpl.emoji}</span>
                  {tpl.name}
                </p>
              </div>
              <p className="text-[10.5px] text-[var(--st-text-secondary)] leading-snug line-clamp-2">
                {tpl.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
