'use client';

/**
 * OKRs — §1D Deep-list page.
 *
 * Built on EntityListShell + HrDeepListBody. Talks to the Rust-backed
 * `crm-okrs.actions` module (single CRUD + new bulk wrappers).
 *
 * KPI strip:
 *   - Total OKRs
 *   - On track
 *   - At risk
 *   - Completion rate (current quarter)
 *
 * Filters: search · status · period (cycle) · owner · date range
 * Bulk:    archive · delete · export CSV / XLSX
 * Export:  via @/lib/crm-list-export
 * Pagination: client-side via PaginationBar (controlled)
 */

import * as React from 'react';
import Link from 'next/link';
import { Plus, Target } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruProgress,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
  bulkArchiveOkrs,
  bulkDeleteOkrs,
  deleteOkr,
  getOkrs,
} from '@/app/actions/crm-okrs.actions';
import type { CrmOkrDoc, CrmOkrStatus } from '@/lib/rust-client/crm-okrs';

import { HrDeepListBody, type DeepColumn } from '../_components/hr-deep-list-body';

const BASE = '/dashboard/crm/hr/okrs';

const STATUS_OPTIONS: Array<{ value: CrmOkrStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'on_track', label: 'On track' },
    { value: 'at_risk', label: 'At risk' },
    { value: 'behind', label: 'Behind' },
    { value: 'completed', label: 'Completed' },
    { value: 'missed', label: 'Missed' },
    { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<CrmOkrStatus, StatusTone> = {
    draft: 'neutral',
    in_progress: 'blue',
    on_track: 'green',
    at_risk: 'amber',
    behind: 'red',
    completed: 'green',
    missed: 'red',
    archived: 'neutral',
};

function statusLabel(s: string): string {
    return s.replace(/_/g, ' ');
}

function clampPercent(n: unknown): number {
    const v = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, Math.round(v)));
}

function currentQuarter(): string {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `Q${q} ${now.getFullYear()}`;
}

function rowDate(r: CrmOkrDoc): number | null {
    const v = r.updatedAt ?? r.createdAt;
    if (!v) return null;
    const t = new Date(v as string).getTime();
    return Number.isFinite(t) ? t : null;
}

export default function OkrsListPage(): React.JSX.Element {
    const [okrs, setOkrs] = React.useState<CrmOkrDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmOkrStatus | 'all'>('all');
    const [period, setPeriod] = React.useState<string>('all');
    const [owner, setOwner] = React.useState<string>('all');
    const [dateFrom, setDateFrom] = React.useState<string>('');
    const [dateTo, setDateTo] = React.useState<string>('');

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getOkrs({ limit: 500 });
            setOkrs(res.items ?? []);
        } catch {
            setOkrs([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    /* ── filter options (derived) ───────────────────────────────────── */

    const periodOptions = React.useMemo(() => {
        const set = new Set<string>();
        for (const o of okrs) if (o.period) set.add(o.period);
        return Array.from(set)
            .sort()
            .map((v) => ({ value: v, label: v }));
    }, [okrs]);

    const ownerOptions = React.useMemo(() => {
        const seen = new Map<string, string>();
        for (const o of okrs) {
            const id = o.ownerId ?? '';
            if (id && !seen.has(id)) seen.set(id, o.ownerName ?? id);
        }
        return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
    }, [okrs]);

    /* ── filtered rows ──────────────────────────────────────────────── */

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        const from = dateFrom ? new Date(dateFrom).getTime() : null;
        const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
        return okrs.filter((o) => {
            if (statusFilter !== 'all' && o.status !== statusFilter) return false;
            if (period !== 'all' && o.period !== period) return false;
            if (owner !== 'all' && o.ownerId !== owner) return false;
            if (q) {
                const hay = `${o.objective ?? ''} ${o.ownerName ?? ''} ${o.period ?? ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            const ts = rowDate(o);
            if (from !== null && (ts == null || ts < from)) return false;
            if (to !== null && (ts == null || ts > to)) return false;
            return true;
        });
    }, [okrs, search, statusFilter, period, owner, dateFrom, dateTo]);

    /* ── KPIs ──────────────────────────────────────────────────────── */

    const kpis = React.useMemo(() => {
        const total = okrs.length;
        const onTrack = okrs.filter((o) => o.status === 'on_track').length;
        const atRisk = okrs.filter(
            (o) => o.status === 'at_risk' || o.status === 'behind',
        ).length;
        const thisQ = currentQuarter();
        const inQuarter = okrs.filter((o) => o.period === thisQ);
        const completion = inQuarter.length
            ? Math.round(
                  inQuarter.reduce((acc, o) => acc + clampPercent(o.progress), 0) /
                      inQuarter.length,
              )
            : 0;
        return { total, onTrack, atRisk, completion, thisQ };
    }, [okrs]);

    /* ── columns ───────────────────────────────────────────────────── */

    const columns: DeepColumn<CrmOkrDoc>[] = React.useMemo(
        () => [
            {
                key: 'objective',
                label: 'Objective',
                render: (o) => (
                    <span className="block max-w-[280px] truncate font-medium">
                        {o.objective}
                    </span>
                ),
            },
            {
                key: 'period',
                label: 'Period',
                render: (o) => (
                    <span className="font-mono text-[12px]">{o.period ?? '—'}</span>
                ),
            },
            {
                key: 'owner',
                label: 'Owner',
                render: (o) => o.ownerName ?? o.ownerId ?? '—',
            },
            {
                key: 'progress',
                label: 'Progress',
                render: (o) => {
                    const pct = clampPercent(o.progress);
                    return (
                        <div className="flex items-center gap-2">
                            <ZoruProgress value={pct} className="h-2 w-24" />
                            <span className="font-mono text-[11.5px] tabular-nums">
                                {pct}%
                            </span>
                        </div>
                    );
                },
            },
            {
                key: 'confidence',
                label: 'Confidence',
                numeric: true,
                render: (o) =>
                    typeof o.confidence === 'number'
                        ? `${clampPercent(o.confidence)}%`
                        : '—',
            },
            {
                key: 'status',
                label: 'Status',
                render: (o) => {
                    const s = (o.status ?? 'draft') as CrmOkrStatus;
                    return <StatusPill label={statusLabel(s)} tone={STATUS_TONE[s] ?? 'neutral'} />;
                },
            },
        ],
        [],
    );

    return (
        <EntityListShell
            title="OKRs"
            subtitle="Objectives and key results — individual, team, and company level."
            primaryAction={
                <ZoruButton asChild>
                    <Link href={`${BASE}/new`}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> New OKR
                    </Link>
                </ZoruButton>
            }
            filters={
                <div className="flex flex-wrap items-center gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                        <ZoruButton
                            key={opt.value}
                            variant={statusFilter === opt.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter(opt.value)}
                        >
                            {opt.label}
                        </ZoruButton>
                    ))}
                </div>
            }
            loading={isLoading && okrs.length === 0}
        >
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <ZoruCard className="p-3">
                        <p className="text-xs text-zoru-ink-muted">Total OKRs</p>
                        <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.total}</p>
                    </ZoruCard>
                    <ZoruCard className="p-3">
                        <p className="text-xs text-zoru-ink-muted">On track</p>
                        <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.onTrack}</p>
                    </ZoruCard>
                    <ZoruCard className="p-3">
                        <p className="text-xs text-zoru-ink-muted">At risk</p>
                        <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.atRisk}</p>
                    </ZoruCard>
                    <ZoruCard className="p-3">
                        <p className="text-xs text-zoru-ink-muted">Completion ({kpis.thisQ})</p>
                        <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.completion}%</p>
                    </ZoruCard>
                </div>

                {okrs.length === 0 && !isLoading ? (
                    <ZoruCard className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-6">
                        <Target className="h-8 w-8 text-zoru-ink-muted" aria-hidden="true" />
                        <p className="text-sm text-zoru-ink-muted">No OKRs yet.</p>
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="h-4 w-4" /> Add first OKR
                            </Link>
                        </ZoruButton>
                    </ZoruCard>
                ) : (
                    <HrDeepListBody<CrmOkrDoc>
                        rows={filtered}
                        columns={columns}
                        getRowId={(o) => o._id}
                        detailHref={(o) => `${BASE}/${o._id}`}
                        editHref={(o) => `${BASE}/${o._id}/edit`}
                        onDeleteOne={deleteOkr}
                        onBulkDelete={bulkDeleteOkrs}
                        onBulkArchive={bulkArchiveOkrs}
                        onAfterChange={() => {
                            void refresh();
                        }}
                        search={search}
                        setSearch={setSearch}
                        searchPlaceholder="Search objectives…"
                        cycleOptions={periodOptions}
                        cycle={period}
                        setCycle={setPeriod}
                        cycleLabel="Period"
                        ownerOptions={ownerOptions}
                        owner={owner}
                        setOwner={setOwner}
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        setDateFrom={setDateFrom}
                        setDateTo={setDateTo}
                        exportColumns={[
                            { header: 'Objective', value: (o) => o.objective ?? '' },
                            { header: 'Period', value: (o) => o.period ?? '' },
                            { header: 'Owner', value: (o) => o.ownerName ?? o.ownerId ?? '' },
                            { header: 'Progress %', value: (o) => clampPercent(o.progress) },
                            {
                                header: 'Confidence %',
                                value: (o) =>
                                    typeof o.confidence === 'number'
                                        ? clampPercent(o.confidence)
                                        : '',
                            },
                            { header: 'Status', value: (o) => o.status ?? '' },
                        ]}
                        exportName="okrs"
                        emptyText="No OKRs match these filters."
                    />
                )}
            </div>
        </EntityListShell>
    );
}
