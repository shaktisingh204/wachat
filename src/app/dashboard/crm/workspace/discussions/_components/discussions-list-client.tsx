'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';
import {
  useDebouncedCallback } from 'use-debounce';
import {
    LayoutGrid,
  LayoutList,
  MessageSquare,
  MessagesSquare,
  Plus,
  Trash2,
  X,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill } from '@/components/crm/status-pill';

/**
 * Discussions list (§1D.1) — KPI strip (4), filters (category, author,
 * date range, status), table or kanban-by-category view.
 *
 * Replies are fetched per-discussion only when the discussion appears
 * in the current page, so the initial render is light.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    deleteDiscussion,
    getDiscussionCategories,
    getDiscussionReplies,
    getDiscussions,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
    WsDiscussion,
    WsDiscussionCategory,
    WsDiscussionReply,
} from '@/lib/worksuite/knowledge-types';

import {
    DISCUSSIONS_INITIAL_FILTERS,
    computeDiscussionsKpis,
    filterDiscussions,
    fmtDate,
    lastActivity,
    type DiscussionsFilterState,
    type DiscussionsKpiKey,
} from './discussions-shared';

type DiscussionsViewMode = 'table' | 'kanban';

const UNCAT = '__uncategorized__';

export function DiscussionsListClient(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [discussions, setDiscussions] = React.useState<
        (WsDiscussion & { _id: string })[]
    >([]);
    const [categories, setCategories] = React.useState<
        (WsDiscussionCategory & { _id: string })[]
    >([]);
    const [repliesByDiscussion, setReplies] = React.useState<Map<string, WsDiscussionReply[]>>(
        new Map(),
    );
    const [loading, startTransition] = React.useTransition();

    const [filters, setFilters] = React.useState<DiscussionsFilterState>(
        DISCUSSIONS_INITIAL_FILTERS,
    );
    const [view, setView] = React.useState<DiscussionsViewMode>('table');
    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            try {
                const [ds, cs] = await Promise.all([
                    getDiscussions(),
                    getDiscussionCategories(),
                ]);
                const dsTyped = ds as (WsDiscussion & { _id: string })[];
                setDiscussions(dsTyped);
                setCategories(cs as (WsDiscussionCategory & { _id: string })[]);

                // Reply counts are fetched in parallel — cheap because the
                // server action returns a small array per discussion.
                const replyPairs = await Promise.all(
                    dsTyped.map(async (d) => {
                        const r = await getDiscussionReplies(d._id);
                        return [d._id, r as WsDiscussionReply[]] as const;
                    }),
                );
                setReplies(new Map(replyPairs));
            } catch (err) {
                toast({
                    title: 'Could not load discussions',
                    description: err instanceof Error ? err.message : 'Unknown error',
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
        <K extends keyof DiscussionsFilterState>(k: K, v: DiscussionsFilterState[K]) =>
            setFilters((p) => ({ ...p, [k]: v })),
        [],
    );

    const clearFilters = React.useCallback(
        () => setFilters(DISCUSSIONS_INITIAL_FILTERS),
        [],
    );

    const hasActiveFilters = React.useMemo(() => {
        const f = filters;
        return (
            f.kpiKey !== 'all' ||
            f.category !== '' ||
            f.author !== '' ||
            f.fromIso !== '' ||
            f.toIso !== '' ||
            f.search !== ''
        );
    }, [filters]);

    const visible = React.useMemo(
        () => filterDiscussions(discussions, filters, repliesByDiscussion),
        [discussions, filters, repliesByDiscussion],
    );

    const kpis = React.useMemo(
        () => computeDiscussionsKpis(discussions, categories, repliesByDiscussion),
        [discussions, categories, repliesByDiscussion],
    );

    const grouped = React.useMemo(() => {
        const map = new Map<string, (WsDiscussion & { _id: string })[]>();
        for (const d of visible) {
            const key = d.category_id ?? UNCAT;
            const list = map.get(key) ?? [];
            list.push(d);
            map.set(key, list);
        }
        return map;
    }, [visible]);

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteId) return;
        const r = await deleteDiscussion(deleteId);
        if (r.success) {
            toast({ title: 'Discussion deleted' });
            fetchData();
        } else {
            toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
        }
        setDeleteId(null);
    }, [deleteId, fetchData, toast]);

    const exportCsv = React.useCallback(() => {
        const header = ['ID', 'Title', 'Category', 'Replies', 'LastActivity'];
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...visible.map((d) => {
                const cat = categories.find((c) => c._id === d.category_id);
                const replies = repliesByDiscussion.get(d._id) ?? [];
                const la = lastActivity(d, repliesByDiscussion);
                return [
                    esc(d._id),
                    esc(d.title),
                    esc(cat?.name ?? ''),
                    esc(replies.length),
                    esc(la ? la.toISOString() : ''),
                ].join(',');
            }),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `discussions-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [visible, categories, repliesByDiscussion]);

    return (
        <>
            <EntityListShell
                title="Discussions"
                subtitle="Threaded team conversations grouped by category."
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
                            onClick={() => setView('kanban')}
                            aria-pressed={view === 'kanban'}
                            className={[
                                'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                                view === 'kanban'
                                    ? 'bg-zoru-surface text-zoru-ink'
                                    : 'text-zoru-ink-muted hover:text-zoru-ink',
                            ].join(' ')}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
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
                            <Link href="/dashboard/crm/workspace/discussions/categories">
                                Categories
                            </Link>
                        </ZoruButton>
                        <ZoruButton asChild>
                            <Link href="/dashboard/crm/workspace/discussions/new">
                                <Plus className="h-4 w-4" /> New discussion
                            </Link>
                        </ZoruButton>
                    </div>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <ZoruSelect
                            value={filters.kpiKey}
                            onValueChange={(v) => updateFilter('kpiKey', v as DiscussionsKpiKey)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[140px]">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All</ZoruSelectItem>
                                <ZoruSelectItem value="active">Active (has replies)</ZoruSelectItem>
                                <ZoruSelectItem value="pending">Pending (no replies)</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
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
                            value={filters.author}
                            onChange={(e) => updateFilter('author', e.target.value)}
                            placeholder="Author id…"
                            className="h-9 w-[160px]"
                        />
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
                            Export CSV
                        </ZoruButton>
                    </div>
                }
                empty={
                    !loading && discussions.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <h3 className="text-base font-medium text-zoru-ink">
                                No discussions yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Start a thread to surface a question or proposal for the team.
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/workspace/discussions/new">
                                    <Plus className="h-4 w-4" /> Start discussion
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={loading && discussions.length === 0}
            >
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <ZoruStatCard
                            label="Active threads"
                            value={kpis.active}
                            icon={<MessagesSquare className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Pending replies"
                            value={kpis.pending}
                            icon={<MessageSquare className="h-4 w-4" />}
                        />
                        <ZoruStatCard label="Categories" value={kpis.categories} />
                        <ZoruStatCard label="Total comments" value={kpis.totalComments} />
                    </div>

                    {view === 'table' ? (
                        <DiscussionsTable
                            visible={visible}
                            categories={categories}
                            repliesByDiscussion={repliesByDiscussion}
                            onDelete={(id) => setDeleteId(id)}
                        />
                    ) : (
                        <DiscussionsKanban
                            grouped={grouped}
                            categories={categories}
                            repliesByDiscussion={repliesByDiscussion}
                        />
                    )}
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={(o) => !o && setDeleteId(null)}
                title="Delete this discussion?"
                description="The discussion and all replies will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />
        </>
    );
}

function DiscussionsTable({
    visible,
    categories,
    repliesByDiscussion,
    onDelete,
}: {
    visible: (WsDiscussion & { _id: string })[];
    categories: (WsDiscussionCategory & { _id: string })[];
    repliesByDiscussion: Map<string, WsDiscussionReply[]>;
    onDelete: (id: string) => void;
}) {
    return (
        <div className="overflow-x-auto rounded-[var(--zoru-radius-lg)] border border-zoru-line">
            <table className="w-full min-w-[800px] text-[13px]">
                <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                    <tr>
                        {['Title', 'Category', 'Replies', 'Last activity', 'Status', ''].map(
                            (h) => (
                                <th key={h} className="px-3 py-2 text-left font-medium">
                                    {h}
                                </th>
                            ),
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                    {visible.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-6 text-center text-zoru-ink-muted">
                                No discussions match the current filters.
                            </td>
                        </tr>
                    ) : null}
                    {visible.map((d) => {
                        const cat = categories.find((c) => c._id === d.category_id);
                        const replies = repliesByDiscussion.get(d._id) ?? [];
                        const la = lastActivity(d, repliesByDiscussion);
                        const status = replies.length > 0 ? 'active' : 'pending';
                        return (
                            <tr key={d._id} className="hover:bg-zoru-surface">
                                <td className="px-3 py-2">
                                    <EntityRowLink
                                        href={`/dashboard/crm/workspace/discussions/${d._id}`}
                                        label={d.title}
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <ZoruBadge variant="ghost">{cat?.name ?? 'Uncategorized'}</ZoruBadge>
                                </td>
                                <td className="px-3 py-2 text-zoru-ink-muted">{replies.length}</td>
                                <td className="px-3 py-2 text-zoru-ink-muted">
                                    {la ? la.toLocaleString() : '—'}
                                </td>
                                <td className="px-3 py-2">
                                    <StatusPill
                                        label={status}
                                        tone={status === 'active' ? 'green' : 'amber'}
                                    />
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <ZoruButton
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onDelete(d._id)}
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

function DiscussionsKanban({
    grouped,
    categories,
    repliesByDiscussion,
}: {
    grouped: Map<string, (WsDiscussion & { _id: string })[]>;
    categories: (WsDiscussionCategory & { _id: string })[];
    repliesByDiscussion: Map<string, WsDiscussionReply[]>;
}) {
    const columns: { id: string; name: string }[] = [
        ...categories.map((c) => ({ id: c._id, name: c.name })),
        { id: UNCAT, name: 'Uncategorized' },
    ];
    return (
        <div className="overflow-x-auto">
            <div className="flex min-w-full gap-3">
                {columns.map((col) => {
                    const items = grouped.get(col.id) ?? [];
                    return (
                        <div
                            key={col.id}
                            className="flex w-72 shrink-0 flex-col gap-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface-2 p-2"
                        >
                            <div className="mb-1 flex items-center justify-between px-1">
                                <h4 className="text-[12.5px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                                    {col.name}
                                </h4>
                                <ZoruBadge variant="ghost">{items.length}</ZoruBadge>
                            </div>
                            <div className="flex flex-col gap-2">
                                {items.map((d) => {
                                    const replies = repliesByDiscussion.get(d._id) ?? [];
                                    return (
                                        <Link
                                            key={d._id}
                                            href={`/dashboard/crm/workspace/discussions/${d._id}`}
                                            className="block"
                                        >
                                            <ZoruCard className="text-[12.5px] hover:bg-zoru-bg">
                                                <p className="font-semibold text-zoru-ink">
                                                    {d.title}
                                                </p>
                                                {d.description ? (
                                                    <p className="mt-1 line-clamp-2 text-zoru-ink-muted">
                                                        {d.description}
                                                    </p>
                                                ) : null}
                                                <div className="mt-2 flex items-center gap-2 text-[11.5px] text-zoru-ink-muted">
                                                    <MessageSquare className="h-3 w-3" />
                                                    {replies.length} reply
                                                    {replies.length === 1 ? '' : 's'}
                                                    <span>·</span>
                                                    <span>{fmtDate(d.createdAt)}</span>
                                                </div>
                                            </ZoruCard>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default DiscussionsListClient;
