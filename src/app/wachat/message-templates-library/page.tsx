'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  useZoruToast,
} from '@/components/zoruui';
import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import { m, useReducedMotion, AnimatePresence } from 'motion/react';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import {
  CircleX,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  Search as SearchIcon,
  Filter,
  Library as LibraryIcon,
  FolderOpen,
  Archive as ArchiveIcon,
  FileEdit,
  Languages as LanguagesIcon,
  Tag,
  Type as TypeIcon,
  Image as ImageIcon,
  Video,
  FileText,
  Hash,
  Layers,
  Trash2,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getTemplates, saveLibraryTemplate } from '@/app/actions/template.actions';
import { premadeTemplates } from '@/lib/premade-templates';
import { useRouter } from 'next/navigation';

import {
  WaPage,
  PageHeader,
  WaButton,
  TemplatePreview,
  EmptyState,
  MetricTile,
  type StatusTone,
} from '@/components/wachat-ui';

import * as React from 'react';

const TONE_MAP: Record<string, StatusTone> = {
  UTILITY: 'sending',
  MARKETING: 'sent',
  AUTHENTICATION: 'queued',
};

type LibraryRow = {
  id: string;
  name: string;
  category: string;
  body: string;
  language?: string;
  status?: string;
  headerFormat: string;
  buttonCount: number;
  varCount: number;
  bodyLength: number;
  createdAt?: Date;
};

type TabId = 'project' | 'library' | 'drafts' | 'archive';

const DRAFTS_STORAGE_KEY = 'wachat_template_drafts';
const ARCHIVE_STORAGE_KEY = 'wachat_template_archive';

/* ── helpers ────────────────────────────────────────────────── */

function headerFormat(t: any): string {
  const hc = t?.components?.find?.((c: any) => c?.type === 'HEADER');
  return (hc?.format ?? 'NONE').toUpperCase();
}

function buttonCount(t: any): number {
  return (t?.components?.find?.((c: any) => c?.type === 'BUTTONS')?.buttons ?? []).length;
}

function varCount(body: string): number {
  return (body?.match(/{{\s*\d+\s*}}/g) ?? []).length;
}

function languageLabel(code?: string | null): string {
  if (!code) return '-';
  return code.toUpperCase().replace('_', '-');
}

function rowFrom(t: any): LibraryRow {
  const body =
    t?.components?.find?.((c: any) => c?.type === 'BODY')?.text || t?.body || '-';
  return {
    id: String(t._id ?? t.name + Math.random()),
    name: t.name,
    category: t.category || 'UTILITY',
    body,
    language: t.language,
    status: t.status,
    headerFormat: headerFormat(t),
    buttonCount: buttonCount(t),
    varCount: varCount(body),
    bodyLength: (body ?? '').length,
    createdAt: t.createdAt,
  };
}

/* ── page ───────────────────────────────────────────────────── */

export default function MessageTemplatesLibraryPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const reduceMotion = useReducedMotion();
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [projectTemplates, setProjectTemplates] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [archive, setArchive] = useState<any[]>([]);
  const [tab, setTab] = useState<TabId>('project');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cloneTarget, setCloneTarget] = useState<LibraryRow | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // filters per tab share these
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [headerFilter, setHeaderFilter] = useState<string>('ALL');
  const [languageFilter, setLanguageFilter] = useState<string>('ALL');
  const [railOpen, setRailOpen] = useState(true);

  /* ── load ─────────────────────────────────────────────── */
  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const tpls = await getTemplates(String(activeProject._id));
      setProjectTemplates(tpls ?? []);
    });
  }, [activeProject?._id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    try {
      const d = localStorage.getItem(DRAFTS_STORAGE_KEY);
      if (d) setDrafts(JSON.parse(d));
      const a = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      if (a) setArchive(JSON.parse(a));
    } catch {}
  }, []);

  /* ── handlers ─────────────────────────────────────────── */
  const handleCopy = async (text: string, id: string, name: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: 'Copied', description: `"${name}" copied to clipboard.` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClone = (t: LibraryRow) => {
    const params = new URLSearchParams();
    params.set('cloneName', t.name);
    params.set('cloneCategory', t.category);
    params.set('cloneBody', t.body);
    router.push(`/wachat/template-builder?${params.toString()}`);
  };

  const handlePublish = async (t: LibraryRow) => {
    setPublishingId(t.id);
    const formData = new FormData();
    formData.append('name', t.name);
    formData.append('category', t.category);
    formData.append('language', t.language || 'en_US');
    formData.append('body', t.body);

    const sourceTpl = projectTemplates.find((pt) => String(pt._id) === t.id);
    if (sourceTpl?.components) {
      formData.append('components', JSON.stringify(sourceTpl.components));
    } else {
      formData.append('components', JSON.stringify([]));
    }

    const res = await saveLibraryTemplate(null, formData);
    setPublishingId(null);
    if (res?.error) {
      toast({ title: 'Error publishing', description: res.error, variant: 'destructive' });
    } else {
      toast({
        title: 'Published',
        description: 'Template successfully published to the community library.',
      });
      load();
    }
  };

  const moveToArchive = (t: LibraryRow) => {
    const sourceTpl = projectTemplates.find((pt) => String(pt._id) === t.id) ?? {
      name: t.name,
      category: t.category,
      body: t.body,
    };
    const next = [...archive, sourceTpl];
    setArchive(next);
    try {
      localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    toast({ title: 'Archived', description: `"${t.name}" moved to archive.` });
  };

  const removeDraft = (id: string) => {
    const next = drafts.filter((d) => String(d._id ?? d.name) !== id);
    setDrafts(next);
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const removeFromArchive = (id: string) => {
    const next = archive.filter((d) => String(d._id ?? d.name) !== id);
    setArchive(next);
    try {
      localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  /* ── rows per tab ─────────────────────────────────────── */
  const projectRows: LibraryRow[] = useMemo(
    () => projectTemplates.map(rowFrom),
    [projectTemplates],
  );
  const premadeRows: LibraryRow[] = useMemo(
    () => premadeTemplates.map((t: any) => rowFrom(t)),
    [],
  );
  const draftRows: LibraryRow[] = useMemo(() => drafts.map(rowFrom), [drafts]);
  const archiveRows: LibraryRow[] = useMemo(() => archive.map(rowFrom), [archive]);

  const tabs: { id: TabId; label: string; rows: LibraryRow[]; icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }> }[] = [
    { id: 'project', label: 'My templates', rows: projectRows, icon: FolderOpen },
    { id: 'library', label: 'Library', rows: premadeRows, icon: LibraryIcon },
    { id: 'drafts', label: 'Drafts', rows: draftRows, icon: FileEdit },
    { id: 'archive', label: 'Archive', rows: archiveRows, icon: ArchiveIcon },
  ];

  const currentRows = tabs.find((t) => t.id === tab)?.rows ?? [];

  /* ── filtering ───────────────────────────────────────── */
  const filtered = useMemo(
    () =>
      currentRows.filter((r) => {
        const q = search.toLowerCase();
        const nameMatch = !q || r.name.toLowerCase().includes(q) || r.body.toLowerCase().includes(q);
        const catMatch = categoryFilter === 'ALL' || r.category === categoryFilter;
        const headerMatch = headerFilter === 'ALL' || r.headerFormat === headerFilter;
        const langMatch = languageFilter === 'ALL' || r.language === languageFilter;
        return nameMatch && catMatch && headerMatch && langMatch;
      }),
    [currentRows, search, categoryFilter, headerFilter, languageFilter],
  );

  /* ── facets ──────────────────────────────────────────── */
  const facetCategories = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of currentRows) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [currentRows]);
  const facetHeaders = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of currentRows) m.set(r.headerFormat, (m.get(r.headerFormat) ?? 0) + 1);
    return m;
  }, [currentRows]);
  const facetLanguages = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of currentRows) if (r.language) m.set(r.language, (m.get(r.language) ?? 0) + 1);
    return m;
  }, [currentRows]);

  const categories = useMemo(
    () => ['ALL', ...Array.from(facetCategories.keys())],
    [facetCategories],
  );
  const headerTypes = useMemo(
    () => ['ALL', ...Array.from(facetHeaders.keys())],
    [facetHeaders],
  );
  const languages = useMemo(
    () => ['ALL', ...Array.from(facetLanguages.keys())],
    [facetLanguages],
  );

  /* ── tab KPIs ────────────────────────────────────────── */
  const kpis = useMemo(() => {
    const total = currentRows.length;
    const withButtons = currentRows.filter((r) => r.buttonCount > 0).length;
    const withMedia = currentRows.filter((r) =>
      ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(r.headerFormat),
    ).length;
    const withVars = currentRows.filter((r) => r.varCount > 0).length;
    const marketing = currentRows.filter((r) => r.category === 'MARKETING').length;
    const utility = currentRows.filter((r) => r.category === 'UTILITY').length;
    return { total, withButtons, withMedia, withVars, marketing, utility };
  }, [currentRows]);

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('ALL');
    setHeaderFilter('ALL');
    setLanguageFilter('ALL');
  };

  const activeFilterCount =
    (categoryFilter !== 'ALL' ? 1 : 0) +
    (headerFilter !== 'ALL' ? 1 : 0) +
    (languageFilter !== 'ALL' ? 1 : 0);

  /* ── grid render ─────────────────────────────────────── */

  const renderGrid = () => {
    if (isPending && currentRows.length === 0 && tab === 'project') {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl border border-zinc-200 bg-white"
            />
          ))}
        </div>
      );
    }
    if (filtered.length === 0) {
      const emptyCopy: Record<TabId, { title: string; desc: string }> = {
        project: {
          title: currentRows.length === 0 ? 'No templates in this project yet' : 'No matches',
          desc:
            currentRows.length === 0
              ? 'Sync templates from Meta or create one to populate this list.'
              : 'Adjust your search or filters to see results.',
        },
        library: {
          title: currentRows.length === 0 ? 'No premade templates' : 'No matches',
          desc: 'Try clearing filters or check back later.',
        },
        drafts: {
          title: 'No drafts saved',
          desc: 'Drafts saved from the builder will appear here.',
        },
        archive: {
          title: 'Archive is empty',
          desc: 'Archived templates appear here. They are stored locally on this device.',
        },
      };
      return (
        <EmptyState
          icon={CircleX}
          title={emptyCopy[tab].title}
          description={emptyCopy[tab].desc}
          action={
            activeFilterCount > 0 || search ? (
              <WaButton variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </WaButton>
            ) : undefined
          }
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t, i) => (
          <m.div
            key={t.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              delay: Math.min(i * 0.03, 0.4),
              ease: EASE_OUT,
            }}
            className="flex flex-col gap-2.5"
          >
            <TemplatePreview
              name={t.name.replace(/_/g, ' ')}
              body={t.body}
              status={TONE_MAP[t.category] || 'draft'}
              footer={
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 font-semibold uppercase tracking-[0.04em] text-zinc-600">
                    <Tag className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
                    {t.category.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  {t.language && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 font-semibold uppercase tracking-[0.04em] text-zinc-600">
                      <LanguagesIcon className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
                      {languageLabel(t.language)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 font-semibold uppercase tracking-[0.04em] text-zinc-600">
                    {t.headerFormat === 'IMAGE' ? <ImageIcon className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden /> :
                     t.headerFormat === 'VIDEO' ? <Video className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden /> :
                     t.headerFormat === 'DOCUMENT' ? <FileText className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden /> :
                     <TypeIcon className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />}
                    {t.headerFormat.toLowerCase()}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono font-semibold text-zinc-600">
                    {t.bodyLength}c
                  </span>
                  {t.varCount > 0 && (
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono font-semibold text-zinc-600">
                      {t.varCount}v
                    </span>
                  )}
                  {t.buttonCount > 0 && (
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono font-semibold text-zinc-600">
                      {t.buttonCount}b
                    </span>
                  )}
                </div>
              }
            />
            <div className="flex flex-wrap items-center gap-2">
              <WaButton
                size="sm"
                variant="outline"
                onClick={() => handleCopy(t.body, t.id, t.name)}
                leftIcon={copiedId === t.id ? Check : Copy}
              >
                {copiedId === t.id ? 'Copied' : 'Copy'}
              </WaButton>
              <WaButton size="sm" onClick={() => setCloneTarget(t)}>
                Use template
              </WaButton>
              {tab === 'project' && (
                <>
                  <WaButton
                    size="sm"
                    variant="outline"
                    onClick={() => handlePublish(t)}
                    disabled={publishingId === t.id}
                    leftIcon={publishingId === t.id ? Loader2 : Upload}
                  >
                    {publishingId === t.id ? 'Publishing' : 'Publish'}
                  </WaButton>
                  <button
                    type="button"
                    aria-label="Archive"
                    onClick={() => moveToArchive(t)}
                    className="ml-auto grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
                  >
                    <ArchiveIcon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </button>
                </>
              )}
              {tab === 'drafts' && (
                <button
                  type="button"
                  aria-label="Remove draft"
                  onClick={() => removeDraft(t.id)}
                  className="ml-auto grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                </button>
              )}
              {tab === 'archive' && (
                <button
                  type="button"
                  aria-label="Remove from archive"
                  onClick={() => removeFromArchive(t.id)}
                  className="ml-auto grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                </button>
              )}
            </div>
          </m.div>
        ))}
      </div>
    );
  };

  return (
    <WaPage>
      <PageHeader
        title="Message templates library"
        description="Browse your project templates, the premade library, drafts, and archive. Copy, clone, or publish across collections."
        kicker="Wachat · message library"
        backHref="/wachat/templates"
        actions={
          tab === 'project' && (
            <WaButton
              variant="outline"
              size="sm"
              onClick={load}
              disabled={isPending}
              leftIcon={isPending ? Loader2 : RefreshCw}
            >
              Refresh
            </WaButton>
          )
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-full border border-zinc-200 bg-white p-0.5">
        {tabs.map((t) => {
          const isActive = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={isActive}
              className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors duration-150 active:scale-[0.97]"
              style={{
                color: isActive ? '#ffffff' : '#52525b',
                background: isActive ? 'var(--mt-accent)' : 'transparent',
              }}
            >
              <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
              {t.label}
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.2)' : '#f4f4f5',
                  color: isActive ? '#ffffff' : '#71717a',
                }}
              >
                {t.rows.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* KPI strip - per tab */}
      <AnimatePresence mode="wait" initial={false}>
        <m.section
          key={tab}
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >
          <MetricTile label="Total" value={String(kpis.total)} icon={LibraryIcon} delay={0.02} />
          <MetricTile label="Marketing" value={String(kpis.marketing)} icon={Tag} delay={0.05} />
          <MetricTile label="Utility" value={String(kpis.utility)} icon={Tag} delay={0.08} />
          <MetricTile label="With media" value={String(kpis.withMedia)} icon={ImageIcon} delay={0.11} />
          <MetricTile label="With buttons" value={String(kpis.withButtons)} icon={Layers} delay={0.14} />
          <MetricTile label="With vars" value={String(kpis.withVars)} icon={Hash} delay={0.17} />
        </m.section>
      </AnimatePresence>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Rail */}
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
            <RailFacet
              title="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              items={categories.map((c) => ({
                value: c,
                label: c === 'ALL' ? 'All' : c.replace(/_/g, ' ').toLowerCase(),
                count: c === 'ALL' ? currentRows.length : facetCategories.get(c) ?? 0,
              }))}
            />
            <RailFacet
              title="Header type"
              value={headerFilter}
              onChange={setHeaderFilter}
              items={headerTypes.map((h) => ({
                value: h,
                label: h === 'ALL' ? 'All' : h.toLowerCase(),
                count: h === 'ALL' ? currentRows.length : facetHeaders.get(h) ?? 0,
              }))}
            />
            {languages.length > 2 && (
              <RailFacet
                title="Language"
                value={languageFilter}
                onChange={setLanguageFilter}
                items={languages.map((l) => ({
                  value: l,
                  label: l === 'ALL' ? 'All' : languageLabel(l),
                  count: l === 'ALL' ? currentRows.length : facetLanguages.get(l) ?? 0,
                }))}
              />
            )}
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 space-y-3">
          <m.div
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2.5"
          >
            <button
              type="button"
              onClick={() => setRailOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-950 active:scale-[0.97] lg:hidden"
            >
              <Filter className="h-3 w-3" strokeWidth={2.25} />
              Filters
            </button>
            <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400">
              <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <Input
                placeholder="Search by name or body"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 bg-transparent p-0 text-[13px] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </label>
            <span className="ml-auto text-[11.5px] tabular-nums text-zinc-500">
              {filtered.length} / {currentRows.length}
            </span>
          </m.div>

          {renderGrid()}
        </div>
      </div>

      <Dialog
        open={Boolean(cloneTarget)}
        onOpenChange={(open) => !open && setCloneTarget(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Clone template</ZoruDialogTitle>
            <ZoruDialogDescription>
              {cloneTarget
                ? `Use "${cloneTarget.name.replace(/_/g, ' ')}" as a starting point in ${
                    activeProject?.name || 'your project'
                  }. The body will be copied to your clipboard.`
                : ''}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setCloneTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (cloneTarget) handleClone(cloneTarget);
                setCloneTarget(null);
              }}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Open builder
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}

/* ── rail facet ───────────────────────────────────────── */

interface RailFacetItem {
  value: string;
  label: string;
  count: number;
}

function RailFacet({
  title,
  value,
  onChange,
  items,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  items: RailFacetItem[];
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
