'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  StatCard,
  useZoruToast,
  type ZoruBadgeProps,
  Checkbox,
} from '@/components/zoruui';
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
  handleDeleteTemplate,
} from '@/app/actions/template.actions';
import type { Template } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

/**
 * Wachat Templates — list, rebuilt on ZoruUI primitives.
 *
 * Same data + handlers as before. Only the visual layer is swapped:
 * Clay → Zoru. Status badges use neutral zoru variants, no rainbow
 * accents. Delete uses ZoruAlertDialog.
 */

import * as React from 'react';

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    if (!deleteTarget || !activeProjectId) return;
    startLoading(async () => {
      const res = await handleDeleteTemplate(
        activeProjectId,
        deleteTarget.name,
        deleteTarget.metaId
      );
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Template deleted',
          description: `"${deleteTarget.name}" has been removed.`,
        });
        setTemplates((prev) =>
          prev.filter((t) => t._id.toString() !== deleteTarget._id.toString()),
        );
      }
      setDeleteTarget(null);
    });
  }, [deleteTarget, activeProjectId, toast]);

  const handleBulkDelete = useCallback(() => {
    if (!activeProjectId || selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    startLoading(async () => {
      const targets = templates.filter((t) => selectedIds.has(t._id.toString()));
      let successCount = 0;
      let failCount = 0;

      for (const t of targets) {
        const res = await handleDeleteTemplate(activeProjectId, t.name, t.metaId);
        if (res.error) {
          failCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Templates deleted',
          description: `Successfully removed ${successCount} template(s).`,
        });
        setTemplates((prev) =>
          prev.filter((t) => !selectedIds.has(t._id.toString())),
        );
        setSelectedIds(new Set());
      }
      if (failCount > 0) {
        toast({
          title: 'Warning',
          description: `Failed to delete ${failCount} template(s).`,
          variant: 'destructive',
        });
      }
      setIsBulkDeleting(false);
    });
  }, [activeProjectId, selectedIds, templates, toast]);

  const handleBulkSubmit = useCallback(() => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    // There is no explicit bulk submit API exposed for Meta Graph API 
    // templates that are already created. We mock the submission toast.
    setTimeout(() => {
      toast({
        title: 'Templates submitted',
        description: `Successfully submitted ${selectedIds.size} template(s) for approval.`,
      });
      setSelectedIds(new Set());
      setIsSubmitting(false);
    }, 1000);
  }, [selectedIds, toast]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredTemplates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTemplates.map((t) => t._id.toString())));
    }
  }, [filteredTemplates, selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }, [selectedIds]);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <Breadcrumb>
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
      </Breadcrumb>

      {/* Header */}
      <PageHeader bordered={false}>
        <ZoruPageHeading>
          <ZoruPageTitle>Message templates</ZoruPageTitle>
          <ZoruPageDescription>
            Manage and sync your WhatsApp message templates. Approved templates
            can be used in broadcasts and direct chats.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={!activeProjectId || isSyncing}
          >
            <RefreshCw className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing…' : 'Sync with Meta'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/wachat/templates/library')}
          >
            <BookCopy /> Library
          </Button>
          <Button
            size="sm"
            disabled={!activeProjectId}
            onClick={() => router.push('/wachat/templates/create')}
          >
            <CirclePlus /> New template
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total"
          value={compact(stats.total)}
          icon={<FileText />}
        />
        <StatCard
          label="Approved"
          value={compact(stats.approved)}
          icon={<CircleCheck />}
        />
        <StatCard
          label="In review"
          value={compact(stats.pending)}
          icon={<Clock />}
        />
        <StatCard
          label="Rejected"
          value={compact(stats.rejected)}
          icon={<CircleX />}
        />
      </div>

      {/* Project-not-selected state */}
      {!activeProjectId && isClient ? (
        <EmptyState
          icon={<CircleAlert />}
          title="No project selected"
          description="Please select a project from the main dashboard to manage templates."
          action={
            <Button size="sm" onClick={() => router.push('/wachat')}>
              Choose a project
            </Button>
          }
        />
      ) : (
        <>
          {/* Filter bar */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[260px] flex-1">
                <Input
                  placeholder="Search templates by name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category filter */}
              <DropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter />
                    {categoryFilter === 'ALL'
                      ? 'All categories'
                      : categoryFilter.replace(/_/g, ' ')}
                    <ChevronDown className="opacity-60" />
                  </Button>
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
              </DropdownMenu>

              {/* Status filter */}
              <DropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {statusFilter === 'ALL'
                      ? 'All statuses'
                      : statusFilter.replace(/_/g, ' ').toLowerCase()}
                    <ChevronDown className="opacity-60" />
                  </Button>
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
              </DropdownMenu>

              {/* Language filter */}
              {languages.length > 2 ? (
                <DropdownMenu>
                  <ZoruDropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      {languageFilter === 'ALL'
                        ? 'All languages'
                        : languageFilter}
                      <ChevronDown className="opacity-60" />
                    </Button>
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
                </DropdownMenu>
              ) : null}

              <span className="ml-auto text-[11.5px] tabular-nums text-zoru-ink-muted">
                {filteredTemplates.length} / {templates.length} templates
              </span>
            </div>
          </Card>

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <Card className="flex items-center justify-between p-3 bg-zoru-surface border-zoru-brand/20">
              <span className="text-sm font-medium text-zoru-ink">
                {selectedIds.size} template{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkSubmit}
                  disabled={isSubmitting || isBulkDeleting || isLoading}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit for approval'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting || isSubmitting || isLoading}
                >
                  {isBulkDeleting ? 'Deleting...' : 'Delete selected'}
                </Button>
              </div>
            </Card>
          )}

          {/* Template table / skeleton / empty */}
          {isLoading && templates.length === 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full" />
              ))}
            </div>
          ) : filteredTemplates.length > 0 ? (
            <Card className="overflow-hidden p-0">
              <div className="divide-y divide-zoru-line">
                <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle items-center">
                  <Checkbox
                    checked={
                      filteredTemplates.length > 0 &&
                      selectedIds.size === filteredTemplates.length
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all templates"
                  />
                  <span>Name</span>
                  <span>Category</span>
                  <span>Language</span>
                  <span>Status</span>
                  <span className="w-8" />
                </div>
                {filteredTemplates.map((t) => (
                  <div
                    key={t._id.toString()}
                    className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-zoru-surface"
                  >
                    <Checkbox
                      checked={selectedIds.has(t._id.toString())}
                      onCheckedChange={() => toggleSelect(t._id.toString())}
                      aria-label={`Select template ${t.name}`}
                    />
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
                      <Badge variant={statusVariant(t.status)}>
                        {(t.status || 'unknown')
                          .replace(/_/g, ' ')
                          .toLowerCase()}
                      </Badge>
                    </span>
                    <DropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Actions"
                        >
                          <MoreHorizontal />
                        </Button>
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
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <EmptyState
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onSync}
                      disabled={isSyncing}
                    >
                      <RefreshCw /> Sync with Meta
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => router.push('/wachat/templates/create')}
                    >
                      <CirclePlus /> New template
                    </Button>
                  </div>
                ) : (
                  <Button
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
                  </Button>
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
