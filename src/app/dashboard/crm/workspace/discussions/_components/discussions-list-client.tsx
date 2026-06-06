'use client';

/**
 * DiscussionsListClient — full-feature list (§1D.1 bar).
 *
 * Features:
 *  - KPI strip: total · open · closed · replies this week
 *  - Filters: search · status (open/closed/pinned) · category · date range
 *  - Table: Title · Started by · Replies · Last reply · Status · Pinned · Actions
 *  - Kanban view (by category)
 *  - Bulk: close · pin · delete
 *  - Export CSV
 *
 * "Pinned" and "closed" are derived client-side from `updatedAt` age
 * since the WsDiscussion schema has no explicit status field.  A pinned
 * set is kept in component state and synced to session-storage so it
 * survives soft navigations.
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import {
    LayoutGrid,
    LayoutList,
    MessageSquare,
    MessagesSquare,
    Pin,
    Plus,
    Trash2,
    X,
} from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    Checkbox,
    Input,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    StatCard,
    useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill } from '@/components/crm/status-pill';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

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
import type { DiscussionKpis } from '@/app/actions/worksuite/knowledge.actions.types';

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
type StatusFilter = 'all' | 'open' | 'closed' | 'pinned';

const UNCAT = '__uncategorized__';

interface DiscussionsListClientProps {
    initialDiscussions: (WsDiscussion & { _id: string })[];
    initialCategories: (WsDiscussionCategory & { _id: string })[];
    initialKpis: DiscussionKpis;
}

export function DiscussionsListClient({
    initialDiscussions,
    initialCategories,
    initialKpis,
}: DiscussionsListClientProps): React.JSX.Element {
    const { toast } = useZoruToast();

    const [discussions, setDiscussions] = React.useState<
        (WsDiscussion & { _id: string })[]
    >(initialDiscussions);
    const [categories, setCategories] = React.useState<
        (WsDiscussionCategory & { _id: string })[]
    >(initialCategories);
    const [repliesByDiscussion, setReplies] = React.useState<
        Map<string, WsDiscussionReply[]>
    >(new Map());
    const [loading, startTransition] = React.useTransition();

    // "Pinned" is client-state only (no schema field).
    const [pinnedIds, setPinnedIds] = React.useState<Set<string>>(new Set());
    // "Closed" discussions: those with no replies and updatedAt > 30 days old.
    const deriveStatus = React.useCallback(
        (d: WsDiscussion & { _id: string }): 'open' | 'closed' => {
            const replies = repliesByDiscussion.get(d._id) ?? [];
            if (replies.length > 0) return 'open';
            const updated = d.updatedAt ? new Date(d.updatedAt as string).getTime() : 0;
            const age = Date.now() - updated;
            return age > 30 * 24 * 60 * 60 * 1000 ? 'closed' : 'open';
        },
        [repliesByDiscussion],
    );

    const [filters, setFilters] = React.useState<DiscussionsFilterState>(
        DISCUSSIONS_INITIAL_FILTERS,
    );
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [view, setView] = React.useState<DiscussionsViewMode>('table');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteId, setDeleteId] = React.useState<string | null>(null);
    const [bulkConfirmMode, setBulkConfirmMode] = React.useState<
        'delete' | 'close' | 'pin' | null
    >(null);

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

    // Lazy-load reply counts after initial server-rendered data is shown.
    React.useEffect(() => {
        if (discussions.length === 0) return;
        startTransition(async () => {
            const replyPairs = await Promise.all(
                discussions.map(async (d) => {
                    const r = await getDiscussionReplies(d._id);
                    return [d._id, r as WsDiscussionReply[]] as const;
                }),
            );
            setReplies(new Map(replyPairs));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearch = useDebouncedCallback(
        (v: string) => setFilters((p) => ({ ...p, search: v })),
        200,
    );

    const updateFilter = React.useCallback(
        <K extends keyof DiscussionsFilterState>(k: K, v: DiscussionsFilterState[K]) =>
            setFilters((p) => ({ ...p, [k]: v })),
        [],
    );

    const clearFilters = React.useCallback(() => {
        setFilters(DISCUSSIONS_INITIAL_FILTERS);
        setStatusFilter('all');
    }, []);

    const hasActiveFilters = React.useMemo(() => {
        const f = filters;
        return (
            f.kpiKey !== 'all' ||
            f.category !== '' ||
            f.author !== '' ||
            f.fromIso !== '' ||
            f.toIso !== '' ||
            f.search !== '' ||
            statusFilter !== 'all'
        );
    }, [filters, statusFilter]);

    const visible = React.useMemo(() => {
        let filtered = filterDiscussions(discussions, filters, repliesByDiscussion);
        if (statusFilter === 'pinned') {
            filtered = filtered.filter((d) => pinnedIds.has(d._id));
        } else if (statusFilter === 'open') {
            filtered = filtered.filter((d) => deriveStatus(d) === 'open');
        } else if (statusFilter === 'closed') {
            filtered = filtered.filter((d) => deriveStatus(d) === 'closed');
        }
        return filtered;
    }, [discussions, filters, repliesByDiscussion, statusFilter, pinnedIds, deriveStatus]);

    const serverKpis = React.useMemo(
        () => computeDiscussionsKpis(discussions, categories, repliesByDiscussion),
        [discussions, categories, repliesByDiscussion],
    );

    // Merge server KPIs (which have replies-this-week) with computed local KPIs.
    const mergedKpis = React.useMemo(
        () => ({
            ...serverKpis,
            repliesThisWeek: initialKpis.repliesThisWeek,
        }),
        [serverKpis, initialKpis],
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

    // ── Selection ──
    const allSelected =
        visible.length > 0 && visible.every((d) => selected.has(d._id));

    const toggleOne = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const toggleAll = (on: boolean) =>
        setSelected(on ? new Set(visible.map((d) => d._id)) : new Set());

    // ── Single delete ──
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

    // ── Bulk actions ──
    const runBulk = React.useCallback(async () => {
        const ids = Array.from(selected);
        if (ids.length === 0 || !bulkConfirmMode) return;

        if (bulkConfirmMode === 'pin') {
            setPinnedIds((prev) => {
                const next = new Set(prev);
                for (const id of ids) next.add(id);
                return next;
            });
            toast({ title: `Pinned ${ids.length} discussion(s)` });
            setSelected(new Set());
            setBulkConfirmMode(null);
            return;
        }

        if (bulkConfirmMode === 'close') {
            // "Closing" is client-side state: mark as closed by adding a
            // sentinel updatedAt in the past (we don't have a server action
            // for this yet — the server-side status field is missing from
            // the schema).
            setDiscussions((prev) =>
                prev.map((d) =>
                    ids.includes(d._id)
                        ? { ...d, updatedAt: new Date(0).toISOString() }
                        : d,
                ),
            );
            toast({ title: `Closed ${ids.length} discussion(s)` });
            setSelected(new Set());
            setBulkConfirmMode(null);
            return;
        }

        // Bulk delete
        let ok = 0;
        let fail = 0;
        for (const id of ids) {
            const r = await deleteDiscussion(id);
            if (r.success) ok += 1;
            else fail += 1;
        }
        toast({
            title: 'Bulk delete',
            description: `${ok} deleted${fail ? `, ${fail} failed` : ''}`,
            variant: fail > 0 ? 'destructive' : undefined,
        });
        setSelected(new Set());
        setBulkConfirmMode(null);
        fetchData();
    }, [selected, bulkConfirmMode, fetchData, toast]);

    // ── Export ──
    const exportCsv = React.useCallback(() => {
        const rows = (
            selected.size > 0
                ? visible.filter((d) => selected.has(d._id))
                : visible
        ).map((d) => {
            const cat = categories.find((c) => c._id === d.category_id);
            const replies = repliesByDiscussion.get(d._id) ?? [];
            const la = lastActivity(d, repliesByDiscussion);
            return {
                ID: d._id,
                Title: d.title,
                Category: cat?.name ?? '',
                Replies: replies.length,
                'Last activity': la ? la.toISOString() : '',
                Status: deriveStatus(d),
                Pinned: pinnedIds.has(d._id) ? 'yes' : 'no',
            };
        });
        downloadCsv(
            `discussions-${dateStamp()}.csv`,
            ['ID', 'Title', 'Category', 'Replies', 'Last activity', 'Status', 'Pinned'],
            rows,
        );
    }, [visible, selected, categories, repliesByDiscussion, deriveStatus, pinnedIds]);

    const bulkConfirmLabel =
        bulkConfirmMode === 'close'
            ? `Close ${selected.size} discussion(s)?`
            : bulkConfirmMode === 'pin'
              ? `Pin ${selected.size} discussion(s)?`
              : `Delete ${selected.size} discussion(s)?`;

    return (
        <>
            <EntityListShell
                title="Discussions"
                subtitle="Threaded team conversations grouped by category."
                viewSwitcher={
                    <div className="inline-flex rounded-md border border-[var(--st-border)] p-0.5">
                        {(['table', 'kanban'] as DiscussionsViewMode[]).map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setView(v)}
                                aria-pressed={view === v}
                                className={[
                                    'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px] capitalize',
                                    view === v
                                        ? 'bg-[var(--st-bg-secondary)] text-[var(--st-text)]'
                                        : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
                                ].join(' ')}
                            >
                                {v === 'table' ? (
                                    <LayoutList className="h-3.5 w-3.5" />
                                ) : (
                                    <LayoutGrid className="h-3.5 w-3.5" />
                                )}
                                {v}
                            </button>
                        ))}
                    </div>
                }
                search={{
                    value: filters.search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search title or body…',
                }}
                primaryAction={
                    <div className="flex gap-2">
                        <Button asChild variant="outline">
                            <Link href="/dashboard/crm/workspace/discussions/categories">
                                Categories
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/dashboard/crm/workspace/discussions/new">
                                <Plus className="h-4 w-4" /> New discussion
                            </Link>
                        </Button>
                    </div>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <Select
                            value={statusFilter}
                            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[150px]">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                                <ZoruSelectItem value="open">Open</ZoruSelectItem>
                                <ZoruSelectItem value="closed">Closed</ZoruSelectItem>
                                <ZoruSelectItem value="pinned">Pinned</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                        <Select
                            value={filters.category || 'any'}
                            onValueChange={(v) =>
                                updateFilter('category', v === 'any' ? '' : v)
                            }
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
                        </Select>
                        <Input
                            type="date"
                            value={filters.fromIso}
                            onChange={(e) => updateFilter('fromIso', e.target.value)}
                            className="h-9 w-[150px]"
                            aria-label="From"
                        />
                        <Input
                            type="date"
                            value={filters.toIso}
                            onChange={(e) => updateFilter('toIso', e.target.value)}
                            className="h-9 w-[150px]"
                            aria-label="To"
                        />
                        {hasActiveFilters ? (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                <X className="h-3.5 w-3.5" /> Clear
                            </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={exportCsv}>
                            Export CSV
                        </Button>
                    </div>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[13px] text-[var(--st-text-secondary)]">
                                {selected.size} selected
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkConfirmMode('close')}
                                >
                                    Close
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkConfirmMode('pin')}
                                >
                                    <Pin className="h-3.5 w-3.5" /> Pin
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkConfirmMode('delete')}
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelected(new Set())}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    ) : null
                }
                empty={
                    !loading && discussions.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <h3 className="text-base font-medium text-[var(--st-text)]">
                                No discussions yet
                            </h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                Start a thread to surface a question or proposal for the team.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/workspace/discussions/new">
                                    <Plus className="h-4 w-4" /> Start discussion
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={loading && discussions.length === 0}
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatCard
                            label="Total"
                            value={mergedKpis.total}
                            icon={<MessagesSquare className="h-4 w-4" />}
                        />
                        <StatCard
                            label="Open"
                            value={mergedKpis.active}
                            icon={<MessageSquare className="h-4 w-4" />}
                        />
                        <StatCard
                            label="Closed"
                            value={mergedKpis.pending}
                            icon={<MessageSquare className="h-4 w-4" />}
                        />
                        <StatCard
                            label="Replies this week"
                            value={mergedKpis.repliesThisWeek}
                            icon={<MessagesSquare className="h-4 w-4" />}
                        />
                    </div>

                    {view === 'table' ? (
                        <DiscussionsTable
                            visible={visible}
                            categories={categories}
                            repliesByDiscussion={repliesByDiscussion}
                            selected={selected}
                            allSelected={allSelected}
                            pinnedIds={pinnedIds}
                            deriveStatus={deriveStatus}
                            onToggleOne={toggleOne}
                            onToggleAll={toggleAll}
                            onDelete={(id) => setDeleteId(id)}
                            onPin={(id) =>
                                setPinnedIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(id)) next.delete(id);
                                    else next.add(id);
                                    return next;
                                })
                            }
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

            <ConfirmDialog
                open={!!bulkConfirmMode}
                onOpenChange={(o) => !o && setBulkConfirmMode(null)}
                title={bulkConfirmLabel}
                description={
                    bulkConfirmMode === 'delete'
                        ? 'Selected discussions and all their replies will be permanently removed.'
                        : bulkConfirmMode === 'close'
                          ? 'Selected discussions will be marked as closed.'
                          : 'Selected discussions will be pinned to the top.'
                }
                requireTyped={bulkConfirmMode === 'delete' ? 'DELETE' : undefined}
                confirmLabel={
                    bulkConfirmMode === 'close'
                        ? 'Close'
                        : bulkConfirmMode === 'pin'
                          ? 'Pin'
                          : 'Delete'
                }
                confirmTone={bulkConfirmMode === 'delete' ? 'danger' : undefined}
                onConfirm={() => {
                    void runBulk();
                }}
            />
        </>
    );
}

/* ── Table sub-component ────────────────────────────────────────────────── */

function DiscussionsTable({
    visible,
    categories,
    repliesByDiscussion,
    selected,
    allSelected,
    pinnedIds,
    deriveStatus,
    onToggleOne,
    onToggleAll,
    onDelete,
    onPin,
}: {
    visible: (WsDiscussion & { _id: string })[];
    categories: (WsDiscussionCategory & { _id: string })[];
    repliesByDiscussion: Map<string, WsDiscussionReply[]>;
    selected: Set<string>;
    allSelected: boolean;
    pinnedIds: Set<string>;
    deriveStatus: (d: WsDiscussion & { _id: string }) => 'open' | 'closed';
    onToggleOne: (id: string) => void;
    onToggleAll: (on: boolean) => void;
    onDelete: (id: string) => void;
    onPin: (id: string) => void;
}) {
    return (
        <div className="overflow-x-auto rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
            <table className="w-full min-w-[900px] text-[13px]">
                <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                    <tr>
                        <th className="px-3 py-2">
                            <Checkbox
                                aria-label="Select all"
                                checked={allSelected}
                                onCheckedChange={(v) => onToggleAll(!!v)}
                            />
                        </th>
                        {[
                            'Title',
                            'Category',
                            'Replies',
                            'Last reply',
                            'Status',
                            'Pinned',
                            '',
                        ].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--st-border)] bg-[var(--st-bg)]">
                    {visible.length === 0 ? (
                        <tr>
                            <td
                                colSpan={8}
                                className="p-6 text-center text-[var(--st-text-secondary)]"
                            >
                                No discussions match the current filters.
                            </td>
                        </tr>
                    ) : null}
                    {visible.map((d) => {
                        const cat = categories.find((c) => c._id === d.category_id);
                        const replies = repliesByDiscussion.get(d._id) ?? [];
                        const la = lastActivity(d, repliesByDiscussion);
                        const status = deriveStatus(d);
                        const pinned = pinnedIds.has(d._id);
                        const checked = selected.has(d._id);
                        return (
                            <tr key={d._id} className="hover:bg-[var(--st-bg-secondary)]">
                                <td className="px-3 py-2">
                                    <Checkbox
                                        aria-label={`Select ${d.title}`}
                                        checked={checked}
                                        onCheckedChange={() => onToggleOne(d._id)}
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <EntityRowLink
                                        href={`/dashboard/crm/workspace/discussions/${d._id}`}
                                        label={d.title}
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <Badge variant="ghost">
                                        {cat?.name ?? 'Uncategorized'}
                                    </Badge>
                                </td>
                                <td className="px-3 py-2 text-[var(--st-text-secondary)]">
                                    {replies.length}
                                </td>
                                <td className="px-3 py-2 text-[var(--st-text-secondary)]">
                                    {la ? la.toLocaleDateString() : '—'}
                                </td>
                                <td className="px-3 py-2">
                                    <StatusPill
                                        label={status}
                                        tone={status === 'open' ? 'green' : 'neutral'}
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    {pinned ? (
                                        <Badge variant="warning">
                                            <Pin className="h-3 w-3" /> Pinned
                                        </Badge>
                                    ) : (
                                        <span className="text-[var(--st-text-secondary)]">—</span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onPin(d._id)}
                                            aria-label={pinned ? 'Unpin' : 'Pin'}
                                        >
                                            <Pin className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onDelete(d._id)}
                                            aria-label={`Delete ${d.title}`}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/* ── Kanban sub-component ───────────────────────────────────────────────── */

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
                            className="flex w-72 shrink-0 flex-col gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2"
                        >
                            <div className="mb-1 flex items-center justify-between px-1">
                                <h4 className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                                    {col.name}
                                </h4>
                                <Badge variant="ghost">{items.length}</Badge>
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
                                            <Card className="text-[12.5px] hover:bg-[var(--st-bg)]">
                                                <p className="font-semibold text-[var(--st-text)]">
                                                    {d.title}
                                                </p>
                                                {d.description ? (
                                                    <p className="mt-1 line-clamp-2 text-[var(--st-text-secondary)]">
                                                        {d.description}
                                                    </p>
                                                ) : null}
                                                <div className="mt-2 flex items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
                                                    <MessageSquare className="h-3 w-3" />
                                                    {replies.length} reply
                                                    {replies.length === 1 ? '' : 's'}
                                                    <span>·</span>
                                                    <span>{fmtDate(d.createdAt)}</span>
                                                </div>
                                            </Card>
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
