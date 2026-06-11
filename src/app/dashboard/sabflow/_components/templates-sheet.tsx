'use client';

/**
 * Right-side slide-over panel that shows the SabFlow template catalog.
 *
 * Phase C.10.8 #8 - this picker now reads from the **unified** marketplace
 * registry at `@/lib/sabflow/marketplace/registry` instead of the chatbot-only
 * `TEMPLATES` array. We filter to `kind === 'chatbot'` so the picker keeps
 * its original behaviour (it still creates chatbot-style flows via
 * `template.build()` + `saveSabFlow()`), but the same registry now also
 * powers the marketplace browse page and the install API.
 *
 * On select: creates a fresh blank flow via `createSabFlow`, then materialises
 * the template graph into it via `saveSabFlow`. Navigates to the new flow on
 * success.
 *
 * Built on the 20ui `Sheet` primitive (Radix dialog): focus trap, Escape,
 * outside-click dismiss and scroll lock all come for free.
 */

import * as React from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight, Sparkles } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Badge,
  Button,
  Input,
  EmptyState,
  Spinner,
  useToast,
  cn,
} from '@/components/sabcrm/20ui';
import { createSabFlow, saveSabFlow } from '@/app/actions/sabflow';
// Importing for its registration side-effect - pushes every chatbot template
// into the unified registry so `listChatbotTemplates()` returns the full set.
import '@/components/sabflow/templates';
import {
  listChatbotTemplates,
  type Template as UnifiedTemplate,
} from '@/lib/sabflow/marketplace/registry';
import type { TemplateInstance } from '@/components/sabflow/templates/types';

/* -- Local view-model -------------------------------------- */

/**
 * Adapter shape: keeps the rest of this file's JSX byte-identical to the
 * pre-unification version (it expects `.icon`, `.emoji`, `.color`,
 * `.bgColor`, `.category`, `.build()`). The unified `Template` stores those
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

// Snapshot the chatbot subset once per module load - the registry is fully
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
 * Step 36 - featured-templates pinned to the top of the marketplace. Order
 * here = order in the strip. Keep this list short (max 6) so the row
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
  const { toast } = useToast();
  const [filter, setFilter] = useState<CategoryFilter>('All');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

    startTransition(async () => {
      try {
        const instance = template.build();
        const created = await createSabFlow(template.name);
        if ('error' in created) {
          toast.error(created.error as string);
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
          toast.error(saved.error as string);
        }

        onCreated();
        router.push(`/dashboard/sabflow/flow-builder/${created.id}`);
      } finally {
        setCreating(null);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="right"
        closeLabel="Close templates"
        className="w-full max-w-[640px] flex flex-col gap-0 p-0"
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center gap-2 px-6 py-4 border-b border-[var(--st-border)] shrink-0">
          <Sparkles className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          <SheetTitle className="text-sm font-semibold text-[var(--st-text)]">
            Browse templates
          </SheetTitle>
          <span className="text-xs text-[var(--st-text-secondary)]">
            {filtered.length} of {CHATBOT_TEMPLATES.length}
          </span>
        </SheetHeader>

        {/* Toolbar */}
        <div className="px-6 pt-4 pb-3 space-y-3 shrink-0">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates (e.g. lead, support, quiz)"
            iconLeft={Search}
            autoFocus
            aria-label="Search templates"
          />

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((cat) => (
              <Button
                key={cat}
                variant={filter === cat ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(cat)}
                aria-pressed={filter === cat}
                className="rounded-[var(--st-radius-pill)]"
              >
                {cat}
                <Badge
                  tone={filter === cat ? 'accent' : 'neutral'}
                  className="ml-1.5"
                >
                  {counts[cat] ?? 0}
                </Badge>
              </Button>
            ))}
          </div>
        </div>

        {/* Featured row - only when there's no active filter / query */}
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
            <EmptyState
              icon={Search}
              title="No templates match your filter"
              description="Try a different search term or category."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((tpl) => {
                const Icon = tpl.icon;
                const busy = isPending && creating === tpl.id;
                const disabled = isPending && creating !== null;
                return (
                  <Button
                    key={tpl.id}
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => handleSelect(tpl)}
                    className={cn(
                      'group relative flex flex-col items-stretch gap-2 h-auto rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 text-left',
                      disabled && !busy && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]">
                        {busy ? (
                          <Spinner size={16} label="Creating flow" className="text-[var(--st-text-secondary)]" />
                        ) : (
                          <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--st-text)] truncate">
                          <span className="mr-1" aria-hidden="true">
                            {tpl.emoji}
                          </span>
                          {tpl.name}
                        </p>
                        <p className="text-[10.5px] uppercase tracking-wider text-[var(--st-text-tertiary)] mt-0.5">
                          {tpl.category}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[var(--st-text-tertiary)] group-hover:text-[var(--st-text-secondary)] transition-colors" aria-hidden="true" />
                    </div>
                    <p className="text-[11.5px] text-[var(--st-text-secondary)] leading-snug whitespace-normal">
                      {tpl.description}
                    </p>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* -- FeaturedRow ------------------------------------------- */

/**
 * Horizontally-scrollable strip of curated picks shown at the top of the
 * marketplace when no filter or search is active. Tap -> one-click
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
      <div className="mb-2 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
        <Sparkles className="h-3 w-3 text-[var(--st-text-secondary)]" aria-hidden="true" />
        Featured
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {templates.map((tpl) => {
          const Icon = tpl.icon;
          const busy = creating === tpl.id;
          return (
            <Button
              key={`featured-${tpl.id}`}
              variant="ghost"
              disabled={disabled}
              onClick={() => onSelect(tpl)}
              className={cn(
                'group shrink-0 w-[220px] h-auto flex flex-col items-stretch rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-left',
                disabled && !busy && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className="flex items-center gap-2 mb-1.5 w-full">
                <div className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)]">
                  {busy ? (
                    <Spinner size="sm" label="Creating flow" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                </div>
                <p className="flex-1 truncate text-[12.5px] font-semibold text-[var(--st-text)]">
                  <span className="mr-1" aria-hidden="true">{tpl.emoji}</span>
                  {tpl.name}
                </p>
              </div>
              <p className="text-[10.5px] text-[var(--st-text-secondary)] leading-snug line-clamp-2 whitespace-normal">
                {tpl.description}
              </p>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
