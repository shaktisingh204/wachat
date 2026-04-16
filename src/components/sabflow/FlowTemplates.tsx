'use client';

import * as React from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LuChevronRight, LuLoader } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { createSabFlow, saveSabFlow } from '@/app/actions/sabflow';
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  type TemplateDefinition,
} from './templates';

/* ── Filter bar ─────────────────────────────────────────── */

type CategoryFilter = 'All' | TemplateCategory;

const FILTERS: CategoryFilter[] = ['All', ...TEMPLATE_CATEGORIES];

type FilterBarProps = {
  value: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
  counts: Record<CategoryFilter, number>;
};

function FilterBar({ value, onChange, counts }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTERS.map((cat) => {
        const isActive = value === cat;
        const count = counts[cat] ?? 0;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
              isActive
                ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400/70 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100',
            )}
          >
            <span>{cat}</span>
            <span
              className={cn(
                'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px]',
                isActive
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Template card ──────────────────────────────────────── */

type CardProps = {
  template: TemplateDefinition;
  isLoading: boolean;
  isBusy: boolean;
  onSelect: (t: TemplateDefinition) => void;
};

function TemplateCard({ template, isLoading, isBusy, onSelect }: CardProps) {
  const Icon = template.icon;
  return (
    <button
      type="button"
      disabled={isBusy}
      onClick={() => onSelect(template)}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border p-4 text-left',
        'transition-all duration-200',
        template.bgColor,
        'hover:shadow-md hover:scale-[1.02]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
        isBusy && !isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      )}
      aria-label={`Use template ${template.name}`}
    >
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-zinc-900 shadow-sm border border-zinc-100 dark:border-zinc-800',
          template.color,
        )}
      >
        {isLoading ? (
          <LuLoader className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
          <span aria-hidden>{template.emoji}</span>
          <span>{template.name}</span>
        </span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
          {template.description}
        </span>
        <span className="mt-1 inline-flex w-fit items-center rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
          {template.category}
        </span>
      </div>

      <LuChevronRight
        className={cn(
          'absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-transform',
          template.color,
          'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5',
        )}
        strokeWidth={2}
      />
    </button>
  );
}

/* ── FlowTemplates ──────────────────────────────────────── */

type Props = {
  onFlowCreated?: () => void;
};

export function FlowTemplates({ onFlowCreated }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<CategoryFilter>('All');

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
    for (const t of TEMPLATES) {
      base[t.category] = (base[t.category] ?? 0) + 1;
    }
    return base;
  }, []);

  const filtered = useMemo(
    () => (filter === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === filter)),
    [filter],
  );

  const handleUseTemplate = (template: TemplateDefinition) => {
    if (isPending || creating) return;
    setCreating(template.id);

    startTransition(async () => {
      try {
        // Build the template graph with fresh IDs.
        const instance = template.build();

        // Create a new blank flow first, then save the template graph into it.
        // Two-step approach keeps the server action surface small (no template
        // payload needed on createSabFlow).
        const result = await createSabFlow(template.name);
        if ('error' in result) {
          setCreating(null);
          return;
        }

        const saveRes = await saveSabFlow(result.id, {
          groups: instance.groups,
          edges: instance.edges,
          variables: instance.variables,
          theme: instance.theme,
          settings: instance.settings,
        });

        if ('error' in saveRes) {
          // Fall back to navigating to the empty flow if save failed.
          router.push(`/dashboard/sabflow/flow-builder/${result.id}`);
          onFlowCreated?.();
          setCreating(null);
          return;
        }

        router.push(`/dashboard/sabflow/flow-builder/${result.id}`);
        onFlowCreated?.();
      } finally {
        setCreating(null);
      }
    });
  };

  const busy = creating !== null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
          Start from a template
        </h2>
        <span className="text-[11px] text-zinc-400">
          {filtered.length} of {TEMPLATES.length} templates
        </span>
      </div>

      <FilterBar value={filter} onChange={setFilter} counts={counts} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            isLoading={creating === tpl.id}
            isBusy={busy}
            onSelect={handleUseTemplate}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-[12px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          No templates in this category yet.
        </div>
      ) : null}
    </section>
  );
}
