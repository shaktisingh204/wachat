'use client';

import { Badge, Input, Table, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import {
  Search,
  ShieldAlert,
  ShieldCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
        <div className="rounded-2xl border border-[var(--st-border)] bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--st-text)]">
                {title}
            </h3>
            {top.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--st-text-secondary)]">
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
                                    'hover:bg-[var(--st-bg-muted)]',
                                    selectedKey === b.key && 'bg-[var(--st-bg-muted)] font-medium',
                                )}
                            >
                                <span className="truncate text-[var(--st-text)]">{b.key}</span>
                                <span className="ml-2 flex shrink-0 items-center gap-2 text-xs text-[var(--st-text)]">
                                    {b.failures > 0 ? (
                                        <span className="rounded-full bg-[var(--st-bg-muted)] px-1.5 py-0.5 font-medium text-[var(--st-text)]">
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

    const allActions = React.useMemo(() => {
        const set = new Set([
            ...summary.actionsByAction.map(b => b.key),
            ...summary.recent.map(e => e.action)
        ]);
        return Array.from(set).sort();
    }, [summary]);

    const exportCSV = () => {
        const rows = filtered.map(e => [
            formatTimestamp(e.ts),
            e.actor,
            e.action,
            e.resource,
            isFailure(e) ? 'error' : 'ok'
        ]);
        const csvContent = [
            ['Timestamp', 'Actor', 'Action', 'Resource', 'Outcome'],
            ...rows
        ].map(e => e.map(f => `"${String(f).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `audit_log_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.text("Audit Log", 14, 15);
        autoTable(doc, {
            head: [['Timestamp', 'Actor', 'Action', 'Resource', 'Outcome']],
            body: filtered.map(e => [
                formatTimestamp(e.ts),
                e.actor,
                e.action,
                e.resource,
                isFailure(e) ? 'error' : 'ok'
            ]),
            startY: 20
        });
        doc.save(`audit_log_${Date.now()}.pdf`);
    };

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
                <div className="rounded-2xl border border-[var(--st-border)] bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--st-text)]">
                        Total events
                    </div>
                    <div className="mt-2 text-2xl font-bold text-[var(--st-text)]">
                        {summary.total.toLocaleString()}
                    </div>
                </div>
                <div className="rounded-2xl border border-[var(--st-border)] bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--st-text)]">
                        Failures
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-2xl font-bold text-[var(--st-text)]">
                            {summary.failures.toLocaleString()}
                        </span>
                        {summary.failures > 0 ? (
                            <ShieldAlert className="h-5 w-5 text-[var(--st-text)]" />
                        ) : (
                            <ShieldCheck className="h-5 w-5 text-[var(--st-text)]" />
                        )}
                    </div>
                </div>
                <div className="rounded-2xl border border-[var(--st-border)] bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--st-text)]">
                        Window
                    </div>
                    <div className="mt-2 text-sm text-[var(--st-text)]">
                        {formatTimestamp(summary.range.from)}
                        <span className="mx-2 text-[var(--st-text-secondary)]">→</span>
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
            <div className="rounded-2xl border border-[var(--st-border)] bg-white p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px] flex-1">
                        <label className="text-xs font-medium text-[var(--st-text)]">
                            Search
                        </label>
                        <div className="relative mt-1">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="actor, action, resource…"
                                className="pl-8"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[var(--st-text)]">
                            Action
                        </label>
                        <Select
                            value={actionFilter || 'all'}
                            onValueChange={(val) => setActionFilter(val === 'all' ? null : val)}
                        >
                            <SelectTrigger className="mt-1 w-[160px]">
                                <SelectValue placeholder="All actions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All actions</SelectItem>
                                {allActions.map(action => (
                                    <SelectItem key={action} value={action}>
                                        {action}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[var(--st-text)]">
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
                        <label className="text-xs font-medium text-[var(--st-text)]">
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
                            className="rounded-md border border-[var(--st-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
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
            <div className="rounded-2xl border border-[var(--st-border)] bg-white">
                <div className="border-b border-[var(--st-border)] px-4 py-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-[var(--st-text)]">
                            Recent events
                        </h2>
                        <p className="text-xs text-[var(--st-text)]">
                            Showing {filtered.length} of {summary.recent.length} most-recent rows.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={exportCSV}>
                            Export CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportPDF}>
                            Export PDF
                        </Button>
                    </div>
                </div>
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead className="w-[180px]">Timestamp</ZoruTableHead>
                            <ZoruTableHead>Actor</ZoruTableHead>
                            <ZoruTableHead>Action</ZoruTableHead>
                            <ZoruTableHead>Resource</ZoruTableHead>
                            <ZoruTableHead className="w-[100px]">Outcome</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {filtered.length === 0 ? (
                            <ZoruTableRow>
                                <ZoruTableCell
                                    colSpan={5}
                                    className="py-12 text-center text-sm text-[var(--st-text-secondary)]"
                                >
                                    No events match the current filters.
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            filtered.map((evt) => (
                                <ZoruTableRow key={evt.id}>
                                    <ZoruTableCell className="font-mono text-xs text-[var(--st-text)]">
                                        {formatTimestamp(evt.ts)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-sm text-[var(--st-text)]">
                                        {evt.actor}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-xs text-[var(--st-text)]">
                                        {evt.action}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-xs text-[var(--st-text)]">
                                        {evt.resource}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {isFailure(evt) ? (
                                            <Badge variant="destructive">
                                                error
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">
                                                ok
                                            </Badge>
                                        )}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))
                        )}
                    </ZoruTableBody>
                </Table>
            </div>
        </div>
    );
}

export default AuditLogTable;
