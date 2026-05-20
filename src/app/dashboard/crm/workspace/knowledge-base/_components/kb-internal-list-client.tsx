'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  useDebouncedCallback } from 'use-debounce';
import {
    Archive,
    BookOpen,
    CheckSquare,
    Download,
    LayoutList,
    ListTree,
    Pin,
    Plus,
    Trash2,
    X,
    } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

/**
 * Internal KB list (§1D.1) — mirrors the customer-facing
 * /tickets/knowledge-base shape: KPI strip · 5 filters · table or
 * category-tree view · CSV/XLSX export · bulk Publish/Archive/Delete.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    bulkArchiveKbArticles,
    bulkDeleteKbArticles,
    bulkPublishKbArticles,
    deleteKnowledgeBase,
    getKnowledgeBaseCategories,
    getKnowledgeBases,
    togglePinKnowledgeBase,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
    WsKnowledgeBase,
    WsKnowledgeBaseCategory,
} from '@/lib/worksuite/knowledge-types';

import {
    KB_INTERNAL_INITIAL_FILTERS,
    computeKbInternalKpis,
    filterKbInternal,
    fmtDate,
    groupArticlesByCategory,
    type KbInternalFilterState,
    type KbInternalKpiKey,
    type KbInternalTypeFilter,
} from './kb-internal-shared';

type KbInternalViewMode = 'table' | 'tree';

type ArticleRow = WsKnowledgeBase & { _id: string };

export function KbInternalListClient(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [articles, setArticles] = React.useState<ArticleRow[]>([]);
    const [categories, setCategories] = React.useState<
        (WsKnowledgeBaseCategory & { _id: string })[]
    >([]);
    const [loading, startTransition] = React.useTransition();
    const [filters, setFilters] = React.useState<KbInternalFilterState>(
        KB_INTERNAL_INITIAL_FILTERS,
    );
    const [view, setView] = React.useState<KbInternalViewMode>('table');
    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    // Bulk selection
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = React.useState<'publish' | 'archive' | 'delete' | null>(null);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            try {
                const [a, c] = await Promise.all([
                    getKnowledgeBases(),
                    getKnowledgeBaseCategories(),
                ]);
                setArticles(a as ArticleRow[]);
                setCategories(c as (WsKnowledgeBaseCategory & { _id: string })[]);
            } catch (err) {
                toast({
                    title: 'Could not load articles',
                    description: err instanceof Error ? err.message : 'Unknown',
                    variant: 'destructive',
                });
            }
        });
    }, [toast]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback(
        (v: string) => setFilters((p) => ({ ...p, search: v })),
        200,
    );
    const updateFilter = React.useCallback(
        <K extends keyof KbInternalFilterState>(k: K, v: KbInternalFilterState[K]) =>
            setFilters((p) => ({ ...p, [k]: v })),
        [],
    );
    const clearFilters = React.useCallback(
        () => setFilters(KB_INTERNAL_INITIAL_FILTERS),
        [],
    );

    const hasActiveFilters = React.useMemo(() => {
        const f = filters;
        return (
            f.kpiKey !== 'all' ||
            f.typeFilter !== 'all' ||
            f.category !== '' ||
            f.fromIso !== '' ||
            f.toIso !== '' ||
            f.search !== ''
        );
    }, [filters]);

    const visible = React.useMemo(
        () => filterKbInternal(articles, filters),
        [articles, filters],
    );
    const kpis = React.useMemo(() => computeKbInternalKpis(articles), [articles]);
    const grouped = React.useMemo(
        () => groupArticlesByCategory(visible, categories),
        [visible, categories],
    );

    // Selection helpers
    const allVisibleSelected =
        visible.length > 0 && visible.every((a) => selected.has(a._id));
    const someSelected = selected.size > 0;

    const toggleAll = React.useCallback(
        (checked: boolean) => {
            setSelected(checked ? new Set(visible.map((a) => a._id)) : new Set());
        },
        [visible],
    );

    const toggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteId) return;
        const r = await deleteKnowledgeBase(deleteId);
        if (r.success) {
            toast({ title: 'Article deleted' });
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(deleteId);
                return next;
            });
            fetchData();
        } else {
            toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
        }
        setDeleteId(null);
    }, [deleteId, fetchData, toast]);

    const handleTogglePin = React.useCallback(
        async (id: string) => {
            const r = await togglePinKnowledgeBase(id);
            if (r.success) fetchData();
            else toast({ title: 'Error', description: r.error, variant: 'destructive' });
        },
        [fetchData, toast],
    );

    // Bulk action handler
    const handleBulkConfirm = React.useCallback(async () => {
        const ids = Array.from(selected);
        if (ids.length === 0 || !bulkAction) return;

        let result: { updated?: number; deleted?: number; failed: number; error?: string } | null = null;

        if (bulkAction === 'publish') {
            result = await bulkPublishKbArticles(ids);
            if (result.error) {
                toast({ title: 'Bulk publish failed', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: `${result.updated ?? 0} article${(result.updated ?? 0) === 1 ? '' : 's'} published` });
            }
        } else if (bulkAction === 'archive') {
            result = await bulkArchiveKbArticles(ids);
            if (result.error) {
                toast({ title: 'Bulk archive failed', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: `${result.updated ?? 0} article${(result.updated ?? 0) === 1 ? '' : 's'} archived` });
            }
        } else if (bulkAction === 'delete') {
            result = await bulkDeleteKbArticles(ids);
            if (result.error) {
                toast({ title: 'Bulk delete failed', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: `${result.deleted ?? 0} article${(result.deleted ?? 0) === 1 ? '' : 's'} deleted` });
            }
        }

        setSelected(new Set());
        setBulkAction(null);
        fetchData();
    }, [selected, bulkAction, fetchData, toast]);

    const exportCsv = React.useCallback(() => {
        const headers = ['Title', 'Category', 'Type', 'Status', 'Author', 'Views', 'Created'];
        const rows = visible.map((a) => {
            const cat = categories.find((c) => c._id === a.category_id);
            return {
                Title: a.title,
                Category: cat?.name ?? 'Uncategorized',
                Type: a.type,
                Status: a.pinned ? 'Published' : 'Draft',
                Author: '',
                Views: '',
                Created: fmtDate(a.createdAt),
            };
        });
        downloadCsv(`kb-internal-${dateStamp()}.csv`, headers, rows);
    }, [visible, categories]);

    const exportXlsx = React.useCallback(async () => {
        const headers = ['Title', 'Category', 'Type', 'Status', 'Author', 'Views', 'Created'];
        const rows = visible.map((a) => {
            const cat = categories.find((c) => c._id === a.category_id);
            return {
                Title: a.title,
                Category: cat?.name ?? 'Uncategorized',
                Type: a.type,
                Status: a.pinned ? 'Published' : 'Draft',
                Author: '',
                Views: '',
                Created: fmtDate(a.createdAt),
            };
        });
        await downloadXlsx(`kb-internal-${dateStamp()}.xlsx`, headers, rows, 'Knowledge Base');
    }, [visible, categories]);

    const bulkBarLabel =
        bulkAction === 'publish'
            ? 'Publish selected articles?'
            : bulkAction === 'archive'
              ? 'Archive selected articles?'
              : 'Delete selected articles?';

    const bulkBarDescription =
        bulkAction === 'delete'
            ? 'Deleted articles cannot be recovered.'
            : undefined;

    return (
        <>
            <EntityListShell
                title="Knowledge Base"
                subtitle="Internal articles, guides, and reference material grouped by category."
                viewSwitcher={
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
                            <ListTree className="h-3.5 w-3.5" /> Tree
                        </button>
                    </div>
                }
                search={{
                    value: filters.search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search title or body…',
                }}
                primaryAction={
                    <div className="flex gap-2">
                        <ZoruButton asChild variant="outline">
                            <Link href="/dashboard/crm/workspace/knowledge-base/categories">
                                Categories
                            </Link>
                        </ZoruButton>
                        <ZoruButton asChild>
                            <Link href="/dashboard/crm/workspace/knowledge-base/new">
                                <Plus className="h-4 w-4" /> New article
                            </Link>
                        </ZoruButton>
                    </div>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <ZoruSelect
                            value={filters.kpiKey}
                            onValueChange={(v) => updateFilter('kpiKey', v as KbInternalKpiKey)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[140px]">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All</ZoruSelectItem>
                                <ZoruSelectItem value="published">Published</ZoruSelectItem>
                                <ZoruSelectItem value="drafts">Drafts</ZoruSelectItem>
                                <ZoruSelectItem value="pinned">Pinned</ZoruSelectItem>
                                <ZoruSelectItem value="todo">To-do</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <EnumFilterField
                            enumName="kbArticleType"
                            value={filters.typeFilter}
                            onChange={(v) => updateFilter('typeFilter', v as KbInternalTypeFilter)}
                            allLabel="Any type"
                        />
                        <ZoruSelect
                            value={filters.category || 'any'}
                            onValueChange={(v) => updateFilter('category', v === 'any' ? '' : v)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[180px]">
                                <ZoruSelectValue placeholder="Category" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="any">Any category</ZoruSelectItem>
                                {categories.map((c) => (
                                    <ZoruSelectItem key={c._id} value={c._id}>
                                        {c.name}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <ZoruInput
                            type="date"
                            value={filters.fromIso}
                            onChange={(e) => updateFilter('fromIso', e.target.value)}
                            className="h-9 w-[150px]"
                            aria-label="From"
                        />
                        <ZoruInput
                            type="date"
                            value={filters.toIso}
                            onChange={(e) => updateFilter('toIso', e.target.value)}
                            className="h-9 w-[150px]"
                            aria-label="To"
                        />
                        {hasActiveFilters ? (
                            <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                                <X className="h-3.5 w-3.5" /> Clear
                            </ZoruButton>
                        ) : null}
                        <ZoruButton variant="ghost" size="sm" onClick={exportCsv}>
                            <Download className="h-3.5 w-3.5" /> CSV
                        </ZoruButton>
                        <ZoruButton variant="ghost" size="sm" onClick={exportXlsx}>
                            <Download className="h-3.5 w-3.5" /> XLSX
                        </ZoruButton>
                    </div>
                }
                bulkBar={
                    someSelected ? (
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zoru-ink">
                                {selected.size} selected
                            </span>
                            <div className="flex gap-2">
                                <ZoruButton
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelected(new Set())}
                                >
                                    Clear
                                </ZoruButton>
                                <ZoruButton
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setBulkAction('publish')}
                                >
                                    <Pin className="h-3.5 w-3.5" /> Publish
                                </ZoruButton>
                                <ZoruButton
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setBulkAction('archive')}
                                >
                                    <Archive className="h-3.5 w-3.5" /> Archive
                                </ZoruButton>
                                <ZoruButton
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setBulkAction('delete')}
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </ZoruButton>
                            </div>
                        </div>
                    ) : null
                }
                empty={
                    !loading && articles.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <BookOpen className="h-6 w-6 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No articles yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Author your first internal article — process docs, runbooks, or
                                quick references for the team.
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/workspace/knowledge-base/new">
                                    <Plus className="h-4 w-4" /> Add article
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={loading && articles.length === 0}
            >
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <ZoruStatCard label="Total" value={kpis.total} icon={<BookOpen className="h-4 w-4" />} />
                        <ZoruStatCard label="Published" value={kpis.published} icon={<Pin className="h-4 w-4" />} />
                        <ZoruStatCard label="Drafts" value={kpis.drafts} />
                        <ZoruStatCard label="To-do" value={kpis.todo} icon={<CheckSquare className="h-4 w-4" />} />
                        {/* TODO 1D.1: Most-viewed / Helpful % — internal schema lacks
                            viewCount and helpfulYes/No. Add when schema extends. */}
                        <ZoruStatCard label="Most viewed" value="—" />
                    </div>

                    {view === 'table' ? (
                        <KbInternalTable
                            articles={visible}
                            categories={categories}
                            selected={selected}
                            allSelected={allVisibleSelected}
                            onToggleAll={toggleAll}
                            onToggleOne={toggleOne}
                            onDelete={(id) => setDeleteId(id)}
                            onTogglePin={handleTogglePin}
                        />
                    ) : (
                        <KbInternalTree grouped={grouped} />
                    )}
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={(o) => !o && setDeleteId(null)}
                title="Delete this article?"
                description="The article will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />

            <ConfirmDialog
                open={!!bulkAction}
                onOpenChange={(o) => !o && setBulkAction(null)}
                title={bulkBarLabel}
                description={bulkBarDescription ?? `${selected.size} article${selected.size === 1 ? '' : 's'} will be affected.`}
                requireTyped={bulkAction === 'delete' ? 'DELETE' : undefined}
                confirmLabel={
                    bulkAction === 'publish' ? 'Publish' : bulkAction === 'archive' ? 'Archive' : 'Delete'
                }
                onConfirm={handleBulkConfirm}
            />
        </>
    );
}

function KbInternalTable({
    articles,
    categories,
    selected,
    allSelected,
    onToggleAll,
    onToggleOne,
    onDelete,
    onTogglePin,
}: {
    articles: (WsKnowledgeBase & { _id: string })[];
    categories: (WsKnowledgeBaseCategory & { _id: string })[];
    selected: Set<string>;
    allSelected: boolean;
    onToggleAll: (checked: boolean) => void;
    onToggleOne: (id: string) => void;
    onDelete: (id: string) => void;
    onTogglePin: (id: string) => void;
}) {
    return (
        <div className="overflow-x-auto rounded-[var(--zoru-radius-lg)] border border-zoru-line">
            <table className="w-full min-w-[860px] text-[13px]">
                <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium w-10">
                            <ZoruCheckbox
                                aria-label="Select all"
                                checked={allSelected}
                                onCheckedChange={(v) => onToggleAll(Boolean(v))}
                            />
                        </th>
                        {[
                            'Title',
                            'Category',
                            'Type',
                            'Status',
                            'To-do',
                            'Updated',
                            '',
                        ].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                    {articles.length === 0 ? (
                        <tr>
                            <td colSpan={8} className="p-6 text-center text-zoru-ink-muted">
                                No articles match the current filters.
                            </td>
                        </tr>
                    ) : null}
                    {articles.map((a) => {
                        const cat = categories.find((c) => c._id === a.category_id);
                        const isSelected = selected.has(a._id);
                        return (
                            <tr
                                key={a._id}
                                className={[
                                    'hover:bg-zoru-surface',
                                    isSelected ? 'bg-zoru-surface' : '',
                                ].join(' ')}
                            >
                                <td className="px-3 py-2">
                                    <ZoruCheckbox
                                        aria-label={`Select ${a.title}`}
                                        checked={isSelected}
                                        onCheckedChange={() => onToggleOne(a._id)}
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <EntityRowLink
                                        href={`/dashboard/crm/workspace/knowledge-base/${a._id}`}
                                        label={a.title}
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <ZoruBadge variant="ghost">{cat?.name ?? 'Uncategorized'}</ZoruBadge>
                                </td>
                                <td className="px-3 py-2 capitalize text-zoru-ink-muted">{a.type}</td>
                                <td className="px-3 py-2">
                                    <StatusPill
                                        label={a.pinned ? 'Published' : 'Draft'}
                                        tone={a.pinned ? 'green' : 'amber'}
                                    />
                                </td>
                                <td className="px-3 py-2 text-zoru-ink-muted">{a.to_do}</td>
                                <td className="px-3 py-2 text-zoru-ink-muted">
                                    {fmtDate(a.updatedAt ?? a.createdAt)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <ZoruButton
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onTogglePin(a._id)}
                                    >
                                        <Pin className="h-3.5 w-3.5" />
                                        {a.pinned ? 'Unpin' : 'Pin'}
                                    </ZoruButton>
                                    <ZoruButton
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onDelete(a._id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </ZoruButton>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function KbInternalTree({
    grouped,
}: {
    grouped: { id: string; name: string; articles: WsKnowledgeBase[] }[];
}) {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {grouped.map((g) => (
                <ZoruCard key={g.id}>
                    <h3 className="mb-2 text-[13.5px] font-semibold text-zoru-ink">
                        {g.name}{' '}
                        <ZoruBadge variant="ghost" className="ml-1">
                            {g.articles.length}
                        </ZoruBadge>
                    </h3>
                    {g.articles.length === 0 ? (
                        <p className="text-[12.5px] text-zoru-ink-muted">No articles.</p>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {g.articles.map((a) => (
                                <li
                                    key={String(a._id)}
                                    className="flex items-center justify-between rounded-sm px-2 py-1 text-[13px] hover:bg-zoru-surface-2"
                                >
                                    <Link
                                        href={`/dashboard/crm/workspace/knowledge-base/${a._id}`}
                                        className="truncate text-zoru-ink hover:underline"
                                    >
                                        {a.title}
                                    </Link>
                                    <span className="ml-2 inline-flex items-center gap-1 text-[11.5px] text-zoru-ink-muted">
                                        {a.pinned ? <Pin className="h-3 w-3" /> : null}
                                        {a.type}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </ZoruCard>
            ))}
        </div>
    );
}

export default KbInternalListClient;
