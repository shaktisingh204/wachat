'use client';

/**
 * Wachat Templates — rebuilt on Clay primitives.
 *
 * Keeps the shared <TemplateCard> component for the actual template
 * tile (it already uses shadcn primitives that pick up Clay tokens)
 * and replaces the page chrome, filter bar, and empty states.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import type { WithId } from 'mongodb';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  LuRefreshCw,
  LuBookCopy,
  LuCirclePlus,
  LuSearch,
  LuFileText,
  LuCircleAlert,
  LuChevronDown,
  LuFilter,
  LuCircleCheck,
  LuClock,
  LuCircleX,
} from 'react-icons/lu';

import { getTemplates, handleSyncTemplates } from '@/app/actions/template.actions';
import type { Template } from '@/lib/definitions';
import { TemplateCard } from '@/components/wabasimplify/template-card';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/context/project-context';

import { cn } from '@/lib/utils';
import {
  ClayBreadcrumbs,
  ClayButton,
  ClayCard,
} from '@/components/clay';
import { ClayInput } from '@/components/clay/clay-input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ── helpers ────────────────────────────────────────────────────── */

function compact(n: number): string {
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

/* ── page ───────────────────────────────────────────────────────── */

export default function TemplatesPage() {
  const router = useRouter();
  const { activeProject, activeProjectId } = useProject();
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [languageFilter, setLanguageFilter] = useState<string>('ALL');
  const [isLoading, startLoading] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => setIsClient(true), []);

  const fetchTemplates = useCallback(
    (projectId: string, showToast = false) => {
      startLoading(async () => {
        try {
          const data = await getTemplates(projectId);
          setTemplates(data || []);
          if (showToast) {
            toast({
              title: 'Refreshed',
              description: 'Template list has been updated.',
            });
          }
        } catch {
          toast({
            title: 'Error',
            description: 'Failed to load templates.',
            variant: 'destructive',
          });
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (activeProjectId) fetchTemplates(activeProjectId);
  }, [activeProjectId, fetchTemplates]);

  const onSync = useCallback(async () => {
    if (!activeProjectId) {
      toast({
        title: 'Error',
        description: 'No active project selected.',
        variant: 'destructive',
      });
      return;
    }
    startSyncing(async () => {
      const result = await handleSyncTemplates(activeProjectId);
      if (result.error) {
        toast({
          title: 'Sync failed',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sync successful',
          description: result.message,
        });
        await fetchTemplates(activeProjectId, true);
      }
    });
  }, [toast, activeProjectId, fetchTemplates]);

  const filteredTemplates = useMemo(
    () =>
      templates.filter((t) => {
        const nameMatch = t.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const categoryMatch =
          categoryFilter === 'ALL' || t.category === categoryFilter;
        const statusMatch =
          statusFilter === 'ALL' || t.status === statusFilter;
        const languageMatch =
          languageFilter === 'ALL' || t.language === languageFilter;
        return nameMatch && categoryMatch && statusMatch && languageMatch;
      }),
    [templates, searchQuery, categoryFilter, statusFilter, languageFilter],
  );

  const categories = useMemo(
    () => [
      'ALL',
      ...Array.from(new Set(templates.map((t) => t.category).filter(Boolean))),
    ],
    [templates],
  );
  const statuses = useMemo(
    () => [
      'ALL',
      ...Array.from(new Set(templates.map((t) => t.status).filter(Boolean))),
    ],
    [templates],
  );
  const languages = useMemo(
    () => [
      'ALL',
      ...Array.from(new Set(templates.map((t) => t.language).filter(Boolean) as string[])),
    ],
    [templates],
  );

  /* ── derived KPIs for the stats strip ── */
  const stats = useMemo(() => {
    const approved = templates.filter(
      (t) => (t.status ?? '').toLowerCase() === 'approved',
    ).length;
    const pending = templates.filter((t) =>
      ['pending', 'in_review'].includes((t.status ?? '').toLowerCase()),
    ).length;
    const rejected = templates.filter(
      (t) => (t.status ?? '').toLowerCase() === 'rejected',
    ).length;
    return { approved, pending, rejected, total: templates.length };
  }, [templates]);

  const cardGradients = [
    'card-gradient-green',
    'card-gradient-blue',
    'card-gradient-purple',
    'card-gradient-orange',
  ];

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      {/* Breadcrumb */}
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Templates' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            Message templates
          </h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">
            Manage and sync your WhatsApp message templates. Approved templates
            can be used in broadcasts and direct chats.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ClayButton
            variant="pill"
            size="md"
            leading={<LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={onSync}
            disabled={!activeProjectId || isSyncing}
          >
            {isSyncing ? 'Syncing…' : 'Sync with Meta'}
          </ClayButton>
          <ClayButton
            variant="pill"
            size="md"
            leading={<LuBookCopy className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={() => router.push('/dashboard/templates/library')}
          >
            Library
          </ClayButton>
          <ClayButton
            variant="obsidian"
            size="md"
            className="px-5"
            leading={<LuCirclePlus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            disabled={!activeProjectId}
            onClick={() => router.push('/dashboard/templates/create')}
          >
            New template
          </ClayButton>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total"
          value={compact(stats.total)}
          icon={<LuFileText className="h-3.5 w-3.5" strokeWidth={2} />}
          tint="neutral"
        />
        <Stat
          label="Approved"
          value={compact(stats.approved)}
          icon={<LuCircleCheck className="h-3.5 w-3.5" strokeWidth={2} />}
          tint="green"
        />
        <Stat
          label="In review"
          value={compact(stats.pending)}
          icon={<LuClock className="h-3.5 w-3.5" strokeWidth={2} />}
          tint="amber"
        />
        <Stat
          label="Rejected"
          value={compact(stats.rejected)}
          icon={<LuCircleX className="h-3.5 w-3.5" strokeWidth={2} />}
          tint="rose"
        />
      </div>

      {/* Project-not-selected state */}
      {!activeProjectId && isClient ? (
        <ClayCard padded={false} className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-rose-soft text-clay-rose-ink">
            <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="mt-4 text-[15px] font-semibold text-clay-ink">
            No project selected
          </div>
          <div className="mt-1.5 text-[12.5px] text-clay-ink-muted">
            Please select a project from the main dashboard to manage
            templates.
          </div>
          <ClayButton
            variant="rose"
            size="md"
            onClick={() => router.push('/dashboard')}
            className="mt-5"
          >
            Choose a project
          </ClayButton>
        </ClayCard>
      ) : (
        <>
          {/* Filter bar */}
          <ClayCard padded={false} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[260px] flex-1">
                <ClayInput
                  sizeVariant="md"
                  placeholder="Search templates by name…"
                  leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ClayButton
                    variant="pill"
                    size="md"
                    leading={<LuFilter className="h-3.5 w-3.5" strokeWidth={2} />}
                    trailing={
                      <LuChevronDown className="h-3 w-3 opacity-60" />
                    }
                  >
                    {categoryFilter === 'ALL'
                      ? 'All categories'
                      : categoryFilter.replace(/_/g, ' ')}
                  </ClayButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Category</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                  >
                    {categories.map((c) => (
                      <DropdownMenuRadioItem
                        key={c}
                        value={c}
                        className="capitalize"
                      >
                        {c === 'ALL' ? 'All' : c.replace(/_/g, ' ').toLowerCase()}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Status filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ClayButton
                    variant="pill"
                    size="md"
                    trailing={
                      <LuChevronDown className="h-3 w-3 opacity-60" />
                    }
                  >
                    {statusFilter === 'ALL'
                      ? 'All statuses'
                      : statusFilter.replace(/_/g, ' ').toLowerCase()}
                  </ClayButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                  >
                    {statuses.map((s) => (
                      <DropdownMenuRadioItem
                        key={s}
                        value={s}
                        className="capitalize"
                      >
                        {s === 'ALL' ? 'All' : s.replace(/_/g, ' ').toLowerCase()}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Language filter */}
              {languages.length > 2 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <ClayButton
                      variant="pill"
                      size="md"
                      trailing={<LuChevronDown className="h-3 w-3 opacity-60" />}
                    >
                      {languageFilter === 'ALL' ? 'All languages' : languageFilter}
                    </ClayButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Language</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={languageFilter}
                      onValueChange={setLanguageFilter}
                    >
                      {languages.map((l) => (
                        <DropdownMenuRadioItem key={l} value={l}>
                          {l === 'ALL' ? 'All' : l}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              <span className="ml-auto text-[11.5px] tabular-nums text-clay-ink-muted">
                {filteredTemplates.length} / {templates.length} templates
              </span>
            </div>
          </ClayCard>

          {/* Template grid / skeleton / empty */}
          {isLoading && templates.length === 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-clay-lg bg-clay-bg-2"
                />
              ))}
            </div>
          ) : filteredTemplates.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template, index) => (
                <TemplateCard
                  key={template._id.toString()}
                  template={template}
                  gradientClass={cardGradients[index % cardGradients.length]}
                />
              ))}
            </div>
          ) : (
            <ClayCard padded={false} className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-bg-2 text-clay-ink-muted">
                <LuFileText className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div className="mt-4 text-[15px] font-semibold text-clay-ink">
                {templates.length > 0
                  ? 'No matching templates'
                  : 'No templates yet'}
              </div>
              <div className="mt-1.5 text-[12.5px] text-clay-ink-muted">
                {templates.length > 0
                  ? 'Your filters did not match any templates. Try adjusting your search or clearing the filters.'
                  : 'Sync existing templates from Meta or create a new one to get started.'}
              </div>
              {templates.length === 0 ? (
                <div className="mt-5 flex items-center justify-center gap-2">
                  <ClayButton
                    variant="pill"
                    size="md"
                    leading={
                      <LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                    }
                    onClick={onSync}
                    disabled={isSyncing}
                  >
                    Sync with Meta
                  </ClayButton>
                  <ClayButton
                    variant="rose"
                    size="md"
                    leading={
                      <LuCirclePlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    }
                    onClick={() => router.push('/dashboard/templates/create')}
                  >
                    New template
                  </ClayButton>
                </div>
              ) : (
                <ClayButton
                  variant="pill"
                  size="md"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('ALL');
                    setStatusFilter('ALL');
                    setLanguageFilter('ALL');
                  }}
                  className="mt-5"
                >
                  Clear filters
                </ClayButton>
              )}
            </ClayCard>
          )}
        </>
      )}

      <div className="h-6" />
    </div>
  );
}

/* ── stat tile ──────────────────────────────────────────────────── */

function Stat({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tint: 'neutral' | 'green' | 'amber' | 'rose';
}) {
  const chipClass: Record<typeof tint, string> = {
    neutral: 'bg-clay-bg-2 text-clay-ink-muted',
    green: 'bg-[#DCFCE7] text-[#166534]',
    amber: 'bg-[#FEF3C7] text-[#92400E]',
    rose: 'bg-clay-rose-soft text-clay-rose-ink',
  };
  return (
    <div className="rounded-[14px] border border-clay-border bg-clay-surface p-4">
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-[10px]',
            chipClass[tint],
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-clay-ink-muted leading-none">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.01em] text-clay-ink leading-none">
        {value}
      </div>
    </div>
  );
}
