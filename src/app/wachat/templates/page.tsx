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
import { m, useReducedMotion, AnimatePresence } from 'motion/react';
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
  PauseCircle,
  Languages,
  Tag,
  Type as TypeIcon,
  Image as ImageIcon,
  Video,
  Layers,
  MessageSquare,
  Hash,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
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

import * as React from 'react';

/**
 * Wachat Templates - list, rebuilt on the new wachat-ui design language.
 * All data fetching, server actions, and selection logic preserved.
 *
 * Density layer: 6-tile KPI strip, collapsible filter rail (status, category,
 * language, header type), dual list/grid view, and per-template structure
 * digest (header type, body length, var count, button count, footer) derived
 * directly from `components` - no fake metrics.
 */

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
  if (v === 'paused' || v === 'paused_high_quality' || v === 'flagged') return 'paused';
  return 'draft';
}

function getBody(t: Template): string {
  if (t.body) return t.body;
  const bc = t.components?.find?.((c: any) => c?.type === 'BODY');
  return bc?.text ?? '';
}

function getHeader(t: Template): { format: string; preview?: string } {
  const hc = t.components?.find?.((c: any) => c?.type === 'HEADER');
  if (!hc) return { format: 'NONE' };
  return { format: (hc.format || 'TEXT').toUpperCase(), preview: hc.text };
}

function getFooter(t: Template): string {
  const fc = t.components?.find?.((c: any) => c?.type === 'FOOTER');
  return fc?.text ?? '';
}

function getButtons(t: Template): any[] {
  const bc = t.components?.find?.((c: any) => c?.type === 'BUTTONS');
  return bc?.buttons ?? [];
}

function varCount(body: string): number {
  return (body.match(/{{\s*\d+\s*}}/g) || []).length;
}

function languageLabel(code?: string | null): string {
  if (!code) return '-';
  const map: Record<string, string> = {
    en_US: 'EN-US', en: 'EN', hi: 'HI', es: 'ES', fr: 'FR', de: 'DE',
    pt_BR: 'PT-BR', ar: 'AR', it: 'IT', ja: 'JA', ko: 'KO',
    zh_CN: 'ZH-CN', ru: 'RU', tr: 'TR', nl: 'NL', id: 'ID',
  };
  return map[code] ?? code.toUpperCase();
}

const HEADER_ICON: Record<string, React.ComponentType<any>> = {
  NONE: Hash,
  TEXT: TypeIcon,
  IMAGE: ImageIcon,
  VIDEO: Video,
  DOCUMENT: FileText,
  LOCATION: Layers,
};

function timeAgo(d?: Date | string | null): string {
  if (!d) return 'no date';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return 'no date';
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.floor(h / 24);
  if (d2 < 7) return `${d2}d ago`;
  const w = Math.floor(d2 / 7);
  if (w < 5) return `${w}w ago`;
  return date.toLocaleDateString();
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
  const [headerFilter, setHeaderFilter] = useState<string>('ALL');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [railOpen, setRailOpen] = useState(true);
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
        const headerMatch = headerFilter === 'ALL' || getHeader(t).format === headerFilter;
        return nameMatch && categoryMatch && statusMatch && languageMatch && headerMatch;
      }),
    [templates, searchQuery, categoryFilter, statusFilter, languageFilter, headerFilter],
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
  const headerTypes = useMemo(
    () => ['ALL', ...Array.from(new Set(templates.map((t) => getHeader(t).format)))],
    [templates],
  );

  const stats = useMemo(() => {
    const approved = templates.filter((t) => (t.status ?? '').toLowerCase() === 'approved').length;
    const pending = templates.filter((t) =>
      ['pending', 'in_review'].includes((t.status ?? '').toLowerCase()),
    ).length;
    const rejected = templates.filter((t) => (t.status ?? '').toLowerCase() === 'rejected').length;
    const paused = templates.filter((t) =>
      ['paused', 'paused_high_quality', 'flagged'].includes((t.status ?? '').toLowerCase()),
    ).length;
    const withMedia = templates.filter((t) => {
      const f = getHeader(t).format;
      return f === 'IMAGE' || f === 'VIDEO' || f === 'DOCUMENT';
    }).length;
    const withButtons = templates.filter((t) => getButtons(t).length > 0).length;
    return {
      total: templates.length,
      approved,
      pending,
      rejected,
      paused,
      withMedia,
      withButtons,
    };
  }, [templates]);

  // Facet counts for rail
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of templates) m.set(t.category, (m.get(t.category) ?? 0) + 1);
    return m;
  }, [templates]);
  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of templates) m.set(t.status, (m.get(t.status) ?? 0) + 1);
    return m;
  }, [templates]);
  const languageCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of templates) if (t.language) m.set(t.language, (m.get(t.language) ?? 0) + 1);
    return m;
  }, [templates]);
  const headerCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of templates) {
      const f = getHeader(t).format;
      m.set(f, (m.get(f) ?? 0) + 1);
    }
    return m;
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

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setLanguageFilter('ALL');
    setHeaderFilter('ALL');
  }, []);

  const activeFilterCount =
    (categoryFilter !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0) +
    (languageFilter !== 'ALL' ? 1 : 0) +
    (headerFilter !== 'ALL' ? 1 : 0);

  return (
    <WaPage>
      <PageHeader
        title="Message templates"
        description="Manage, sync, and audit WhatsApp Cloud API templates across this project. Approved templates can be used in broadcasts and direct chats."
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

      {/* KPI strip - 6 tiles */}
      <section aria-labelledby="tpl-counts" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <h2 id="tpl-counts" className="sr-only">Template counts</h2>
        <MetricTile label="Total" value={compact(stats.total)} icon={FileText} delay={0.02} />
        <MetricTile label="Approved" value={compact(stats.approved)} icon={CircleCheck} delay={0.05} />
        <MetricTile label="In review" value={compact(stats.pending)} icon={Clock} delay={0.08} />
        <MetricTile label="Rejected" value={compact(stats.rejected)} icon={CircleX} delay={0.11} />
        <MetricTile label="Paused" value={compact(stats.paused)} icon={PauseCircle} delay={0.14} />
        <MetricTile label="With media" value={compact(stats.withMedia)} icon={ImageIcon} delay={0.17} />
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
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          {/* Filter rail */}
          <aside className={`${railOpen ? 'block' : 'hidden lg:block'} space-y-3`}>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <header className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  <Filter className="h-3 w-3" strokeWidth={2.25} />
                  Filters
                </span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[10.5px] font-semibold uppercase tracking-[0.04em]"
                    style={{ color: 'var(--mt-accent)' }}
                  >
                    Clear ({activeFilterCount})
                  </button>
                )}
              </header>

              <FacetGroup
                title="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                items={statuses.map((s) => ({
                  value: s,
                  label: s === 'ALL' ? 'All statuses' : s.replace(/_/g, ' ').toLowerCase(),
                  count: s === 'ALL' ? stats.total : statusCounts.get(s) ?? 0,
                }))}
              />
              <FacetGroup
                title="Category"
                value={categoryFilter}
                onChange={setCategoryFilter}
                items={categories.map((c) => ({
                  value: c,
                  label: c === 'ALL' ? 'All categories' : c.replace(/_/g, ' ').toLowerCase(),
                  count: c === 'ALL' ? stats.total : categoryCounts.get(c) ?? 0,
                }))}
              />
              <FacetGroup
                title="Header type"
                value={headerFilter}
                onChange={setHeaderFilter}
                items={headerTypes.map((h) => ({
                  value: h,
                  label: h === 'ALL' ? 'All headers' : h.toLowerCase(),
                  count: h === 'ALL' ? stats.total : headerCounts.get(h) ?? 0,
                }))}
              />
              {languages.length > 2 && (
                <FacetGroup
                  title="Language"
                  value={languageFilter}
                  onChange={setLanguageFilter}
                  items={languages.map((l) => ({
                    value: l,
                    label: l === 'ALL' ? 'All languages' : languageLabel(l),
                    count: l === 'ALL' ? stats.total : languageCounts.get(l) ?? 0,
                  }))}
                />
              )}
            </div>

            {/* Quick structure summary */}
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                Composition
              </p>
              <dl className="space-y-1.5 text-[11.5px]">
                <RailStat icon={MessageSquare} label="With buttons" value={`${stats.withButtons}`} total={stats.total} />
                <RailStat icon={ImageIcon} label="With media" value={`${stats.withMedia}`} total={stats.total} />
                <RailStat icon={Languages} label="Languages" value={`${Math.max(0, languages.length - 1)}`} />
                <RailStat icon={Tag} label="Categories" value={`${Math.max(0, categories.length - 1)}`} />
              </dl>
            </div>
          </aside>

          {/* Main column */}
          <div className="min-w-0 space-y-3">
            {/* Toolbar */}
            <m.div
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2.5"
            >
              <button
                type="button"
                onClick={() => setRailOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-950 active:scale-[0.97] lg:hidden"
              >
                <Filter className="h-3 w-3" strokeWidth={2.25} />
                {railOpen ? 'Hide filters' : 'Filters'}
              </button>

              <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400">
                <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
                <Input
                  placeholder="Search templates by name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-0 bg-transparent p-0 text-[13px] focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </label>

              <div className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-pressed={view === 'grid'}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                  style={{
                    color: view === 'grid' ? '#ffffff' : '#52525b',
                    background: view === 'grid' ? 'var(--mt-accent)' : 'transparent',
                  }}
                >
                  <LayoutGrid className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  aria-pressed={view === 'list'}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                  style={{
                    color: view === 'list' ? '#ffffff' : '#52525b',
                    background: view === 'list' ? 'var(--mt-accent)' : 'transparent',
                  }}
                >
                  <ListIcon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                </button>
              </div>

              <span className="ml-auto text-[11.5px] tabular-nums text-zinc-500">
                {filteredTemplates.length} / {templates.length}
              </span>
            </m.div>

            {/* Bulk action bar */}
            <AnimatePresence initial={false}>
              {selectedIds.size > 0 && (
                <m.div
                  layout
                  initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-2.5"
                  style={{ borderColor: 'var(--mt-accent-soft)' }}
                >
                  <span className="text-[12.5px] font-medium text-zinc-900">
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
            </AnimatePresence>

            {/* Body */}
            {isLoading && templates.length === 0 ? (
              view === 'grid' ? <TemplateGridSkeleton /> : <TemplatesSkeleton />
            ) : filteredTemplates.length > 0 ? (
              view === 'grid' ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTemplates.map((t, i) => (
                    <TemplateCard
                      key={t._id.toString()}
                      template={t}
                      index={i}
                      selected={selectedIds.has(t._id.toString())}
                      onToggleSelect={toggleSelect}
                      onEdit={() => router.push(`/wachat/templates/create?id=${t._id.toString()}`)}
                      onClone={() => router.push(`/wachat/templates/create?action=clone&id=${t._id.toString()}`)}
                      onDelete={() => setDeleteTarget(t)}
                      reduceMotion={reduceMotion}
                    />
                  ))}
                </div>
              ) : (
                <Section padded={false} className="overflow-hidden">
                  <div className="grid grid-cols-[auto_2fr_1fr_0.7fr_0.9fr_1fr_auto] items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    <Checkbox
                      checked={
                        filteredTemplates.length > 0 && selectedIds.size === filteredTemplates.length
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all templates"
                    />
                    <span>Name / Body</span>
                    <span>Category</span>
                    <span>Lang</span>
                    <span>Structure</span>
                    <span>Status</span>
                    <span className="w-8" />
                  </div>
                  <ul className="divide-y divide-zinc-100">
                    {filteredTemplates.map((t, i) => {
                      const body = getBody(t);
                      const header = getHeader(t);
                      const buttons = getButtons(t);
                      const vc = varCount(body);
                      const HeaderIcon = HEADER_ICON[header.format] ?? Hash;
                      return (
                        <m.li
                          key={t._id.toString()}
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: Math.min(i * 0.03, 0.3),
                            ease: EASE_OUT,
                          }}
                          className="grid grid-cols-[auto_2fr_1fr_0.7fr_0.9fr_1fr_auto] items-center gap-3 px-4 py-2.5 text-[12.5px] transition-colors duration-150 hover:bg-zinc-50"
                        >
                          <Checkbox
                            checked={selectedIds.has(t._id.toString())}
                            onCheckedChange={() => toggleSelect(t._id.toString())}
                            aria-label={`Select template ${t.name}`}
                          />
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="block truncate text-left font-medium text-zinc-900 hover:underline"
                              onClick={() => router.push(`/wachat/templates/create?id=${t._id.toString()}`)}
                            >
                              {t.name}
                            </button>
                            <p className="truncate text-[11px] text-zinc-500">
                              {body || 'No body'}
                            </p>
                          </div>
                          <span className="truncate capitalize text-zinc-600">
                            {(t.category || '').replace(/_/g, ' ').toLowerCase() || '-'}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-600">
                            {languageLabel(t.language)}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                            <HeaderIcon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                            <span className="tabular-nums">{body.length}c</span>
                            {vc > 0 && (
                              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 tabular-nums">
                                {vc}v
                              </span>
                            )}
                            {buttons.length > 0 && (
                              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 tabular-nums">
                                {buttons.length}b
                              </span>
                            )}
                          </div>
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
                                onSelect={() => router.push(`/wachat/templates/create?id=${t._id.toString()}`)}
                              >
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuItem
                                onSelect={() => router.push(`/wachat/templates/create?action=clone&id=${t._id.toString()}`)}
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
                      );
                    })}
                  </ul>
                </Section>
              )
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
                    <WaButton variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </WaButton>
                  )
                }
              />
            )}
          </div>
        </div>
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

/* ── facet group ────────────────────────────────────────────────── */

interface FacetItem { value: string; label: string; count: number }
function FacetGroup({
  title,
  value,
  onChange,
  items,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  items: FacetItem[];
}) {
  return (
    <div className="border-b border-zinc-100 px-3 py-2.5 last:border-b-0">
      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((it) => {
          const isActive = value === it.value;
          return (
            <li key={it.value}>
              <button
                type="button"
                onClick={() => onChange(it.value)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-[11.5px] transition-colors duration-100 hover:bg-zinc-50"
                style={isActive ? { background: 'var(--mt-accent-soft)' } : undefined}
              >
                <span
                  className={`truncate capitalize ${isActive ? 'font-semibold' : 'text-zinc-700'}`}
                  style={isActive ? { color: 'var(--mt-accent)' } : undefined}
                >
                  {it.label}
                </span>
                <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-600">
                  {it.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RailStat({
  icon: Icon,
  label,
  value,
  total,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
  total?: number;
}) {
  const pct = total && total > 0 ? Math.round((Number(value) / total) * 100) : null;
  return (
    <div className="flex items-center justify-between gap-2 text-[11.5px]">
      <span className="inline-flex items-center gap-1.5 text-zinc-600">
        <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        {label}
      </span>
      <span className="tabular-nums text-zinc-900">
        {value}
        {pct !== null && <span className="ml-1 text-zinc-400">· {pct}%</span>}
      </span>
    </div>
  );
}

/* ── template card (grid view) ──────────────────────────────────── */

function TemplateCard({
  template,
  index,
  selected,
  onToggleSelect,
  onEdit,
  onClone,
  onDelete,
  reduceMotion,
}: {
  template: WithId<Template>;
  index: number;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
  reduceMotion: boolean | null;
}) {
  const id = template._id.toString();
  const body = getBody(template);
  const header = getHeader(template);
  const footer = getFooter(template);
  const buttons = getButtons(template);
  const vc = varCount(body);
  const HeaderIcon = HEADER_ICON[header.format] ?? Hash;
  const stagger = Math.min(index * 0.03, 0.4);

  return (
    <m.article
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: stagger, ease: EASE_OUT }}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-[transform,box-shadow] duration-200 hover:-translate-y-[1px]"
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 14px 32px -22px var(--mt-accent-glow)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <header className="flex items-start gap-2 border-b border-zinc-100 px-3.5 py-2.5">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(id)}
          aria-label={`Select ${template.name}`}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onEdit}
            className="block w-full truncate text-left text-[12.5px] font-semibold text-zinc-950 hover:underline"
          >
            {template.name}
          </button>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] tabular-nums text-zinc-500">
            <Clock className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
            updated {timeAgo(template.createdAt)}
          </p>
        </div>
        <DropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Actions"
              className="grid h-6 w-6 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
            >
              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </ZoruDropdownMenuTrigger>
          <ZoruDropdownMenuContent align="end">
            <ZoruDropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
            </ZoruDropdownMenuItem>
            <ZoruDropdownMenuItem onSelect={onClone}>
              <BookCopy className="mr-2 h-3.5 w-3.5" /> Clone
            </ZoruDropdownMenuItem>
            <ZoruDropdownMenuSeparator />
            <ZoruDropdownMenuItem onSelect={onDelete}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </ZoruDropdownMenuItem>
          </ZoruDropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 px-3.5 py-2">
        <StatusPill tone={statusTone(template.status)}>
          {(template.status || 'unknown').replace(/_/g, ' ').toLowerCase()}
        </StatusPill>
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-zinc-700">
          <Tag className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
          {(template.category || '').replace(/_/g, ' ').toLowerCase()}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-700">
          <Languages className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
          {languageLabel(template.language)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-zinc-700">
          <HeaderIcon className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
          {header.format.toLowerCase()}
        </span>
      </div>

      {/* Body preview */}
      <div className="flex-1 px-3.5 py-3">
        {header.format === 'TEXT' && header.preview && (
          <p className="mb-1.5 line-clamp-1 text-[11.5px] font-semibold text-zinc-900">
            {header.preview}
          </p>
        )}
        <p className="line-clamp-3 text-[11.5px] leading-relaxed text-zinc-600">
          {body || <span className="italic text-zinc-400">No body</span>}
        </p>
        {footer && (
          <p className="mt-1.5 line-clamp-1 text-[10.5px] text-zinc-400">{footer}</p>
        )}

        {buttons.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {buttons.slice(0, 3).map((b: any, i: number) => (
              <span
                key={i}
                className="truncate rounded-md border bg-white px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ borderColor: 'var(--mt-accent-soft)', color: 'var(--mt-accent)', maxWidth: 110 }}
              >
                {b.text || `Button ${i + 1}`}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats strip */}
      <footer className="grid grid-cols-4 divide-x divide-zinc-100 border-t border-zinc-100 bg-zinc-50/50 text-center">
        <CardStat label="chars" value={`${body.length}`} />
        <CardStat label="vars" value={`${vc}`} />
        <CardStat label="btns" value={`${buttons.length}`} />
        <CardStat label="lim" value={`${Math.max(0, 1024 - body.length)}`} />
      </footer>

      <button
        type="button"
        onClick={onEdit}
        className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-zinc-100 bg-white/0 px-3.5 py-2 text-[11px] font-semibold opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{ color: 'var(--mt-accent)' }}
      >
        Open template
        <ChevronRight className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      </button>
    </m.article>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1.5">
      <p className="text-[12px] font-semibold tabular-nums text-zinc-900">{value}</p>
      <p className="text-[9.5px] uppercase tracking-[0.06em] text-zinc-500">{label}</p>
    </div>
  );
}

/* ── skeletons ──────────────────────────────────────────────────── */

function TemplatesSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-2.5">
        <div className="h-3 w-32 rounded-full bg-zinc-100" />
      </div>
      <ul className="divide-y divide-zinc-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="grid grid-cols-[auto_2fr_1fr_0.7fr_0.9fr_1fr_auto] items-center gap-3 px-4 py-2.5"
          >
            <div className="h-3.5 w-3.5 rounded bg-zinc-100" />
            <div className="space-y-1">
              <div className="h-3 w-40 rounded-full bg-zinc-100" />
              <div className="h-2 w-56 rounded-full bg-zinc-100/70" />
            </div>
            <div className="h-3 w-20 rounded-full bg-zinc-100" />
            <div className="h-3 w-10 rounded-full bg-zinc-100" />
            <div className="h-3 w-16 rounded-full bg-zinc-100" />
            <div className="h-5 w-16 rounded-full bg-zinc-100" />
            <div className="h-3 w-3 rounded-full bg-zinc-100" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TemplateGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-56 animate-pulse rounded-xl border border-zinc-200 bg-white"
        />
      ))}
    </div>
  );
}
