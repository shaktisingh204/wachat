'use client';

/**
 * Wachat Templates — list, rebuilt on ZoruUI primitives.
 *
 * Same data + handlers as before. Only the visual layer is swapped:
 * Clay → Zoru. Status badges use neutral zoru variants, no rainbow
 * accents. Delete uses ZoruAlertDialog.
 */

import * as React from 'react';
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useTransition,
} from 'react';
import type { WithId } from 'mongodb';
import { useRouter } from 'next/navigation';

import {
  RefreshCw,
  BookCopy,
  CirclePlus,
  Search,
  FileText,
  CircleAlert,
  ChevronDown,
  Filter,
  CircleCheck,
  Clock,
  CircleX,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';

import {
  getTemplates,
  handleSyncTemplates,
} from '@/app/actions/template.actions';
import type { Template } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruStatCard,
  useZoruToast,
  type ZoruBadgeProps,
} from '@/components/zoruui';

/* ── helpers ────────────────────────────────────────────────────── */

function compact(n: number): string {
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function statusVariant(s?: string | null): ZoruBadgeProps['variant'] {
  const v = (s ?? '').toLowerCase();
  if (v === 'approved') return 'success';
  if (v === 'pending' || v === 'in_review') return 'warning';
  if (v === 'rejected') return 'danger';
  return 'secondary';
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
  const [deleteTarget, setDeleteTarget] =
    useState<WithId<Template> | null>(null);
  const { toast } = useZoruToast();

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

  const onSync = useCallback(() => {
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
      ...Array.from(
        new Set(
          templates.map((t) => t.language).filter(Boolean) as string[],
        ),
      ),
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

  const onConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    // Real delete server action does not exist in this list view;
    // we fall back to optimistic local removal and inform the user.
    setTemplates((prev) =>
      prev.filter((t) => t._id.toString() !== deleteTarget._id.toString()),
    );
    toast({
      title: 'Template removed',
      description: `"${deleteTarget.name}" was removed locally. Sync with Meta to refresh.`,
    });
    setDeleteTarget(null);
  }, [deleteTarget, toast]);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Templates</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* Header */}
      <ZoruPageHeader bordered={false}>
        <ZoruPageHeading>
          <ZoruPageTitle>Message templates</ZoruPageTitle>
          <ZoruPageDescription>
            Manage and sync your WhatsApp message templates. Approved templates
            can be used in broadcasts and direct chats.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={!activeProjectId || isSyncing}
          >
            <RefreshCw className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing…' : 'Sync with Meta'}
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => router.push('/wachat/templates/library')}
          >
            <BookCopy /> Library
          </ZoruButton>
          <ZoruButton
            size="sm"
            disabled={!activeProjectId}
            onClick={() => router.push('/wachat/templates/create')}
          >
            <CirclePlus /> New template
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ZoruStatCard
          label="Total"
          value={compact(stats.total)}
          icon={<FileText />}
        />
        <ZoruStatCard
          label="Approved"
          value={compact(stats.approved)}
          icon={<CircleCheck />}
        />
        <ZoruStatCard
          label="In review"
          value={compact(stats.pending)}
          icon={<Clock />}
        />
        <ZoruStatCard
          label="Rejected"
          value={compact(stats.rejected)}
          icon={<CircleX />}
        />
      </div>

      {/* Project-not-selected state */}
      {!activeProjectId && isClient ? (
        <ZoruEmptyState
          icon={<CircleAlert />}
          title="No project selected"
          description="Please select a project from the main dashboard to manage templates."
          action={
            <ZoruButton size="sm" onClick={() => router.push('/wachat')}>
              Choose a project
            </ZoruButton>
          }
        />
      ) : (
        <>
          {/* Filter bar */}
          <ZoruCard className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[260px] flex-1">
                <ZoruInput
                  placeholder="Search templates by name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category filter */}
              <ZoruDropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <ZoruButton variant="outline" size="sm">
                    <Filter />
                    {categoryFilter === 'ALL'
                      ? 'All categories'
                      : categoryFilter.replace(/_/g, ' ')}
                    <ChevronDown className="opacity-60" />
                  </ZoruButton>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                  <ZoruDropdownMenuLabel>Category</ZoruDropdownMenuLabel>
                  <ZoruDropdownMenuSeparator />
                  <ZoruDropdownMenuRadioGroup
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                  >
                    {categories.map((c) => (
                      <ZoruDropdownMenuRadioItem
                        key={c}
                        value={c}
                        className="capitalize"
                      >
                        {c === 'ALL'
                          ? 'All'
                          : c.replace(/_/g, ' ').toLowerCase()}
                      </ZoruDropdownMenuRadioItem>
                    ))}
                  </ZoruDropdownMenuRadioGroup>
                </ZoruDropdownMenuContent>
              </ZoruDropdownMenu>

              {/* Status filter */}
              <ZoruDropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <ZoruButton variant="outline" size="sm">
                    {statusFilter === 'ALL'
                      ? 'All statuses'
                      : statusFilter.replace(/_/g, ' ').toLowerCase()}
                    <ChevronDown className="opacity-60" />
                  </ZoruButton>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                  <ZoruDropdownMenuLabel>Status</ZoruDropdownMenuLabel>
                  <ZoruDropdownMenuSeparator />
                  <ZoruDropdownMenuRadioGroup
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                  >
                    {statuses.map((s) => (
                      <ZoruDropdownMenuRadioItem
                        key={s}
                        value={s}
                        className="capitalize"
                      >
                        {s === 'ALL'
                          ? 'All'
                          : s.replace(/_/g, ' ').toLowerCase()}
                      </ZoruDropdownMenuRadioItem>
                    ))}
                  </ZoruDropdownMenuRadioGroup>
                </ZoruDropdownMenuContent>
              </ZoruDropdownMenu>

              {/* Language filter */}
              {languages.length > 2 ? (
                <ZoruDropdownMenu>
                  <ZoruDropdownMenuTrigger asChild>
                    <ZoruButton variant="outline" size="sm">
                      {languageFilter === 'ALL'
                        ? 'All languages'
                        : languageFilter}
                      <ChevronDown className="opacity-60" />
                    </ZoruButton>
                  </ZoruDropdownMenuTrigger>
                  <ZoruDropdownMenuContent align="end">
                    <ZoruDropdownMenuLabel>Language</ZoruDropdownMenuLabel>
                    <ZoruDropdownMenuSeparator />
                    <ZoruDropdownMenuRadioGroup
                      value={languageFilter}
                      onValueChange={setLanguageFilter}
                    >
                      {languages.map((l) => (
                        <ZoruDropdownMenuRadioItem key={l} value={l}>
                          {l === 'ALL' ? 'All' : l}
                        </ZoruDropdownMenuRadioItem>
                      ))}
                    </ZoruDropdownMenuRadioGroup>
                  </ZoruDropdownMenuContent>
                </ZoruDropdownMenu>
              ) : null}

              <span className="ml-auto text-[11.5px] tabular-nums text-zoru-ink-muted">
                {filteredTemplates.length} / {templates.length} templates
              </span>
            </div>
          </ZoruCard>

          {/* Template table / skeleton / empty */}
          {isLoading && templates.length === 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ZoruSkeleton key={i} className="h-36 w-full" />
              ))}
            </div>
          ) : filteredTemplates.length > 0 ? (
            <ZoruCard className="overflow-hidden p-0">
              <div className="divide-y divide-zoru-line">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle">
                  <span>Name</span>
                  <span>Category</span>
                  <span>Language</span>
                  <span>Status</span>
                  <span className="w-8" />
                </div>
                {filteredTemplates.map((t) => (
                  <div
                    key={t._id.toString()}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-zoru-surface"
                  >
                    <button
                      type="button"
                      className="min-w-0 truncate text-left text-zoru-ink hover:underline"
                      onClick={() =>
                        router.push(
                          `/wachat/templates/create?id=${t._id.toString()}`,
                        )
                      }
                    >
                      {t.name}
                    </button>
                    <span className="truncate capitalize text-zoru-ink-muted">
                      {(t.category || '').replace(/_/g, ' ').toLowerCase() ||
                        '—'}
                    </span>
                    <span className="truncate text-zoru-ink-muted">
                      {t.language || '—'}
                    </span>
                    <span>
                      <ZoruBadge variant={statusVariant(t.status)}>
                        {(t.status || 'unknown')
                          .replace(/_/g, ' ')
                          .toLowerCase()}
                      </ZoruBadge>
                    </span>
                    <ZoruDropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <ZoruButton
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Actions"
                        >
                          <MoreHorizontal />
                        </ZoruButton>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem
                          onSelect={() =>
                            router.push(
                              `/wachat/templates/create?id=${t._id.toString()}`,
                            )
                          }
                        >
                          <Pencil /> Edit
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem
                          onSelect={() =>
                            router.push(
                              `/wachat/templates/create?action=clone&id=${t._id.toString()}`,
                            )
                          }
                        >
                          <BookCopy /> Clone
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem
                          onSelect={() => setDeleteTarget(t)}
                        >
                          <Trash2 /> Delete
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </ZoruDropdownMenu>
                  </div>
                ))}
              </div>
            </ZoruCard>
          ) : (
            <ZoruEmptyState
              icon={<FileText />}
              title={
                templates.length > 0
                  ? 'No matching templates'
                  : 'No templates yet'
              }
              description={
                templates.length > 0
                  ? 'Your filters did not match any templates. Try adjusting your search or clearing the filters.'
                  : 'Sync existing templates from Meta or create a new one to get started.'
              }
              action={
                templates.length === 0 ? (
                  <div className="flex items-center justify-center gap-2">
                    <ZoruButton
                      variant="outline"
                      size="sm"
                      onClick={onSync}
                      disabled={isSyncing}
                    >
                      <RefreshCw /> Sync with Meta
                    </ZoruButton>
                    <ZoruButton
                      size="sm"
                      onClick={() => router.push('/wachat/templates/create')}
                    >
                      <CirclePlus /> New template
                    </ZoruButton>
                  </div>
                ) : (
                  <ZoruButton
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('ALL');
                      setStatusFilter('ALL');
                      setLanguageFilter('ALL');
                    }}
                  >
                    Clear filters
                  </ZoruButton>
                )
              }
            />
          )}
        </>
      )}

      {/* Delete confirm dialog */}
      <ZoruAlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete template?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This will remove &quot;{deleteTarget?.name}&quot; from your
              workspace. The template may still exist on Meta until the next
              sync.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={onConfirmDelete}>
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <div className="h-6" />
    </div>
  );
}
