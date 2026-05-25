'use client';

/**
 * AnnouncementsListClient — full-feature list (§1B W7).
 *
 * Features:
 *  - KPI strip: total · active/pinned · published this month · drafts
 *  - Filters: title search · status · audience · pinned toggle · date range
 *  - Table: Title · Published by · Audience · Pinned · Published at · Status ·
 *           Views · Actions (edit / delete)
 *  - Bulk: publish · archive · delete
 *  - Export CSV via crm-list-export
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import {
    Archive,
    Megaphone,
    Pin,
    Plus,
    Send,
    Trash2,
    X,
    Eye,
    Zap,
    PenTool,
} from 'lucide-react';

import {
    Badge,
    Button,
    Checkbox,
    Input,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    StatCard,
    Card,
    useZoruToast,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
    deleteAnnouncement,
    getAnnouncements,
    bulkPublishAnnouncements,
    bulkArchiveAnnouncements,
    bulkDeleteAnnouncements,
} from '@/app/actions/crm-announcements.actions';
import type {
    CrmAnnouncementDoc,
    CrmAnnouncementStatus,
} from '@/lib/rust-client/crm-announcements';
import type { AnnouncementKpis } from '@/app/actions/crm-announcements.actions';

interface ListClientProps {
    initialItems: CrmAnnouncementDoc[];
    initialKpis: AnnouncementKpis;
}

const STATUS_TONE: Record<CrmAnnouncementStatus, StatusTone> = {
    draft: 'neutral',
    scheduled: 'amber',
    published: 'green',
    archived: 'neutral',
};

function fmtDate(v: string | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toISOString().slice(0, 10);
}

export function AnnouncementsListClient({
    initialItems,
    initialKpis,
}: ListClientProps): React.JSX.Element {
    const { toast } = useZoruToast();

    const [items, setItems] = React.useState<CrmAnnouncementDoc[]>(initialItems);
    const [kpis, setKpis] = React.useState<AnnouncementKpis>(initialKpis);

    const [statusFilter, setStatusFilter] = React.useState<CrmAnnouncementStatus | 'all'>('all');
    const [audienceFilter, setAudienceFilter] = React.useState<string>('all');
    const [pinnedOnly, setPinnedOnly] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [searchDraft, setSearchDraft] = React.useState('');
    const [fromIso, setFromIso] = React.useState('');
    const [toIso, setToIso] = React.useState('');

    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);
    const [bulkConfirmMode, setBulkConfirmMode] = React.useState<
        'delete' | 'publish' | 'archive' | null
    >(null);
    const [loading, startTransition] = React.useTransition();

    const refetch = React.useCallback(() => {
        startTransition(async () => {
            const r = await getAnnouncements();
            setItems(r.items);
            // Recompute KPIs client-side from fresh items to avoid an extra round-trip.
            const now = new Date();
            let activeOrPinned = 0;
            let publishedThisMonth = 0;
            let drafts = 0;
            for (const a of r.items) {
                if (a.status === 'published' || a.pinned) activeOrPinned += 1;
                if (a.status === 'draft') drafts += 1;
                if (a.status === 'published' && a.publishedAt) {
                    const d = new Date(a.publishedAt);
                    if (
                        d.getFullYear() === now.getFullYear() &&
                        d.getMonth() === now.getMonth()
                    ) publishedThisMonth += 1;
                }
            }
            setKpis({
                total: r.items.length,
                activeOrPinned,
                publishedThisMonth,
                drafts,
            });
        });
    }, []);

    const totalViews = React.useMemo(() => {
        return items.reduce((acc, a) => acc + (a.viewCount ?? 0), 0);
    }, [items]);

    const onSearch = useDebouncedCallback((v: string) => setSearch(v), 200);

    const from = fromIso ? new Date(fromIso).getTime() : null;
    const to = toIso ? new Date(toIso).getTime() : null;

    const visible = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return items
            .filter((a) => statusFilter === 'all' || a.status === statusFilter)
            .filter((a) => {
                if (audienceFilter === 'all') return true;
                const aud = (a.audience ?? '') as string;
                if (audienceFilter === 'everyone') return aud === 'all';
                return aud === audienceFilter;
            })
            .filter((a) => !pinnedOnly || a.pinned)
            .filter((a) => {
                if (!q) return true;
                return (
                    a.title.toLowerCase().includes(q) ||
                    a.body.toLowerCase().includes(q)
                );
            })
            .filter((a) => {
                if (from === null && to === null) return true;
                const ts = a.publishedAt ?? a.publishAt ?? a.createdAt;
                if (!ts) return false;
                const ms = new Date(ts).getTime();
                if (from !== null && ms < from) return false;
                if (to !== null && ms > to) return false;
                return true;
            })
            .sort((a, b) => {
                const ap = a.pinned ? 1 : 0;
                const bp = b.pinned ? 1 : 0;
                if (ap !== bp) return bp - ap;
                return (
                    new Date(b.createdAt ?? 0).getTime() -
                    new Date(a.createdAt ?? 0).getTime()
                );
            });
    }, [items, search, statusFilter, audienceFilter, pinnedOnly, from, to]);

    const hasActiveFilters =
        statusFilter !== 'all' ||
        audienceFilter !== 'all' ||
        pinnedOnly ||
        search !== '' ||
        fromIso !== '' ||
        toIso !== '';

    const clear = () => {
        setStatusFilter('all');
        setAudienceFilter('all');
        setPinnedOnly(false);
        setSearch('');
        setSearchDraft('');
        setFromIso('');
        setToIso('');
    };

    // ── Selection ──
    const allSelected = visible.length > 0 && visible.every((a) => selected.has(a._id));
    const toggleOne = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const toggleAll = (on: boolean) =>
        setSelected(on ? new Set(visible.map((a) => a._id)) : new Set());

    // ── Single delete ──
    const confirmDelete = async () => {
        if (!pendingDelete) return;
        const r = await deleteAnnouncement(pendingDelete);
        if (r.success) {
            toast({ title: 'Announcement deleted' });
            refetch();
        } else {
            toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
        }
        setPendingDelete(null);
    };

    // ── Bulk actions ──
    const runBulk = React.useCallback(async () => {
        const ids = Array.from(selected);
        if (ids.length === 0 || !bulkConfirmMode) return;
        let result: { ok: number; fail: number };
        if (bulkConfirmMode === 'publish') result = await bulkPublishAnnouncements(ids);
        else if (bulkConfirmMode === 'archive') result = await bulkArchiveAnnouncements(ids);
        else result = await bulkDeleteAnnouncements(ids);
        toast({
            title: `Bulk ${bulkConfirmMode}`,
            description: `${result.ok} succeeded${result.fail ? `, ${result.fail} failed` : ''}`,
            variant: result.fail > 0 ? 'destructive' : undefined,
        });
        setSelected(new Set());
        setBulkConfirmMode(null);
        refetch();
    }, [selected, bulkConfirmMode, refetch, toast]);

    // ── Export ──
    const exportCsv = React.useCallback(() => {
        const rows = (selected.size > 0 ? items.filter((a) => selected.has(a._id)) : visible).map(
            (a) => ({
                ID: a._id,
                Title: a.title,
                'Published by': a.authorName ?? a.authorId ?? '',
                Audience: a.audience ?? '',
                Pinned: a.pinned ? 'yes' : 'no',
                'Published at': fmtDate(a.publishedAt ?? a.publishAt),
                Status: a.status,
                Views: a.viewCount ?? 0,
            }),
        );
        downloadCsv(
            `announcements-${dateStamp()}.csv`,
            ['ID', 'Title', 'Published by', 'Audience', 'Pinned', 'Published at', 'Status', 'Views'],
            rows,
        );
    }, [items, visible, selected]);

    const bulkConfirmLabel =
        bulkConfirmMode === 'publish'
            ? `Publish ${selected.size} announcement(s)?`
            : bulkConfirmMode === 'archive'
              ? `Archive ${selected.size} announcement(s)?`
              : `Delete ${selected.size} announcement(s)?`;

    return (
        <>
            <EntityListShell
                title="Announcements"
                subtitle="Broadcast updates, schedule rollouts, and track who has acknowledged."
                search={{
                    value: searchDraft,
                    onChange: (v) => {
                        setSearchDraft(v);
                        onSearch(v);
                    },
                    placeholder: 'Search title or body…',
                }}
                primaryAction={
                    <Button asChild>
                        <Link href="/dashboard/crm/workspace/announcements/new">
                            <Plus className="h-4 w-4" /> New announcement
                        </Link>
                    </Button>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <Select
                            value={statusFilter}
                            onValueChange={(v) =>
                                setStatusFilter(v as CrmAnnouncementStatus | 'all')
                            }
                        >
                            <ZoruSelectTrigger className="h-9 w-[150px]">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                                <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                                <ZoruSelectItem value="scheduled">Scheduled</ZoruSelectItem>
                                <ZoruSelectItem value="published">Published</ZoruSelectItem>
                                <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                        <Select
                            value={audienceFilter}
                            onValueChange={(v) => setAudienceFilter(v)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[160px]">
                                <ZoruSelectValue placeholder="Audience" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">Any audience</ZoruSelectItem>
                                <ZoruSelectItem value="everyone">Everyone</ZoruSelectItem>
                                <ZoruSelectItem value="department">Department</ZoruSelectItem>
                                <ZoruSelectItem value="team">Team</ZoruSelectItem>
                                <ZoruSelectItem value="role">Role</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                        <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-zoru-ink">
                            <Checkbox
                                checked={pinnedOnly}
                                onCheckedChange={(v) => setPinnedOnly(!!v)}
                                aria-label="Pinned only"
                            />
                            Pinned only
                        </label>
                        <Input
                            type="date"
                            value={fromIso}
                            onChange={(e) => setFromIso(e.target.value)}
                            className="h-9 w-[150px]"
                            aria-label="Published from"
                        />
                        <Input
                            type="date"
                            value={toIso}
                            onChange={(e) => setToIso(e.target.value)}
                            className="h-9 w-[150px]"
                            aria-label="Published to"
                        />
                        {hasActiveFilters ? (
                            <Button variant="ghost" size="sm" onClick={clear}>
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
                            <span className="text-[13px] text-zoru-ink-muted">
                                {selected.size} selected
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkConfirmMode('publish')}
                                >
                                    <Send className="h-3.5 w-3.5" /> Publish
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkConfirmMode('archive')}
                                >
                                    <Archive className="h-3.5 w-3.5" /> Archive
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
                    !loading && items.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <h3 className="text-base font-medium text-zoru-ink">
                                No announcements yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Draft and publish your first company announcement.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/workspace/announcements/new">
                                    <Plus className="h-4 w-4" /> Create announcement
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={loading && items.length === 0}
            >
                <div className="flex flex-col gap-4">
                    {/* Dashboard Strip */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* KPIs */}
                        <div className="md:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatCard
                                label="Total"
                                value={kpis.total}
                                icon={<Megaphone className="h-4 w-4" />}
                            />
                            <StatCard
                                label="Active / Pinned"
                                value={kpis.activeOrPinned}
                                icon={<Pin className="h-4 w-4" />}
                            />
                            <StatCard
                                label="Published this month"
                                value={kpis.publishedThisMonth}
                                icon={<Send className="h-4 w-4" />}
                            />
                            <StatCard
                                label="Total Views"
                                value={totalViews}
                                icon={<Eye className="h-4 w-4" />}
                            />
                        </div>

                        {/* Quick Actions */}
                        <Card className="flex flex-col p-4 justify-center gap-3 shadow-none border-zoru-line bg-zoru-surface-2/50">
                            <h3 className="text-[13px] font-medium text-zoru-ink-muted uppercase tracking-wider">Quick Actions</h3>
                            <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-2">
                                <Button variant="outline" size="sm" className="flex-1 justify-start bg-zoru-bg" asChild>
                                    <Link href="/dashboard/crm/workspace/announcements/new?audience=all">
                                        <Zap className="mr-2 h-3.5 w-3.5" /> Company Update
                                    </Link>
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1 justify-start bg-zoru-bg" asChild>
                                    <Link href="/dashboard/crm/workspace/announcements/new?status=draft">
                                        <PenTool className="mr-2 h-3.5 w-3.5" /> Draft Post
                                    </Link>
                                </Button>
                            </div>
                        </Card>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-[var(--zoru-radius-lg)] border border-zoru-line">
                        <table className="w-full min-w-[900px] text-[13px]">
                            <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                <tr>
                                    <th className="px-3 py-2">
                                        <Checkbox
                                            aria-label="Select all"
                                            checked={allSelected}
                                            onCheckedChange={(v) => toggleAll(!!v)}
                                        />
                                    </th>
                                    {[
                                        'Title',
                                        'Published by',
                                        'Audience',
                                        'Pinned',
                                        'Published at',
                                        'Status',
                                        'Views',
                                        '',
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            className="px-3 py-2 text-left font-medium"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                                {visible.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className="p-6 text-center text-zoru-ink-muted"
                                        >
                                            No announcements match the current filters.
                                        </td>
                                    </tr>
                                ) : null}
                                {visible.map((a) => {
                                    const tone =
                                        STATUS_TONE[a.status as CrmAnnouncementStatus] ??
                                        'neutral';
                                    const checked = selected.has(a._id);
                                    return (
                                        <tr key={a._id} className="hover:bg-zoru-surface">
                                            <td className="px-3 py-2">
                                                <Checkbox
                                                    aria-label={`Select ${a.title}`}
                                                    checked={checked}
                                                    onCheckedChange={() => toggleOne(a._id)}
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <EntityRowLink
                                                    href={`/dashboard/crm/workspace/announcements/${a._id}`}
                                                    label={a.title}
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-zoru-ink-muted">
                                                {a.authorName ?? a.authorId ?? '—'}
                                            </td>
                                            <td className="px-3 py-2 capitalize text-zoru-ink-muted">
                                                {a.audience ?? '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                {a.pinned ? (
                                                    <Badge variant="warning">
                                                        <Pin className="h-3 w-3" /> Pinned
                                                    </Badge>
                                                ) : (
                                                    <span className="text-zoru-ink-muted">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-zoru-ink-muted">
                                                {fmtDate(a.publishedAt ?? a.publishAt)}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusPill label={a.status} tone={tone} />
                                            </td>
                                            <td className="px-3 py-2 text-zoru-ink-muted">
                                                {a.viewCount ?? '—'}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link
                                                            href={`/dashboard/crm/workspace/announcements/${a._id}/edit`}
                                                        >
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setPendingDelete(a._id)}
                                                        aria-label={`Delete ${a.title}`}
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
                </div>
            </EntityListShell>

            {/* Single delete */}
            <ConfirmDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
                title="Delete this announcement?"
                description="The announcement will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={confirmDelete}
            />

            {/* Bulk confirm */}
            <ConfirmDialog
                open={!!bulkConfirmMode}
                onOpenChange={(o) => !o && setBulkConfirmMode(null)}
                title={bulkConfirmLabel}
                description={
                    bulkConfirmMode === 'delete'
                        ? 'Selected announcements will be permanently removed.'
                        : `All selected announcements will be ${bulkConfirmMode}d.`
                }
                requireTyped={bulkConfirmMode === 'delete' ? 'DELETE' : undefined}
                confirmLabel={
                    bulkConfirmMode === 'publish'
                        ? 'Publish'
                        : bulkConfirmMode === 'archive'
                          ? 'Archive'
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

export default AnnouncementsListClient;
