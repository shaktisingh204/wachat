'use client';

/**
 * AnnouncementsListClient, full-feature list (rebuilt on the 20ui design system).
 *
 * Features:
 *  - KPI strip: total, active/pinned, published this month, total views
 *  - Filters: title search, status, audience, pinned toggle, date range
 *  - Table: Title, Published by, Audience, Pinned, Published at, Status,
 *           Views, Actions (edit / delete)
 *  - Bulk: publish, archive, delete
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
    Search,
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
    Card,
    CardBody,
    CardTitle,
    Checkbox,
    EmptyState,
    Field,
    IconButton,
    Input,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    StatCard,
    Table,
    TBody,
    Td,
    THead,
    Th,
    Tr,
    useToast,
} from '@/components/sabcrm/20ui';
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
import type { AnnouncementKpis } from '@/app/actions/crm-announcements.actions.types';

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

const EMPTY_CELL = '-';

function fmtDate(v: string | undefined): string {
    if (!v) return EMPTY_CELL;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return EMPTY_CELL;
    return d.toISOString().slice(0, 10);
}

export function AnnouncementsListClient({
    initialItems,
    initialKpis,
}: ListClientProps): React.JSX.Element {
    const { toast } = useToast();

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

    // -- Selection --
    const allSelected = visible.length > 0 && visible.every((a) => selected.has(a._id));
    const someSelected = visible.some((a) => selected.has(a._id));
    const toggleOne = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const toggleAll = (on: boolean) =>
        setSelected(on ? new Set(visible.map((a) => a._id)) : new Set());

    // -- Single delete --
    const confirmDelete = async () => {
        if (!pendingDelete) return;
        const r = await deleteAnnouncement(pendingDelete);
        if (r.success) {
            toast.success('Announcement deleted');
            refetch();
        } else {
            toast.error({ title: 'Delete failed', description: r.error });
        }
        setPendingDelete(null);
    };

    // -- Bulk actions --
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
            tone: result.fail > 0 ? 'danger' : 'success',
        });
        setSelected(new Set());
        setBulkConfirmMode(null);
        refetch();
    }, [selected, bulkConfirmMode, refetch, toast]);

    // -- Export --
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

    const showEmpty = !loading && items.length === 0;

    return (
        <>
            <div className="flex w-full flex-col gap-4">
                {/* Page header */}
                <PageHeader>
                    <PageHeaderHeading>
                        <PageTitle>Announcements</PageTitle>
                        <PageDescription>
                            Broadcast updates, schedule rollouts, and track who has acknowledged.
                        </PageDescription>
                    </PageHeaderHeading>
                    <PageActions>
                        <div className="w-full sm:w-64">
                            <Field label="Search announcements">
                                <Input
                                    type="search"
                                    value={searchDraft}
                                    onChange={(e) => {
                                        setSearchDraft(e.target.value);
                                        onSearch(e.target.value);
                                    }}
                                    placeholder="Search title or body"
                                    iconLeft={Search}
                                />
                            </Field>
                        </div>
                        <Link
                            href="/dashboard/sabconnect/announcements/new"
                            className="u-btn u-btn--primary u-btn--md"
                        >
                            <Plus size={14} aria-hidden="true" />
                            <span className="u-btn__label">New announcement</span>
                        </Link>
                    </PageActions>
                </PageHeader>

                {/* Filters row */}
                <div className="flex flex-wrap items-end gap-2">
                    <Select
                        value={statusFilter}
                        onValueChange={(v) =>
                            setStatusFilter(v as CrmAnnouncementStatus | 'all')
                        }
                    >
                        <SelectTrigger aria-label="Status filter" className="w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={audienceFilter} onValueChange={(v) => setAudienceFilter(v)}>
                        <SelectTrigger aria-label="Audience filter" className="w-[160px]">
                            <SelectValue placeholder="Audience" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Any audience</SelectItem>
                            <SelectItem value="everyone">Everyone</SelectItem>
                            <SelectItem value="department">Department</SelectItem>
                            <SelectItem value="team">Team</SelectItem>
                            <SelectItem value="role">Role</SelectItem>
                        </SelectContent>
                    </Select>
                    <Checkbox
                        checked={pinnedOnly}
                        onChange={(e) => setPinnedOnly(e.target.checked)}
                        label="Pinned only"
                    />
                    <Field label="Published from">
                        <Input
                            type="date"
                            value={fromIso}
                            onChange={(e) => setFromIso(e.target.value)}
                            className="w-[150px]"
                        />
                    </Field>
                    <Field label="Published to">
                        <Input
                            type="date"
                            value={toIso}
                            onChange={(e) => setToIso(e.target.value)}
                            className="w-[150px]"
                        />
                    </Field>
                    {hasActiveFilters ? (
                        <Button variant="ghost" size="sm" iconLeft={X} onClick={clear}>
                            Clear
                        </Button>
                    ) : null}
                    <Button variant="ghost" size="sm" onClick={exportCsv}>
                        Export CSV
                    </Button>
                </div>

                {/* Bulk action banner */}
                {selected.size > 0 ? (
                    <div
                        role="region"
                        aria-label="Bulk actions"
                        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-[var(--st-shadow-sm)]"
                    >
                        <span className="text-[13px] text-[var(--st-text-secondary)]">
                            {selected.size} selected
                        </span>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                iconLeft={Send}
                                onClick={() => setBulkConfirmMode('publish')}
                            >
                                Publish
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                iconLeft={Archive}
                                onClick={() => setBulkConfirmMode('archive')}
                            >
                                Archive
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                iconLeft={Trash2}
                                onClick={() => setBulkConfirmMode('delete')}
                            >
                                Delete
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
                ) : null}

                {/* Body */}
                {showEmpty ? (
                    <Card className="flex min-h-[240px] items-center justify-center">
                        <EmptyState
                            icon={Megaphone}
                            title="No announcements yet"
                            description="Draft and publish your first company announcement."
                            action={
                                <Link
                                    href="/dashboard/sabconnect/announcements/new"
                                    className="u-btn u-btn--primary u-btn--md"
                                >
                                    <Plus size={14} aria-hidden="true" />
                                    <span className="u-btn__label">Create announcement</span>
                                </Link>
                            }
                        />
                    </Card>
                ) : (
                    <div className="flex flex-col gap-4">
                        {/* Dashboard strip */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {/* KPIs */}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:col-span-2">
                                <StatCard label="Total" value={kpis.total} icon={Megaphone} />
                                <StatCard
                                    label="Active / Pinned"
                                    value={kpis.activeOrPinned}
                                    icon={Pin}
                                />
                                <StatCard
                                    label="Published this month"
                                    value={kpis.publishedThisMonth}
                                    icon={Send}
                                />
                                <StatCard label="Total Views" value={totalViews} icon={Eye} />
                            </div>

                            {/* Quick actions */}
                            <Card padding="md" className="flex flex-col justify-center gap-3">
                                <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-[var(--st-text-secondary)]">
                                    Quick Actions
                                </CardTitle>
                                <CardBody className="flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
                                    <Link
                                        href="/dashboard/sabconnect/announcements/new?audience=all"
                                        className="u-btn u-btn--outline u-btn--sm flex-1 justify-start"
                                    >
                                        <Zap size={13} aria-hidden="true" />
                                        <span className="u-btn__label">Company Update</span>
                                    </Link>
                                    <Link
                                        href="/dashboard/sabconnect/announcements/new?status=draft"
                                        className="u-btn u-btn--outline u-btn--sm flex-1 justify-start"
                                    >
                                        <PenTool size={13} aria-hidden="true" />
                                        <span className="u-btn__label">Draft Post</span>
                                    </Link>
                                </CardBody>
                            </Card>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
                            <Table className="min-w-[900px]" hover>
                                <THead>
                                    <Tr>
                                        <Th align="center">
                                            <Checkbox
                                                aria-label="Select all"
                                                checked={allSelected}
                                                indeterminate={someSelected && !allSelected}
                                                onChange={(e) => toggleAll(e.target.checked)}
                                            />
                                        </Th>
                                        <Th>Title</Th>
                                        <Th>Published by</Th>
                                        <Th>Audience</Th>
                                        <Th>Pinned</Th>
                                        <Th>Published at</Th>
                                        <Th>Status</Th>
                                        <Th>Views</Th>
                                        <Th align="right">Actions</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {visible.length === 0 ? (
                                        <Tr>
                                            <Td colSpan={9} align="center">
                                                <span className="text-[var(--st-text-secondary)]">
                                                    No announcements match the current filters.
                                                </span>
                                            </Td>
                                        </Tr>
                                    ) : null}
                                    {visible.map((a) => {
                                        const tone =
                                            STATUS_TONE[a.status as CrmAnnouncementStatus] ??
                                            'neutral';
                                        const checked = selected.has(a._id);
                                        return (
                                            <Tr key={a._id} selected={checked}>
                                                <Td align="center">
                                                    <Checkbox
                                                        aria-label={`Select ${a.title}`}
                                                        checked={checked}
                                                        onChange={() => toggleOne(a._id)}
                                                    />
                                                </Td>
                                                <Td>
                                                    <EntityRowLink
                                                        href={`/dashboard/sabconnect/announcements/${a._id}`}
                                                        label={a.title}
                                                    />
                                                </Td>
                                                <Td>
                                                    <span className="text-[var(--st-text-secondary)]">
                                                        {a.authorName ?? a.authorId ?? EMPTY_CELL}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    <span className="capitalize text-[var(--st-text-secondary)]">
                                                        {a.audience ?? EMPTY_CELL}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    {a.pinned ? (
                                                        <Badge tone="warning">
                                                            <Pin className="h-3 w-3" aria-hidden="true" />
                                                            Pinned
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-[var(--st-text-secondary)]">
                                                            {EMPTY_CELL}
                                                        </span>
                                                    )}
                                                </Td>
                                                <Td>
                                                    <span className="text-[var(--st-text-secondary)]">
                                                        {fmtDate(a.publishedAt ?? a.publishAt)}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    <StatusPill label={a.status} tone={tone} />
                                                </Td>
                                                <Td>
                                                    <span className="text-[var(--st-text-secondary)]">
                                                        {a.viewCount ?? EMPTY_CELL}
                                                    </span>
                                                </Td>
                                                <Td align="right">
                                                    <div className="flex justify-end gap-1">
                                                        <Link
                                                            href={`/dashboard/sabconnect/announcements/${a._id}/edit`}
                                                            className="u-btn u-btn--ghost u-btn--sm"
                                                        >
                                                            <span className="u-btn__label">Edit</span>
                                                        </Link>
                                                        <IconButton
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={Trash2}
                                                            label={`Delete ${a.title}`}
                                                            onClick={() => setPendingDelete(a._id)}
                                                        />
                                                    </div>
                                                </Td>
                                            </Tr>
                                        );
                                    })}
                                </TBody>
                            </Table>
                        </div>
                    </div>
                )}
            </div>

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
                confirmTone={bulkConfirmMode === 'delete' ? 'danger' : 'primary'}
                onConfirm={() => {
                    void runBulk();
                }}
            />
        </>
    );
}

export default AnnouncementsListClient;
