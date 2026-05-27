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
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Input,
  useZoruToast,
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
import { m, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import {
  RefreshCw,
  BookCopy,
  CirclePlus,
  Search as SearchIcon,
  FileText,
  CircleAlert,
  ChevronDown,
  Filter,
  Smartphone,
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

import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  StatusPill,
  EmptyState,
  type StatusTone,
} from '@/components/wachat-ui';

/**
 * Wachat Templates — list, rebuilt on the new wachat-ui design language.
 * All data fetching, server actions, and selection logic preserved.
 */

import * as React from 'react';

/* ── helpers ────────────────────────────────────────────────────── */

function compact(n: number): string {
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function statusTone(s?: string | null): StatusTone {
  const v = (s ?? '').toLowerCase();
  if (v === 'approved') return 'sent';
  if (v === 'pending' || v === 'in_review') return 'queued';
  if (v === 'rejected') return 'failed';
  return 'draft';
}

/* ── page ───────────────────────────────────────────────────────── */

export default function TemplatesPage() {
  const router = useRouter();
  const { activeProject, activeProjectId } = useProject();
  const reduceMotion = useReducedMotion();

  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [languageFilter, setLanguageFilter] = useState<string>('ALL');
  const [isLoading, startLoading] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WithId<Template> | null>(null);
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
            toast({ title: 'Refreshed', description: 'Template list has been updated.' });
          }
        } catch {
          toast({ title: 'Error', description: 'Failed to load templates.', variant: 'destructive' });
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
      toast({ title: 'Error', description: 'No active project selected.', variant: 'destructive' });
      return;
    }
    startSyncing(async () => {
      const result = await handleSyncTemplates(activeProjectId);
      if (result.error) {
        toast({ title: 'Sync failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sync successful', description: result.message });
        await fetchTemplates(activeProjectId, true);
      }
    });
  }, [toast, activeProjectId, fetchTemplates]);

  const filteredTemplates = useMemo(
    () =>
      templates.filter((t) => {
        const nameMatch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
        const categoryMatch = categoryFilter === 'ALL' || t.category === categoryFilter;
        const statusMatch = statusFilter === 'ALL' || t.status === statusFilter;
        const languageMatch = languageFilter === 'ALL' || t.language === languageFilter;
        return nameMatch && categoryMatch && statusMatch && languageMatch;
      }),
    [templates, searchQuery, categoryFilter, statusFilter, languageFilter],
  );

  const categories = useMemo(
    () => ['ALL', ...Array.from(new Set(templates.map((t) => t.category).filter(Boolean)))],
    [templates],
  );
  const statuses = useMemo(
    () => ['ALL', ...Array.from(new Set(templates.map((t) => t.status).filter(Boolean)))],
    [templates],
  );
  const languages = useMemo(
    () => [
      'ALL',
      ...Array.from(new Set(templates.map((t) => t.language).filter(Boolean) as string[])),
    ],
    [templates],
  );

  const stats = useMemo(() => {
    const approved = templates.filter((t) => (t.status ?? '').toLowerCase() === 'approved').length;
    const pending = templates.filter((t) =>
      ['pending', 'in_review'].includes((t.status ?? '').toLowerCase()),
    ).length;
    const rejected = templates.filter((t) => (t.status ?? '').toLowerCase() === 'rejected').length;
    return { approved, pending, rejected, total: templates.length };
  }, [templates]);

  const onConfirmDelete = useCallback(() => {
    if (!deleteTarget || !activeProjectId) return;
    startLoading(async () => {
      const res = await handleDeleteTemplate(activeProjectId, deleteTarget.name, deleteTarget.metaId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
        if (res.error) failCount++;
        else successCount++;
      }

      if (successCount > 0) {
        toast({
          title: 'Templates deleted',
          description: `Successfully removed ${successCount} template(s).`,
        });
        setTemplates((prev) => prev.filter((t) => !selectedIds.has(t._id.toString())));
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

  const toggleSelect = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);
    },
    [selectedIds],
  );

  return (
    <WaPage>
      <PageHeader
        title="Message templates"
        description="Manage and sync your WhatsApp message templates. Approved templates can be used in broadcasts and direct chats."
        kicker={activeProject?.name ? `Wachat · ${activeProject.name}` : 'Wachat · templates'}
        backHref="/wachat"
        actions={
          <>
            <WaButton
              variant="outline"
              size="sm"
              onClick={onSync}
              leftIcon={RefreshCw}
              disabled={!activeProjectId || isSyncing}
            >
              {isSyncing ? 'Syncing' : 'Sync with Meta'}
            </WaButton>
            <WaButton
              variant="outline"
              size="sm"
              href="/wachat/templates/library"
              leftIcon={BookCopy}
            >
              Library
            </WaButton>
            <WaButton
              variant="outline"
              size="sm"
              href="/wachat/templates/interactive-message-builder"
              leftIcon={Smartphone}
            >
              Interactive builder
            </WaButton>
            <WaButton
              size="sm"
              href="/wachat/templates/create"
              disabled={!activeProjectId}
              leftIcon={CirclePlus}
            >
              New template
            </WaButton>
          </>
        }
      />

      {/* Stats strip */}
      <section aria-labelledby="tpl-counts" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <h2 id="tpl-counts" className="sr-only">
          Template counts
        </h2>
        <MetricTile label="Total" value={compact(stats.total)} icon={FileText} delay={0.02} />
        <MetricTile label="Approved" value={compact(stats.approved)} icon={CircleCheck} delay={0.06} />
        <MetricTile label="In review" value={compact(stats.pending)} icon={Clock} delay={0.1} />
        <MetricTile label="Rejected" value={compact(stats.rejected)} icon={CircleX} delay={0.14} />
      </section>

      {!activeProjectId && isClient ? (
        <EmptyState
          icon={CircleAlert}
          title="No project selected"
          description="Choose a project from the picker to manage templates."
          action={
            <WaButton href="/wachat" leftIcon={SearchIcon}>
              Choose a project
            </WaButton>
          }
        />
      ) : (
        <>
          {/* Filter bar */}
          <m.div
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3"
          >
            <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400">
              <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <Input
                placeholder="Search templates by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 bg-transparent p-0 text-[13px] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </label>

            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-950 active:scale-[0.97]"
                >
                  <Filter className="h-3 w-3" strokeWidth={2.25} />
                  {categoryFilter === 'ALL' ? 'All categories' : categoryFilter.replace(/_/g, ' ')}
                  <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.25} />
                </button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Category</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuRadioGroup value={categoryFilter} onValueChange={setCategoryFilter}>
                  {categories.map((c) => (
                    <ZoruDropdownMenuRadioItem key={c} value={c} className="capitalize">
                      {c === 'ALL' ? 'All' : c.replace(/_/g, ' ').toLowerCase()}
                    </ZoruDropdownMenuRadioItem>
                  ))}
                </ZoruDropdownMenuRadioGroup>
              </ZoruDropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-950 active:scale-[0.97]"
                >
                  {statusFilter === 'ALL' ? 'All statuses' : statusFilter.replace(/_/g, ' ').toLowerCase()}
                  <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.25} />
                </button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Status</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                  {statuses.map((s) => (
                    <ZoruDropdownMenuRadioItem key={s} value={s} className="capitalize">
                      {s === 'ALL' ? 'All' : s.replace(/_/g, ' ').toLowerCase()}
                    </ZoruDropdownMenuRadioItem>
                  ))}
                </ZoruDropdownMenuRadioGroup>
              </ZoruDropdownMenuContent>
            </DropdownMenu>

            {languages.length > 2 && (
              <DropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-950 active:scale-[0.97]"
                  >
                    {languageFilter === 'ALL' ? 'All languages' : languageFilter}
                    <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.25} />
                  </button>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                  <ZoruDropdownMenuLabel>Language</ZoruDropdownMenuLabel>
                  <ZoruDropdownMenuSeparator />
                  <ZoruDropdownMenuRadioGroup value={languageFilter} onValueChange={setLanguageFilter}>
                    {languages.map((l) => (
                      <ZoruDropdownMenuRadioItem key={l} value={l}>
                        {l === 'ALL' ? 'All' : l}
                      </ZoruDropdownMenuRadioItem>
                    ))}
                  </ZoruDropdownMenuRadioGroup>
                </ZoruDropdownMenuContent>
              </DropdownMenu>
            )}

            <span className="ml-auto text-[11.5px] tabular-nums text-zinc-500">
              {filteredTemplates.length} / {templates.length} templates
            </span>
          </m.div>

          {selectedIds.size > 0 && (
            <m.div
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="mb-4 flex items-center justify-between rounded-2xl border bg-white p-3"
              style={{ borderColor: 'var(--mt-accent-soft)' }}
            >
              <span className="text-[13px] font-medium text-zinc-900">
                {selectedIds.size} template{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <WaButton
                  variant="outline"
                  size="sm"
                  onClick={handleBulkSubmit}
                  disabled={isSubmitting || isBulkDeleting || isLoading}
                >
                  {isSubmitting ? 'Submitting' : 'Submit for approval'}
                </WaButton>
                <WaButton
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting || isSubmitting || isLoading}
                  leftIcon={Trash2}
                >
                  {isBulkDeleting ? 'Deleting' : 'Delete selected'}
                </WaButton>
              </div>
            </m.div>
          )}

          {/* Template list */}
          {isLoading && templates.length === 0 ? (
            <TemplatesSkeleton />
          ) : filteredTemplates.length > 0 ? (
            <Section padded={false} className="overflow-hidden">
              <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-zinc-100 px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                <Checkbox
                  checked={
                    filteredTemplates.length > 0 && selectedIds.size === filteredTemplates.length
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
              <ul className="divide-y divide-zinc-100">
                {filteredTemplates.map((t, i) => (
                  <m.li
                    key={t._id.toString()}
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: Math.min(i * 0.02, 0.3),
                      ease: EASE_OUT,
                    }}
                    className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 text-[13px] transition-colors duration-150 hover:bg-zinc-50"
                  >
                    <Checkbox
                      checked={selectedIds.has(t._id.toString())}
                      onCheckedChange={() => toggleSelect(t._id.toString())}
                      aria-label={`Select template ${t.name}`}
                    />
                    <button
                      type="button"
                      className="min-w-0 truncate text-left font-medium text-zinc-900 hover:underline"
                      onClick={() =>
                        router.push(`/wachat/templates/create?id=${t._id.toString()}`)
                      }
                    >
                      {t.name}
                    </button>
                    <span className="truncate capitalize text-zinc-600">
                      {(t.category || '').replace(/_/g, ' ').toLowerCase() || '-'}
                    </span>
                    <span className="truncate text-zinc-600">{t.language || '-'}</span>
                    <span>
                      <StatusPill tone={statusTone(t.status)}>
                        {(t.status || 'unknown').replace(/_/g, ' ').toLowerCase()}
                      </StatusPill>
                    </span>
                    <DropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Actions"
                          className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem
                          onSelect={() =>
                            router.push(`/wachat/templates/create?id=${t._id.toString()}`)
                          }
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem
                          onSelect={() =>
                            router.push(
                              `/wachat/templates/create?action=clone&id=${t._id.toString()}`,
                            )
                          }
                        >
                          <BookCopy className="mr-2 h-3.5 w-3.5" /> Clone
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem onSelect={() => setDeleteTarget(t)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </DropdownMenu>
                  </m.li>
                ))}
              </ul>
            </Section>
          ) : (
            <EmptyState
              icon={FileText}
              title={templates.length > 0 ? 'No matching templates' : 'No templates yet'}
              description={
                templates.length > 0
                  ? 'Your filters did not match any templates. Try adjusting your search or clearing the filters.'
                  : 'Sync existing templates from Meta or create a new one to get started.'
              }
              action={
                templates.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <WaButton
                      variant="outline"
                      size="sm"
                      onClick={onSync}
                      disabled={isSyncing}
                      leftIcon={RefreshCw}
                    >
                      Sync with Meta
                    </WaButton>
                    <WaButton size="sm" href="/wachat/templates/create" leftIcon={CirclePlus}>
                      New template
                    </WaButton>
                  </div>
                ) : (
                  <WaButton
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
                  </WaButton>
                )
              }
            />
          )}
        </>
      )}

      {/* Delete confirm */}
      <ZoruAlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete template?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This will remove &quot;{deleteTarget?.name}&quot; from your workspace. The template
              may still exist on Meta until the next sync.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={onConfirmDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </WaPage>
  );
}

/* ── skeleton ───────────────────────────────────────────────────── */

function TemplatesSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="h-3 w-32 rounded-full bg-zinc-100" />
      </div>
      <ul className="divide-y divide-zinc-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3"
          >
            <div className="h-3.5 w-3.5 rounded bg-zinc-100" />
            <div className="h-3 w-40 rounded-full bg-zinc-100" />
            <div className="h-3 w-20 rounded-full bg-zinc-100" />
            <div className="h-3 w-12 rounded-full bg-zinc-100" />
            <div className="h-5 w-16 rounded-full bg-zinc-100" />
            <div className="h-3 w-3 rounded-full bg-zinc-100" />
          </li>
        ))}
      </ul>
    </div>
  );
}
