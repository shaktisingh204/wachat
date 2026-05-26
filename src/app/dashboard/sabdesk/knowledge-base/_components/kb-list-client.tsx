'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/zoruui';
import {
  useDebouncedCallback } from 'use-debounce';
import { ChevronDown,
  LayoutList,
  ListChecks,
  Plus } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

/**
 * <KbListClient> — interactive shell for the KB list page (§1D.1).
 *
 * Owns search, filters, KPI strip, view switcher (table / category
 * tree), bulk-action bar, and per-row dialogs. The article dataset is
 * fetched once on mount and filtered/sorted client-side.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    bulkKbAction,
    deleteKbArticle,
    listKbArticles,
    type KbArticleDoc,
} from '@/app/actions/crm-knowledge-base.actions';

import { KbKpiStrip, computeKbKpis, type KbKpiKey } from './kb-kpi-strip';
import {
    KbBulkBar,
    KbFiltersRow,
    type KbStatusFilter,
    type KbVisibilityFilter,
} from './kb-filters';
import { KbTable } from './kb-table';
import { KbCategoryTree } from './kb-category-tree';

type KbViewMode = 'table' | 'tree';

const VIEW_PRESETS: { id: string; label: string; description?: string }[] = [
    { id: 'all', label: 'All articles', description: 'Default view' },
    { id: 'my-drafts', label: 'My drafts', description: 'Owned by me, draft' },
    { id: 'recent', label: 'Recently updated', description: 'Last 7 days' },
    { id: 'helpful', label: 'Most helpful', description: 'Helpful ≥ 80%' },
];

export function KbListClient() {
    const { toast } = useZoruToast();

    const [articles, setArticles] = React.useState<KbArticleDoc[]>([]);
    const [loading, startTransition] = React.useTransition();

    // Filters / search
    const [search, setSearch] = React.useState('');
    const [kpiKey, setKpiKey] = React.useState<KbKpiKey>('all');
    const [statusFilter, setStatusFilter] = React.useState<KbStatusFilter>('all');
    const [categoryFilter, setCategoryFilter] = React.useState('');
    const [visibilityFilter, setVisibilityFilter] = React.useState<KbVisibilityFilter>('all');
    const [tagFilter, setTagFilter] = React.useState('');
    const [ownerFilter, setOwnerFilter] = React.useState('');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [activePresetId, setActivePresetId] = React.useState('all');

    // View / selection / dialogs
    const [view, setView] = React.useState<KbViewMode>('table');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkConfirm, setBulkConfirm] = React.useState<
        'publish' | 'unpublish' | 'delete' | null
    >(null);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const res = await listKbArticles(200);
            if (res.error) {
                toast({
                    title: 'Could not load articles',
                    description: res.error,
                    variant: 'destructive',
                });
            }
            setArticles(res.articles);
        });
    }, [toast]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
    }, 200);

    const clearFilters = React.useCallback(() => {
        setStatusFilter('all');
        setCategoryFilter('');
        setVisibilityFilter('all');
        setTagFilter('');
        setOwnerFilter('');
        setDateRange(undefined);
        setSearch('');
        setActivePresetId('all');
        setKpiKey('all');
    }, []);

    const hasActiveFilters =
        statusFilter !== 'all' ||
        !!categoryFilter ||
        visibilityFilter !== 'all' ||
        !!tagFilter ||
        !!ownerFilter ||
        !!dateRange?.from ||
        !!dateRange?.to ||
        activePresetId !== 'all' ||
        kpiKey !== 'all';

    /* ─── Filtering ───────────────────────────────────────────────── */
    const visibleArticles = React.useMemo(() => {
        const now = Date.now();
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        let topView = 0;
        for (const a of articles) {
            if (typeof a.viewCount === 'number' && a.viewCount > topView) {
                topView = a.viewCount;
            }
        }
        return articles.filter((a) => {
            // Search
            const q = search.trim().toLowerCase();
            if (q) {
                const hay = `${a.title ?? ''} ${a.slug ?? ''} ${a.body ?? ''} ${a.category ?? ''} ${
                    (a.tags ?? []).join(' ')
                }`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            // Status
            if (statusFilter !== 'all' && (a.status ?? 'draft') !== statusFilter) {
                return false;
            }
            if (categoryFilter && a.category !== categoryFilter) return false;
            if (
                visibilityFilter !== 'all' &&
                String(a.visibility ?? '').toLowerCase() !== visibilityFilter
            ) {
                return false;
            }
            if (tagFilter && !(a.tags ?? []).includes(tagFilter)) return false;
            if (ownerFilter && a.ownerId !== ownerFilter) return false;
            const updated = a.updatedAt ? new Date(a.updatedAt).getTime() : NaN;
            if (dateRange?.from && Number.isFinite(updated) && updated < dateRange.from.getTime()) {
                return false;
            }
            if (dateRange?.to && Number.isFinite(updated) && updated > dateRange.to.getTime()) {
                return false;
            }
            // KPI virtual
            switch (kpiKey) {
                case 'published':
                    if (a.status !== 'published') return false;
                    break;
                case 'drafts':
                    if (a.status && a.status !== 'draft') return false;
                    break;
                case 'mostViewed':
                    if (topView === 0) return false;
                    if ((a.viewCount ?? 0) < topView) return false;
                    break;
                case 'helpful': {
                    const y = a.helpfulYes ?? 0;
                    const n = a.helpfulNo ?? 0;
                    if (y + n === 0) return false;
                    if (y / (y + n) < 0.8) return false;
                    break;
                }
                default:
                    break;
            }
            // Saved presets
            if (activePresetId === 'recent') {
                if (!Number.isFinite(updated) || updated < weekAgo) return false;
            }
            if (activePresetId === 'my-drafts') {
                // ownerFilter is set when this preset is applied; nothing more to do.
            }
            return true;
        });
    }, [
        articles,
        search,
        statusFilter,
        categoryFilter,
        visibilityFilter,
        tagFilter,
        ownerFilter,
        dateRange,
        kpiKey,
        activePresetId,
    ]);

    const kpiCounts = React.useMemo(() => computeKbKpis(articles), [articles]);

    /* ─── Selection ───────────────────────────────────────────────── */
    const handleToggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleToggleAll = React.useCallback(
        (all: boolean) => {
            setSelected(
                all
                    ? new Set(visibleArticles.map((a) => String(a._id)))
                    : new Set(),
            );
        },
        [visibleArticles],
    );

    /* ─── Row actions ─────────────────────────────────────────────── */
    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteKbArticle(deleteTargetId);
        if (res.success) {
            toast({ title: 'Article deleted' });
            fetchData();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, fetchData, toast]);

    /* ─── Bulk ────────────────────────────────────────────────────── */
    const runBulk = React.useCallback(
        async (op: 'publish' | 'unpublish' | 'delete') => {
            if (selected.size === 0) return;
            const ids = Array.from(selected);
            const res = await bulkKbAction(ids, op);
            if (res.success) {
                toast({
                    title: `${res.processed} article${res.processed === 1 ? '' : 's'} updated`,
                });
                setSelected(new Set());
                fetchData();
            } else {
                toast({
                    title: 'Bulk action failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
            setBulkConfirm(null);
        },
        [selected, fetchData, toast],
    );

    const exportCsv = React.useCallback(() => {
        const rows =
            selected.size > 0
                ? articles.filter((a) => selected.has(String(a._id)))
                : visibleArticles;
        const header = [
            'ID',
            'Title',
            'Slug',
            'Category',
            'Status',
            'Visibility',
            'Tags',
            'Views',
            'HelpfulYes',
            'HelpfulNo',
            'UpdatedAt',
        ];
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...rows.map((a) =>
                [
                    esc(a._id),
                    esc(a.title),
                    esc(a.slug),
                    esc(a.category),
                    esc(a.status),
                    esc(a.visibility),
                    esc((a.tags ?? []).join('|')),
                    esc(a.viewCount ?? 0),
                    esc(a.helpfulYes ?? 0),
                    esc(a.helpfulNo ?? 0),
                    esc(a.updatedAt ?? ''),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kb-articles-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [articles, visibleArticles, selected]);

    const applyPreset = React.useCallback((presetId: string) => {
        setActivePresetId(presetId);
        if (presetId === 'all') {
            setStatusFilter('all');
            setOwnerFilter('');
            setDateRange(undefined);
        }
        if (presetId === 'my-drafts') {
            setStatusFilter('draft');
            // owner filter is left to user — KB doesn't have a clean
            // "session user id" client side without an explicit fetch.
        }
        if (presetId === 'helpful') {
            setKpiKey('helpful');
        }
    }, []);

    const activePreset = VIEW_PRESETS.find((p) => p.id === activePresetId) ?? VIEW_PRESETS[0];

    return (
        <>
            <EntityListShell
                title="Knowledge Base"
                subtitle="Publish help articles for customers and your support agents."
                viewSwitcher={
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <ListChecks className="h-3.5 w-3.5" /> {activePreset.label}
                                    <ChevronDown className="h-3.5 w-3.5 text-zoru-ink-subtle" />
                                </Button>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent align="start" className="w-64">
                                <ZoruDropdownMenuLabel>Saved views</ZoruDropdownMenuLabel>
                                <ZoruDropdownMenuSeparator />
                                {VIEW_PRESETS.map((preset) => (
                                    <ZoruDropdownMenuItem
                                        key={preset.id}
                                        onClick={() => applyPreset(preset.id)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-medium">
                                                {preset.label}
                                            </span>
                                            {preset.description ? (
                                                <span className="text-[11.5px] text-zoru-ink-muted">
                                                    {preset.description}
                                                </span>
                                            ) : null}
                                        </div>
                                    </ZoruDropdownMenuItem>
                                ))}
                            </ZoruDropdownMenuContent>
                        </DropdownMenu>
                        <div className="inline-flex rounded-md border border-zoru-line p-0.5">
                            <button
                                type="button"
                                onClick={() => setView('table')}
                                aria-pressed={view === 'table'}
                                className={[
                                    'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                                    view === 'table'
                                        ? 'bg-zoru-surface text-zoru-ink'
                                        : 'text-zoru-ink-muted hover:text-zoru-ink',
                                ].join(' ')}
                            >
                                <LayoutList className="h-3.5 w-3.5" /> Table
                            </button>
                            <button
                                type="button"
                                onClick={() => setView('tree')}
                                aria-pressed={view === 'tree'}
                                className={[
                                    'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                                    view === 'tree'
                                        ? 'bg-zoru-surface text-zoru-ink'
                                        : 'text-zoru-ink-muted hover:text-zoru-ink',
                                ].join(' ')}
                            >
                                Tree
                            </button>
                        </div>
                    </div>
                }
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search title, slug, body, tags…',
                }}
                primaryAction={
                    <Button asChild>
                        <Link href="/dashboard/sabdesk/knowledge-base/new">
                            <Plus className="h-4 w-4" /> New article
                        </Link>
                    </Button>
                }
                filters={
                    <KbFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setActivePresetId('all');
                        }}
                        categoryFilter={categoryFilter}
                        onCategoryChange={(v) => {
                            setCategoryFilter(v);
                            setActivePresetId('all');
                        }}
                        visibilityFilter={visibilityFilter}
                        onVisibilityChange={(v) => {
                            setVisibilityFilter(v);
                            setActivePresetId('all');
                        }}
                        tagFilter={tagFilter}
                        onTagChange={(v) => {
                            setTagFilter(v);
                            setActivePresetId('all');
                        }}
                        ownerFilter={ownerFilter}
                        onOwnerChange={(v) => {
                            setOwnerFilter(v);
                            setActivePresetId('all');
                        }}
                        dateRange={dateRange}
                        onDateRangeChange={(r) => {
                            setDateRange(r);
                            setActivePresetId('all');
                        }}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <KbBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onPublish={() => setBulkConfirm('publish')}
                            onUnpublish={() => setBulkConfirm('unpublish')}
                            onDelete={() => setBulkConfirm('delete')}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    !loading && visibleArticles.length === 0 && articles.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <h3 className="text-base font-medium text-zoru-ink">
                                No articles yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Author your first help article to deflect common tickets and
                                empower your support agents.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/sabdesk/knowledge-base/new">
                                    <Plus className="h-4 w-4" /> Add your first article
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={loading && articles.length === 0}
            >
                <div className="flex flex-col gap-4">
                    <KbKpiStrip
                        counts={kpiCounts}
                        active={kpiKey}
                        onPick={(next) => setKpiKey(next)}
                    />

                    {view === 'table' ? (
                        <KbTable
                            articles={visibleArticles}
                            loading={loading}
                            selectedIds={selected}
                            onToggleOne={handleToggleOne}
                            onToggleAll={handleToggleAll}
                            onDelete={(id) => setDeleteTargetId(id)}
                        />
                    ) : (
                        <KbCategoryTree articles={visibleArticles} />
                    )}
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this article permanently?"
                description="This permanently removes the article. The action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />

            <ConfirmDialog
                open={bulkConfirm !== null}
                onOpenChange={(o) => !o && setBulkConfirm(null)}
                title={
                    bulkConfirm === 'delete'
                        ? `Delete ${selected.size} article(s)?`
                        : bulkConfirm === 'publish'
                        ? `Publish ${selected.size} article(s)?`
                        : `Unpublish ${selected.size} article(s)?`
                }
                description={
                    bulkConfirm === 'delete'
                        ? 'The selected articles will be permanently removed.'
                        : 'The selected articles will be updated.'
                }
                confirmLabel={
                    bulkConfirm === 'delete' ? 'Delete' : bulkConfirm === 'publish' ? 'Publish' : 'Unpublish'
                }
                confirmTone={bulkConfirm === 'delete' ? 'danger' : 'primary'}
                requireTyped={bulkConfirm === 'delete' ? 'DELETE' : undefined}
                onConfirm={() => {
                    if (bulkConfirm) {
                        void runBulk(bulkConfirm);
                    }
                }}
            />

        </>
    );
}

export default KbListClient;
