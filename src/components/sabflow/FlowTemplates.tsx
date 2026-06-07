'use client';

import * as React from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronRight, Sparkles } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SegmentedControl,
  Spinner,
  cn,
  type SegmentedItem,
} from '@/components/sabcrm/20ui';
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
  const items = useMemo<ReadonlyArray<SegmentedItem<CategoryFilter>>>(
    () =>
      FILTERS.map((cat) => ({
        value: cat,
        label: (
          <span className="inline-flex items-center gap-1.5">
            <span>{cat}</span>
            <Badge tone={value === cat ? 'accent' : 'neutral'} kind="soft">
              {counts[cat] ?? 0}
            </Badge>
          </span>
        ),
      })),
    [counts, value],
  );

  return (
    <SegmentedControl<CategoryFilter>
      items={items}
      value={value}
      onChange={onChange}
      size="sm"
      aria-label="Filter templates by category"
    />
  );
}

/* ── Template card ──────────────────────────────────────── */

type CardComponentProps = {
  template: TemplateDefinition;
  isLoading: boolean;
  isBusy: boolean;
  onSelect: (t: TemplateDefinition) => void;
};

function TemplateCard({ template, isLoading, isBusy, onSelect }: CardComponentProps) {
  const Icon = template.icon;
  const disabled = isBusy && !isLoading;

  const activate = () => {
    if (disabled) return;
    onSelect(template);
  };

  return (
    <Card
      variant="interactive"
      padding="md"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={`Use template ${template.name}`}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      className={cn(
        'group relative flex flex-col gap-3 text-left',
        disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer',
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-accent)] shadow-sm">
        {isLoading ? (
          <Spinner size={16} label={`Creating ${template.name}`} />
        ) : (
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        )}
      </span>

      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1 text-[13px] font-semibold text-[var(--st-text)]">
          <span aria-hidden="true">{template.emoji}</span>
          <span>{template.name}</span>
        </span>
        <span className="text-[11px] leading-snug text-[var(--st-text-secondary)]">
          {template.description}
        </span>
        <span className="mt-1 inline-flex w-fit">
          <Badge tone="neutral" kind="soft">
            {template.category}
          </Badge>
        </span>
      </span>

      <ChevronRight
        aria-hidden="true"
        className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-tertiary)] opacity-0 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
        strokeWidth={2}
      />
    </Card>
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
      <PageHeader compact>
        <PageHeaderHeading>
          <PageTitle>Start from a template</PageTitle>
          <PageDescription>
            {filtered.length} of {TEMPLATES.length} templates
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Sparkles}
            iconRight={ArrowRight}
            onClick={() => router.push('/dashboard/sabflow/marketplace')}
          >
            Browse 250+ workflow templates in Marketplace
          </Button>
        </PageActions>
      </PageHeader>

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
        <EmptyState
          icon={Sparkles}
          title="No templates yet"
          description="There are no templates in this category yet. Try another category or browse the Marketplace."
        />
      ) : null}
    </section>
  );
}
