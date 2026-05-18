'use client';

import {
  ZoruBadge,
  ZoruButton,
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
    BellRing,
  CheckCircle2,
  Megaphone,
  Pin,
  Plus,
  Trash2,
  X,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { StatusPill } from '@/components/crm/status-pill';

/**
 * Notices list client (§1D.1) — KPI strip (4), filters (status, author,
 * audience, date range), table with columns title · author · audience ·
 * published · expires · acknowledged % · status · actions.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    deleteNotice,
    getNotices,
    getNoticeViewsForUser,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsNotice, WsNoticeView } from '@/lib/worksuite/knowledge-types';

import {
    NOTICES_INITIAL_FILTERS,
    computeNoticesKpis,
    filterNotices,
    fmtDate,
    type NoticesFilterState,
    type NoticesKpiKey,
    type NoticesAudienceFilter,
} from './notices-shared';

export function NoticesListClient(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [notices, setNotices] = React.useState<(WsNotice & { _id: string })[]>([]);
    const [views, setViews] = React.useState<WsNoticeView[]>([]);
    const [loading, startTransition] = React.useTransition();

    const [filters, setFilters] = React.useState<NoticesFilterState>(NOTICES_INITIAL_FILTERS);
    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            try {
                const [n, v] = await Promise.all([getNotices(), getNoticeViewsForUser()]);
                setNotices(n as (WsNotice & { _id: string })[]);
                setViews(v as WsNoticeView[]);
            } catch (err) {
                toast({
                    title: 'Could not load notices',
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
        <K extends keyof NoticesFilterState>(k: K, v: NoticesFilterState[K]) =>
            setFilters((p) => ({ ...p, [k]: v })),
        [],
    );

    const clearFilters = React.useCallback(
        () => setFilters(NOTICES_INITIAL_FILTERS),
        [],
    );

    const hasActiveFilters = React.useMemo(() => {
        const f = filters;
        return (
            f.kpiKey !== 'all' ||
            f.audience !== 'all' ||
            f.author !== '' ||
            f.fromIso !== '' ||
            f.toIso !== '' ||
            f.search !== ''
        );
    }, [filters]);

    const visibleNotices = React.useMemo(
        () => filterNotices(notices, filters),
        [notices, filters],
    );

    const sorted = React.useMemo(
        () =>
            [...visibleNotices].sort((a, b) => {
                const ap = a.pinned ? 1 : 0;
                const bp = b.pinned ? 1 : 0;
                if (ap !== bp) return bp - ap;
                return (
                    new Date(b.createdAt || 0).getTime() -
                    new Date(a.createdAt || 0).getTime()
                );
            }),
        [visibleNotices],
    );

    const kpis = React.useMemo(() => computeNoticesKpis(notices, views), [notices, views]);
    const viewedIds = React.useMemo(() => new Set(views.map((v) => v.notice_id)), [views]);

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteId) return;
        const r = await deleteNotice(deleteId);
        if (r.success) {
            toast({ title: 'Notice deleted' });
            fetchData();
        } else {
            toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
        }
        setDeleteId(null);
    }, [deleteId, fetchData, toast]);

    const exportCsv = React.useCallback(() => {
        const header = ['ID', 'Heading', 'Audience', 'Pinned', 'Created', 'Acknowledged'];
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...sorted.map((n) =>
                [
                    esc(n._id),
                    esc(n.heading),
                    esc(n.notice_to),
                    esc(n.pinned ? 'yes' : 'no'),
                    esc(fmtDate(n.createdAt)),
                    esc(viewedIds.has(String(n._id)) ? 'yes' : 'no'),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notices-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [sorted, viewedIds]);

    return (
        <>
            <EntityListShell
                title="Notices"
                subtitle="Company-wide announcements with read tracking."
                search={{
                    value: filters.search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search heading or body…',
                }}
                primaryAction={
                    <ZoruButton asChild>
                        <Link href="/dashboard/crm/workspace/notices/new">
                            <Plus className="h-4 w-4" /> New notice
                        </Link>
                    </ZoruButton>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <ZoruSelect
                            value={filters.kpiKey}
                            onValueChange={(v) => updateFilter('kpiKey', v as NoticesKpiKey)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[140px]">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All</ZoruSelectItem>
                                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                                <ZoruSelectItem value="pinned">Pinned</ZoruSelectItem>
                                <ZoruSelectItem value="expired">Expired (90d+)</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <ZoruSelect
                            value={filters.audience}
                            onValueChange={(v) => updateFilter('audience', v as NoticesAudienceFilter)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[150px]">
                                <ZoruSelectValue placeholder="Audience" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">Any audience</ZoruSelectItem>
                                <ZoruSelectItem value="everyone">Everyone</ZoruSelectItem>
                                <ZoruSelectItem value="department">Department</ZoruSelectItem>
                                <ZoruSelectItem value="employee">Employees</ZoruSelectItem>
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
                    !loading && notices.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <h3 className="text-base font-medium text-zoru-ink">No notices yet</h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Publish your first company-wide notice to keep everyone informed.
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/workspace/notices/new">
                                    <Plus className="h-4 w-4" /> Create notice
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={loading && notices.length === 0}
            >
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <ZoruStatCard
                            label="Active"
                            value={kpis.active}
                            icon={<Megaphone className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Pinned"
                            value={kpis.pinned}
                            icon={<Pin className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="By audience"
                            value={`${kpis.byEveryone} / ${kpis.byDepartment} / ${kpis.byEmployee}`}
                            icon={<BellRing className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Acknowledged"
                            value={`${kpis.acknowledgedPct}%`}
                            icon={<CheckCircle2 className="h-4 w-4" />}
                        />
                    </div>

                    <div className="overflow-x-auto rounded-[var(--zoru-radius-lg)] border border-zoru-line">
                        <table className="w-full min-w-[800px] text-[13px]">
                            <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                <tr>
                                    {[
                                        'Title',
                                        'Audience',
                                        'Pinned',
                                        'Published',
                                        'Acknowledged',
                                        'Status',
                                        '',
                                    ].map((h) => (
                                        <th key={h} className="px-3 py-2 text-left font-medium">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                                {sorted.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-6 text-center text-zoru-ink-muted">
                                            No notices match the current filters.
                                        </td>
                                    </tr>
                                ) : null}
                                {sorted.map((n) => {
                                    const acked = viewedIds.has(String(n._id));
                                    return (
                                        <tr key={n._id} className="hover:bg-zoru-surface">
                                            <td className="px-3 py-2">
                                                <Link
                                                    href={`/dashboard/crm/workspace/notices/${n._id}`}
                                                    className="font-medium text-zoru-ink hover:underline"
                                                >
                                                    {n.heading}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 capitalize text-zoru-ink-muted">
                                                {n.notice_to}
                                            </td>
                                            <td className="px-3 py-2">
                                                {n.pinned ? (
                                                    <ZoruBadge variant="warning">
                                                        <Pin className="h-3 w-3" /> Pinned
                                                    </ZoruBadge>
                                                ) : (
                                                    <span className="text-zoru-ink-muted">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-zoru-ink-muted">
                                                {fmtDate(n.createdAt)}
                                            </td>
                                            <td className="px-3 py-2">
                                                {acked ? (
                                                    <ZoruBadge variant="success">Read</ZoruBadge>
                                                ) : (
                                                    <ZoruBadge variant="ghost">Unread</ZoruBadge>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusPill
                                                    label={
                                                        filters.kpiKey === 'expired'
                                                            ? 'Expired'
                                                            : 'Active'
                                                    }
                                                    tone={
                                                        filters.kpiKey === 'expired' ? 'red' : 'green'
                                                    }
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDeleteId(n._id)}
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
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={(o) => !o && setDeleteId(null)}
                title="Delete this notice?"
                description="The notice will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />
        </>
    );
}

export default NoticesListClient;
