'use client';

/**
 * Admin-side viewer for the compliance audit log.
 *
 * Consumes a pre-aggregated {@link AuditSummary} produced by
 * `auditSummaryFor` on the server and offers client-side filtering by
 * actor, action and a free-form date range.  The component is
 * intentionally read-only — destructive operations belong on the
 * legal-hold / DSR pages, which already have their own confirmation
 * flows.
 */
import * as React from 'react';
import { Search, ShieldAlert, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type {
    AuditBucket,
    AuditSummary,
} from '@/lib/compliance/dashboards';
import type { AuditEvent } from '@/lib/compliance/types';

/* ── Helpers ────────────────────────────────────────────────────────── */

function formatTimestamp(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return iso;
    }
}

function isFailure(evt: AuditEvent): boolean {
    return (evt.metadata as Record<string, unknown> | undefined)?.outcome
        === 'error';
}

/* ── Subcomponents ──────────────────────────────────────────────────── */

interface BucketCardProps {
    title: string;
    items: AuditBucket[];
    emptyLabel?: string;
    onSelect?: (key: string) => void;
    selectedKey?: string | null;
}

function BucketCard({ title, items, emptyLabel, onSelect, selectedKey }: BucketCardProps) {
    const top = items.slice(0, 5);
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {title}
            </h3>
            {top.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">
                    {emptyLabel ?? 'No data in range.'}
                </p>
            ) : (
                <ul className="mt-3 space-y-1.5">
                    {top.map((b) => (
                        <li key={b.key}>
                            <button
                                type="button"
                                onClick={() => onSelect?.(b.key)}
                                className={cn(
                                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
                                    'hover:bg-slate-100',
                                    selectedKey === b.key && 'bg-slate-100 font-medium',
                                )}
                            >
                                <span className="truncate text-slate-700">{b.key}</span>
                                <span className="ml-2 flex shrink-0 items-center gap-2 text-xs text-slate-500">
                                    {b.failures > 0 ? (
                                        <span className="rounded-full bg-red-50 px-1.5 py-0.5 font-medium text-red-600">
                                            {b.failures} fail
                                        </span>
                                    ) : null}
                                    <span>{b.count}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/* ── Main component ─────────────────────────────────────────────────── */

export interface AuditLogTableProps {
    summary: AuditSummary;
}

export function AuditLogTable({ summary }: AuditLogTableProps) {
    const [actorFilter, setActorFilter] = React.useState<string | null>(null);
    const [actionFilter, setActionFilter] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [from, setFrom] = React.useState('');
    const [to, setTo] = React.useState('');

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        const fromTs = from ? new Date(from).getTime() : -Infinity;
        const toTs = to ? new Date(to).getTime() : Infinity;
        return summary.recent.filter((evt) => {
            if (actorFilter && evt.actor !== actorFilter) return false;
            if (actionFilter && evt.action !== actionFilter) return false;
            if (q) {
                const hay = `${evt.actor} ${evt.action} ${evt.resource}`
                    .toLowerCase();
                if (!hay.includes(q)) return false;
            }
            const ts = new Date(evt.ts).getTime();
            if (Number.isFinite(ts)) {
                if (ts < fromTs || ts > toTs) return false;
            }
            return true;
        });
    }, [summary.recent, actorFilter, actionFilter, search, from, to]);

    const clearFilters = () => {
        setActorFilter(null);
        setActionFilter(null);
        setSearch('');
        setFrom('');
        setTo('');
    };

    const hasActiveFilter =
        actorFilter !== null
        || actionFilter !== null
        || search !== ''
        || from !== ''
        || to !== '';

    return (
        <div className="space-y-6">
            {/* KPI strip */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Total events
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">
                        {summary.total.toLocaleString()}
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Failures
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-2xl font-bold text-slate-900">
                            {summary.failures.toLocaleString()}
                        </span>
                        {summary.failures > 0 ? (
                            <ShieldAlert className="h-5 w-5 text-red-500" />
                        ) : (
                            <ShieldCheck className="h-5 w-5 text-emerald-500" />
                        )}
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Window
                    </div>
                    <div className="mt-2 text-sm text-slate-700">
                        {formatTimestamp(summary.range.from)}
                        <span className="mx-2 text-slate-400">→</span>
                        {formatTimestamp(summary.range.to)}
                    </div>
                </div>
            </div>

            {/* Bucket cards */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <BucketCard
                    title="Top actors"
                    items={summary.actionsByActor}
                    onSelect={(k) =>
                        setActorFilter((cur) => (cur === k ? null : k))
                    }
                    selectedKey={actorFilter}
                />
                <BucketCard
                    title="Top actions"
                    items={summary.actionsByAction}
                    onSelect={(k) =>
                        setActionFilter((cur) => (cur === k ? null : k))
                    }
                    selectedKey={actionFilter}
                />
                <BucketCard
                    title="Top resources"
                    items={summary.actionsByResource}
                />
            </div>

            {/* Filter row */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px] flex-1">
                        <label className="text-xs font-medium text-slate-500">
                            Search
                        </label>
                        <div className="relative mt-1">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="actor, action, resource…"
                                className="pl-8"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500">
                            From
                        </label>
                        <Input
                            type="datetime-local"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500">
                            To
                        </label>
                        <Input
                            type="datetime-local"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    {hasActiveFilter ? (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Clear filters
                        </button>
                    ) : null}
                </div>
                {(actorFilter || actionFilter) && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {actorFilter && (
                            <Badge variant="secondary">
                                Actor: {actorFilter}
                            </Badge>
                        )}
                        {actionFilter && (
                            <Badge variant="secondary">
                                Action: {actionFilter}
                            </Badge>
                        )}
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                    <h2 className="text-sm font-semibold text-slate-900">
                        Recent events
                    </h2>
                    <p className="text-xs text-slate-500">
                        Showing {filtered.length} of {summary.recent.length} most-recent rows.
                    </p>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[180px]">Timestamp</TableHead>
                            <TableHead>Actor</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Resource</TableHead>
                            <TableHead className="w-[100px]">Outcome</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={5}
                                    className="py-12 text-center text-sm text-slate-400"
                                >
                                    No events match the current filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((evt) => (
                                <TableRow key={evt.id}>
                                    <TableCell className="font-mono text-xs text-slate-600">
                                        {formatTimestamp(evt.ts)}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-900">
                                        {evt.actor}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-slate-700">
                                        {evt.action}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-slate-600">
                                        {evt.resource}
                                    </TableCell>
                                    <TableCell>
                                        {isFailure(evt) ? (
                                            <Badge variant="destructive">
                                                error
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">
                                                ok
                                            </Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

export default AuditLogTable;
