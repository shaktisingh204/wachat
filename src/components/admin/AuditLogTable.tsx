'use client';

import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  Inbox,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Admin-side viewer for the compliance audit log.
 *
 * Consumes a pre-aggregated {@link AuditSummary} produced by
 * `auditSummaryFor` on the server and offers client-side filtering by
 * actor, action and a free-form date range. The component is
 * intentionally read-only. Destructive operations belong on the
 * legal-hold / DSR pages, which already have their own confirmation
 * flows.
 */
import * as React from 'react';

import type {
    AuditBucket,
    AuditSummary,
} from '@/lib/compliance/dashboards';
import type { AuditEvent } from '@/lib/compliance/types';

/* -- Helpers --------------------------------------------------------- */

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

/* -- Subcomponents --------------------------------------------------- */

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
        <Card variant="outlined" padding="md">
            <CardHeader>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                    {title}
                </CardTitle>
            </CardHeader>
            {top.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--st-text-secondary)]">
                    {emptyLabel ?? 'No data in range.'}
                </p>
            ) : (
                <ul className="mt-3 space-y-1.5">
                    {top.map((b) => (
                        <li key={b.key}>
                            <Button
                                variant={selectedKey === b.key ? 'secondary' : 'ghost'}
                                size="sm"
                                block
                                onClick={() => onSelect?.(b.key)}
                                className="justify-between"
                            >
                                <span className="truncate text-[var(--st-text)]">{b.key}</span>
                                <span className="ml-2 flex shrink-0 items-center gap-2 text-xs text-[var(--st-text)]">
                                    {b.failures > 0 ? (
                                        <Badge tone="danger" kind="soft">
                                            {b.failures} fail
                                        </Badge>
                                    ) : null}
                                    <span>{b.count}</span>
                                </span>
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

/* -- Main component -------------------------------------------------- */

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
                <StatCard
                    label="Total events"
                    value={summary.total.toLocaleString()}
                />
                <StatCard
                    label="Failures"
                    value={summary.failures.toLocaleString()}
                    icon={summary.failures > 0 ? ShieldAlert : ShieldCheck}
                />
                <StatCard
                    label="Window"
                    value={
                        <span className="text-sm font-normal">
                            {formatTimestamp(summary.range.from)}
                            <span className="mx-2 text-[var(--st-text-secondary)]">to</span>
                            {formatTimestamp(summary.range.to)}
                        </span>
                    }
                />
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
            <Card variant="outlined" padding="md">
                <div className="flex flex-wrap items-end gap-3">
                    <Field label="Search" className="min-w-[220px] flex-1">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="actor, action, resource"
                            iconLeft={Search}
                        />
                    </Field>
                    <Field label="Action">
                        <Select
                            value={actionFilter || 'all'}
                            onValueChange={(val) => setActionFilter(val === 'all' ? null : val)}
                        >
                            <SelectTrigger className="w-[160px]" aria-label="Filter by action">
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
                    </Field>
                    <Field label="From">
                        <Input
                            type="datetime-local"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                    </Field>
                    <Field label="To">
                        <Input
                            type="datetime-local"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </Field>
                    {hasActiveFilter ? (
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    ) : null}
                </div>
                {(actorFilter || actionFilter) && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {actorFilter && (
                            <Badge tone="neutral" kind="soft">
                                Actor: {actorFilter}
                            </Badge>
                        )}
                        {actionFilter && (
                            <Badge tone="neutral" kind="soft">
                                Action: {actionFilter}
                            </Badge>
                        )}
                    </div>
                )}
            </Card>

            {/* Table */}
            <Card variant="outlined" padding="none">
                <CardHeader className="flex items-center justify-between px-4 py-3">
                    <div>
                        <CardTitle className="text-sm font-semibold">
                            Recent events
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Showing {filtered.length} of {summary.recent.length} most-recent rows.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={exportCSV}>
                            Export CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportPDF}>
                            Export PDF
                        </Button>
                    </div>
                </CardHeader>
                <Table>
                    <THead>
                        <Tr>
                            <Th width={180}>Timestamp</Th>
                            <Th>Actor</Th>
                            <Th>Action</Th>
                            <Th>Resource</Th>
                            <Th width={100}>Outcome</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {filtered.length === 0 ? (
                            <Tr>
                                <Td colSpan={5}>
                                    <EmptyState
                                        icon={Inbox}
                                        title="No matching events"
                                        description="No events match the current filters."
                                        size="sm"
                                    />
                                </Td>
                            </Tr>
                        ) : (
                            filtered.map((evt) => (
                                <Tr key={evt.id}>
                                    <Td className="font-mono text-xs text-[var(--st-text)]">
                                        {formatTimestamp(evt.ts)}
                                    </Td>
                                    <Td className="text-sm text-[var(--st-text)]">
                                        {evt.actor}
                                    </Td>
                                    <Td className="font-mono text-xs text-[var(--st-text)]">
                                        {evt.action}
                                    </Td>
                                    <Td className="font-mono text-xs text-[var(--st-text)]">
                                        {evt.resource}
                                    </Td>
                                    <Td>
                                        {isFailure(evt) ? (
                                            <Badge tone="danger" kind="soft">
                                                error
                                            </Badge>
                                        ) : (
                                            <Badge tone="success" kind="soft">
                                                ok
                                            </Badge>
                                        )}
                                    </Td>
                                </Tr>
                            ))
                        )}
                    </TBody>
                </Table>
            </Card>
        </div>
    );
}

export default AuditLogTable;
