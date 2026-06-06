'use client';

import { Badge, Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard } from '@/components/sabcrm/20ui/compat';
import {
  useRouter,
  usePathname } from 'next/navigation';
import { Activity,
  Filter,
  X } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityPicker } from '@/components/crm/entity-picker';

/**
 * <ActivityFeedClient> — client shell for the CRM tenant-wide activity
 * feed at `/dashboard/crm/activity` (CRM_REBUILD_PLAN.md §5.4).
 *
 * The initial page is server-rendered via `getCrmActivityFeed` and
 * passed in as `initialFeed`. From there:
 *   - Filter changes push a new `?` URL via `router.push`, which
 *     re-runs the server component with the new filters.
 *   - "Load more" calls `getCrmActivityFeed({ ..., cursor })` directly
 *     and concatenates the new page client-side. No URL churn, so the
 *     back button doesn't paginate.
 *
 * Visually mirrors the existing CRM list pages: <EntityListShell>
 * chrome, StatCard KPI strip, Card list grouped by date bucket.
 */

import * as React from 'react';

import {
    getCrmActivityFeed,
    type CrmActivityFeedResult,
    type CrmActivityRow,
} from '@/app/actions/crm-activity.actions';

import { ActivityRow } from './activity-row';

/* ─── Entity-kind whitelist ─────────────────────────────────────────── */

/**
 * Snapshot of the CRM audit-log entityKind values we expect to see.
 * Open-ended (Mongo column is free-form string), but this curated list
 * keeps the dropdown manageable. Add new kinds as new actions ship.
 */
const ENTITY_KIND_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'lead', label: 'Lead' },
    { value: 'deal', label: 'Deal' },
    { value: 'client', label: 'Client' },
    { value: 'contact', label: 'Contact' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'quotation', label: 'Quotation' },
    { value: 'proposal', label: 'Proposal' },
    { value: 'project', label: 'Project' },
    { value: 'task', label: 'Task' },
    { value: 'ticket', label: 'Ticket' },
    { value: 'item', label: 'Item' },
    { value: 'employee', label: 'Employee' },
    { value: 'asset', label: 'Asset' },
    { value: 'warehouse', label: 'Warehouse' },
];

/* ─── Date bucketing ─────────────────────────────────────────────────── */

function startOfDay(ms: number): number {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

type Bucket = 'Today' | 'Yesterday' | 'This week' | 'Earlier';
const BUCKETS_ORDER: Bucket[] = ['Today', 'Yesterday', 'This week', 'Earlier'];

function bucketFor(ts: number): Bucket {
    const today = startOfDay(Date.now());
    const yesterday = today - 24 * 60 * 60 * 1000;
    const weekStart = today - 6 * 24 * 60 * 60 * 1000;
    if (ts >= today) return 'Today';
    if (ts >= yesterday) return 'Yesterday';
    if (ts >= weekStart) return 'This week';
    return 'Earlier';
}

/* ─── Props ──────────────────────────────────────────────────────────── */

export interface ActivityFeedClientProps {
    initialFeed: CrmActivityFeedResult;
    currentUserId?: string;
    initialFilters: {
        entityKind: string;
        actorId: string;
        from: string;
        to: string;
    };
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function ActivityFeedClient({
    initialFeed,
    currentUserId,
    initialFilters,
}: ActivityFeedClientProps): React.JSX.Element {
    const router = useRouter();
    const pathname = usePathname();

    const [filters, setFilters] = React.useState(initialFilters);
    const [rows, setRows] = React.useState<CrmActivityRow[]>(initialFeed.items);
    const [cursor, setCursor] = React.useState<string | null>(initialFeed.nextCursor);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const loadMoreRef = React.useRef<HTMLDivElement>(null);
    const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);

    // Re-sync local state when the server-rendered initialFeed changes
    // (i.e. after a filter push). Identity check on the prop is fine —
    // Next gives us a fresh object on each searchParams change.
    React.useEffect(() => {
        setRows(initialFeed.items);
        setCursor(initialFeed.nextCursor);
        setLoadMoreError(null);
    }, [initialFeed]);

    /* ── Filter URL push ─────────────────────────────────────────── */

    const applyFilters = React.useCallback(() => {
        const sp = new URLSearchParams();
        if (filters.entityKind) sp.set('entityKind', filters.entityKind);
        if (filters.actorId) sp.set('actorId', filters.actorId);
        if (filters.from) sp.set('from', filters.from);
        if (filters.to) sp.set('to', filters.to);
        const qs = sp.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
    }, [filters, pathname, router]);

    const clearFilters = React.useCallback(() => {
        setFilters({ entityKind: '', actorId: '', from: '', to: '' });
        router.push(pathname);
    }, [pathname, router]);

    const hasFilters = Object.values(filters).some((v) => Boolean(v));

    /* ── Cursor pagination ───────────────────────────────────────── */

    
    React.useEffect(() => {
        const target = loadMoreRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && cursor && !loadingMore && !loadMoreError) {
                    handleLoadMore();
                }
            },
            { rootMargin: '200px' }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [cursor, loadingMore, loadMoreError, handleLoadMore]);

    const handleLoadMore = React.useCallback(async () => {
        if (!cursor || loadingMore) return;
        setLoadingMore(true);
        setLoadMoreError(null);
        try {
            const next = await getCrmActivityFeed({
                entityKind: filters.entityKind || undefined,
                actorId: filters.actorId || undefined,
                from: filters.from || undefined,
                to: filters.to || undefined,
                cursor,
                limit: 50,
            });
            if (next.error) {
                setLoadMoreError(next.error);
            } else {
                setRows((prev) => prev.concat(next.items));
                setCursor(next.nextCursor);
            }
        } catch (err) {
            setLoadMoreError(err instanceof Error ? err.message : 'Failed to load more.');
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, loadingMore, filters]);

    /* ── Bucketize loaded rows for display ───────────────────────── */

    const bucketed = React.useMemo(() => {
        const groups: Record<Bucket, CrmActivityRow[]> = {
            Today: [],
            Yesterday: [],
            'This week': [],
            Earlier: [],
        };
        for (const r of rows) {
            const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
            groups[bucketFor(t)].push(r);
        }
        return groups;
    }, [rows]);

    /* ── Render ──────────────────────────────────────────────────── */

    const kpis = initialFeed.kpis;
    const isEmpty = rows.length === 0;

    return (
        <EntityListShell
            title="Activity"
            subtitle="Tenant-wide audit trail of everything happening across the CRM."
            filters={
                <div className="flex flex-wrap items-end gap-2">
                    <div className="w-44">
                        <Label className="text-[11px]">Entity kind</Label>
                        <Select
                            value={filters.entityKind || 'all'}
                            onValueChange={(v) =>
                                setFilters((f) => ({
                                    ...f,
                                    entityKind: v === 'all' ? '' : v,
                                }))
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All entities" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All entities</SelectItem>
                                {ENTITY_KIND_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-64">
                        <Label className="text-[11px]">Actor</Label>
                        <EntityPicker
                            entity="employee"
                            value={filters.actorId || null}
                            onChange={(next) =>
                                setFilters((f) => ({
                                    ...f,
                                    actorId: (next as string | null) ?? '',
                                }))
                            }
                            placeholder="Any actor"
                        />
                    </div>
                    <div className="w-36">
                        <Label className="text-[11px]" htmlFor="act-from">
                            From
                        </Label>
                        <Input
                            id="act-from"
                            type="date"
                            value={filters.from}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, from: e.target.value }))
                            }
                        />
                    </div>
                    <div className="w-36">
                        <Label className="text-[11px]" htmlFor="act-to">
                            To
                        </Label>
                        <Input
                            id="act-to"
                            type="date"
                            value={filters.to}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, to: e.target.value }))
                            }
                        />
                    </div>
                    <Button size="sm" onClick={applyFilters} className="mb-1">
                        <Filter className="h-3.5 w-3.5" /> Apply
                    </Button>
                    {hasFilters ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="mb-1"
                        >
                            <X className="h-3.5 w-3.5" /> Clear
                        </Button>
                    ) : null}
                </div>
            }
            empty={
                isEmpty ? (
                    <div className="flex flex-col items-center gap-3 p-8">
                        <Activity className="h-8 w-8 text-[var(--st-text-secondary)]" />
                        <h3 className="text-base font-medium text-[var(--st-text)]">No activity</h3>
                        <p className="max-w-sm text-center text-sm text-[var(--st-text-secondary)]">
                            {initialFeed.error
                                ? initialFeed.error
                                : hasFilters
                                  ? 'No events match the current filters.'
                                  : 'Audit rows appear here whenever anyone on your team takes action across the CRM.'}
                        </p>
                    </div>
                ) : null
            }
        >
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Events today"
                        value={kpis.eventsToday.toLocaleString()}
                    />
                    <StatCard
                        label="Events this week"
                        value={kpis.eventsThisWeek.toLocaleString()}
                    />
                    <StatCard
                        label="Top actor (week)"
                        value={
                            kpis.topActorId
                                ? kpis.topActorId === currentUserId
                                    ? 'You'
                                    : `User ${kpis.topActorId.slice(-6)}`
                                : '—'
                        }
                    />
                    <StatCard
                        label="Top entity (week)"
                        value={kpis.topEntityKind ?? '—'}
                    />
                </div>

                {BUCKETS_ORDER.map((b) =>
                    bucketed[b].length === 0 ? null : (
                        <BucketCard
                            key={b}
                            title={b}
                            rows={bucketed[b]}
                            currentUserId={currentUserId}
                        />
                    ),
                )}

                {cursor ? (
                    <div ref={loadMoreRef} className="flex flex-col items-center gap-2 py-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                        >
                            {loadingMore ? 'Loading…' : 'Load more'}
                        </Button>
                        {loadMoreError ? (
                            <p className="text-xs text-[var(--st-danger)]">{loadMoreError}</p>
                        ) : null}
                    </div>
                ) : rows.length > 0 ? (
                    <p className="py-3 text-center text-xs text-[var(--st-text-secondary)]">
                        End of feed.
                    </p>
                ) : null}
            </div>
        </EntityListShell>
    );
}

/* ─── Bucket card ────────────────────────────────────────────────────── */

interface BucketCardProps {
    title: string;
    rows: CrmActivityRow[];
    currentUserId?: string;
}

function BucketCard({ title, rows, currentUserId }: BucketCardProps): React.JSX.Element {
    return (
        <Card className="p-0">
            <div className="flex items-center gap-2 border-b border-[var(--st-border)] p-4">
                <h2 className="text-[14px] font-semibold text-[var(--st-text)]">{title}</h2>
                <Badge variant="secondary">{rows.length}</Badge>
            </div>
            <ul className="divide-y divide-[var(--st-border)]">
                {rows.map((entry) => (
                    <ActivityRow
                        key={entry._id}
                        entry={entry}
                        currentUserId={currentUserId}
                    />
                ))}
            </ul>
        </Card>
    );
}
