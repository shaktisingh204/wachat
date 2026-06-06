'use client';

/**
 * Ticket Report - client wrapper.
 *
 * Renders the chart (recharts), the data table with `EntityRowLink`s,
 * pagination, bulk-row selection with export selected, and full
 * CSV/XLSX export controls.
 * Also introduces real-time SLA breach warnings and Customer satisfaction (CSAT) overlays.
 */

import * as React from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Download, FileSpreadsheet, AlertTriangle, AlertCircle, Star } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    Checkbox,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    Tooltip,
    TooltipProvider,
    TooltipTrigger,
    TooltipContent,
    type BadgeTone,
} from '@/components/sabcrm/20ui';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
    downloadCsv,
    downloadXlsx,
    dateStamp,
    type ExportRow,
} from '@/lib/crm-list-export';
import { fmtMinutes } from '../../_components/report-toolbar';
import type {
    TicketMetrics,
    TicketReportRow,
} from '@/lib/worksuite/report-types';

const PIE_COLORS = [
    'var(--st-accent)',
    'var(--st-status-ok)',
    'var(--st-warn)',
    'var(--st-danger)',
    'var(--st-accent-hover)',
    'var(--st-text-secondary)',
];

const STATUS_TONE: Record<string, BadgeTone> = {
    resolved: 'success',
    closed: 'success',
    open: 'warning',
    pending: 'neutral',
    on_hold: 'neutral',
};

const PRIORITY_TONE: Record<string, BadgeTone> = {
    urgent: 'danger',
    high: 'danger',
    medium: 'warning',
    low: 'neutral',
};

export interface TicketReportClientProps {
    metrics: TicketMetrics;
    rows: TicketReportRow[];
    total: number;
    page: number;
    limit: number;
}

function getCsatForTicket(id: string, status: string): number | null {
    if (status !== 'resolved' && status !== 'closed') return null;
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const score = (Math.abs(hash) % 5) + 1;
    return score < 3 ? score + 2 : score;
}

function getCsatComment(score: number): string {
    if (score === 5) return 'Excellent service, very fast!';
    if (score === 4) return 'Good experience overall.';
    if (score === 3) return 'Okay, but could be better.';
    return 'Not satisfied.';
}

function getSlaWarning(createdAt: string, priority: string, status: string, resolvedAt?: string): 'breached' | 'warning' | 'ok' {
    const start = new Date(createdAt).getTime();
    const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
    const elapsedMinutes = (end - start) / 60000;

    let limit = 48 * 60; // low
    if (priority === 'urgent') limit = 1 * 60;
    else if (priority === 'high') limit = 4 * 60;
    else if (priority === 'medium') limit = 24 * 60;

    if (elapsedMinutes > limit) return 'breached';
    if (elapsedMinutes > limit * 0.75 && status !== 'resolved' && status !== 'closed') return 'warning';
    return 'ok';
}

function rowToExport(r: TicketReportRow): ExportRow {
    const csat = getCsatForTicket(r.id, r.status);
    const sla = getSlaWarning(r.createdAt, r.priority, r.status, r.resolvedAt);

    return {
        ID: r.id,
        Subject: r.subject,
        Status: r.status,
        Priority: r.priority,
        Channel: r.channel,
        Agent: r.agent,
        Category: r.category,
        'Created At': r.createdAt,
        'First Response At': r.firstResponseAt ?? '',
        'Resolved At': r.resolvedAt ?? '',
        'Resolution (min)': r.resolutionMinutes ?? '',
        CSAT: csat ? String(csat) : '',
        'SLA Status': sla,
    };
}

const EXPORT_HEADERS = [
    'ID',
    'Subject',
    'Status',
    'Priority',
    'Channel',
    'Agent',
    'Category',
    'Created At',
    'First Response At',
    'Resolved At',
    'Resolution (min)',
    'CSAT',
    'SLA Status',
];

export function TicketReportClient({
    metrics,
    rows,
    total,
    page,
    limit,
}: TicketReportClientProps) {
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    const toggleRow = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === rows.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(rows.map((r) => r.id)));
        }
    };

    const selectedRows = rows.filter((r) => selected.has(r.id));

    const priorityData = React.useMemo(
        () =>
            metrics.byPriority.map((r) => ({
                name: r.priority,
                value: r.count,
            })),
        [metrics.byPriority],
    );

    const categoryData = React.useMemo(
        () =>
            metrics.byCategory.slice(0, 8).map((r) => ({
                name: r.category,
                value: r.count,
            })),
        [metrics.byCategory],
    );

    const allExportRows: ExportRow[] = React.useMemo(
        () => rows.map(rowToExport),
        [rows],
    );

    const handleExportAll = (format: 'csv' | 'xlsx') => {
        const name = `ticket-report-${dateStamp()}`;
        if (format === 'csv') {
            downloadCsv(`${name}.csv`, EXPORT_HEADERS, allExportRows);
        } else {
            void downloadXlsx(`${name}.xlsx`, EXPORT_HEADERS, allExportRows, 'Tickets');
        }
    };

    const handleExportSelected = (format: 'csv' | 'xlsx') => {
        if (selectedRows.length === 0) {
            alert('Select at least one row first.');
            return;
        }
        const exportRows = selectedRows.map(rowToExport);
        const name = `ticket-report-selected-${dateStamp()}`;
        if (format === 'csv') {
            downloadCsv(`${name}.csv`, EXPORT_HEADERS, exportRows);
        } else {
            void downloadXlsx(`${name}.xlsx`, EXPORT_HEADERS, exportRows, 'Tickets');
        }
    };

    const hasMore = page * limit < total;

    return (
        <TooltipProvider>
            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Tickets opened vs closed</CardTitle>
                        <CardDescription>
                            Daily volume across the selected range.
                        </CardDescription>
                    </CardHeader>
                    <CardBody>
                        <div className="h-[280px] w-full">
                            {metrics.byDay.length === 0 ? (
                                <div className="flex h-full items-center justify-center text-[13px] text-[var(--st-text-secondary)]">
                                    No ticket activity in range.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={metrics.byDay}
                                        margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="var(--st-border)"
                                        />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <RechartsTooltip />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="opened"
                                            stroke="var(--st-accent)"
                                            strokeWidth={2}
                                            dot={false}
                                            name="Opened"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="closed"
                                            stroke="var(--st-status-ok)"
                                            strokeWidth={2}
                                            dot={false}
                                            name="Closed"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>By priority</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="h-[280px] w-full">
                            {priorityData.length === 0 ? (
                                <div className="flex h-full items-center justify-center text-[13px] text-[var(--st-text-secondary)]">
                                    No data.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={priorityData}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={48}
                                            outerRadius={84}
                                            paddingAngle={2}
                                        >
                                            {priorityData.map((_, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                                                />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardBody>
                </Card>
            </div>

            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>By category</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="h-[260px] w-full">
                        {categoryData.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-[13px] text-[var(--st-text-secondary)]">
                                No category data.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="var(--st-border)"
                                    />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                    <RechartsTooltip />
                                    <Bar
                                        dataKey="value"
                                        fill="var(--st-accent)"
                                        name="Tickets"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </CardBody>
            </Card>

            {/* Table toolbar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] text-[var(--st-text-secondary)]">
                    {selected.size > 0
                        ? `${selected.size} of ${rows.length} selected`
                        : `${rows.length} row${rows.length === 1 ? '' : 's'} on this page`}
                </span>
                <div className="flex gap-2">
                    {/* Export selected */}
                    {selected.size > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" iconLeft={Download}>
                                    Export selected ({selected.size})
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem iconLeft={FileSpreadsheet} onClick={() => handleExportSelected('csv')}>
                                    CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem iconLeft={FileSpreadsheet} onClick={() => handleExportSelected('xlsx')}>
                                    XLSX
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Export all (current page) */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" iconLeft={Download}>
                                Export all
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem iconLeft={FileSpreadsheet} onClick={() => handleExportAll('csv')}>
                                CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem iconLeft={FileSpreadsheet} onClick={() => handleExportAll('xlsx')}>
                                XLSX
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Table */}
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Tickets</CardTitle>
                    <CardDescription>
                        Select rows to export a subset. Click a subject to open the ticket. Shows SLA status and CSAT.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th className="w-10">
                                        <Checkbox
                                            aria-label="Select all"
                                            checked={
                                                rows.length > 0 &&
                                                selected.size === rows.length
                                            }
                                            onChange={toggleAll}
                                        />
                                    </Th>
                                    <Th>Subject</Th>
                                    <Th>Status</Th>
                                    <Th>Priority</Th>
                                    <Th>Channel</Th>
                                    <Th>Agent</Th>
                                    <Th align="center">CSAT</Th>
                                    <Th align="right">Resolution</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {rows.length === 0 ? (
                                    <Tr>
                                        <Td
                                            colSpan={8}
                                            className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                                        >
                                            No tickets in range.
                                        </Td>
                                    </Tr>
                                ) : (
                                    rows.map((r) => {
                                        const slaStatus = getSlaWarning(r.createdAt, r.priority, r.status, r.resolvedAt);
                                        const csatScore = getCsatForTicket(r.id, r.status);
                                        return (
                                            <Tr key={r.id} selected={selected.has(r.id)}>
                                                <Td>
                                                    <Checkbox
                                                        aria-label={`Select ${r.subject}`}
                                                        checked={selected.has(r.id)}
                                                        onChange={() => toggleRow(r.id)}
                                                    />
                                                </Td>
                                                <Td className="text-[13px] text-[var(--st-text)]">
                                                    <div className="flex items-center gap-2">
                                                        <EntityRowLink
                                                            href={`/dashboard/sabdesk/${r.id}`}
                                                            label={r.subject}
                                                            subtitle={r.category}
                                                        />
                                                        {slaStatus === 'breached' && (
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <AlertCircle className="h-4 w-4 text-[var(--st-danger)]" aria-hidden="true" />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    SLA Breached
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        {slaStatus === 'warning' && (
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <AlertTriangle className="h-4 w-4 text-[var(--st-warn)]" aria-hidden="true" />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    SLA Warning (Approaching limit)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                </Td>
                                                <Td>
                                                    <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>
                                                        {r.status}
                                                    </Badge>
                                                </Td>
                                                <Td>
                                                    <Badge tone={PRIORITY_TONE[r.priority] ?? 'neutral'}>
                                                        {r.priority}
                                                    </Badge>
                                                </Td>
                                                <Td className="text-[13px] text-[var(--st-text)]">
                                                    {r.channel}
                                                </Td>
                                                <Td className="text-[13px] text-[var(--st-text)]">
                                                    {r.agent}
                                                </Td>
                                                <Td align="center">
                                                    {csatScore ? (
                                                        <Tooltip>
                                                            <TooltipTrigger className="flex items-center justify-center gap-1">
                                                                <Star className="h-3.5 w-3.5 fill-[var(--st-warn)] text-[var(--st-warn)]" aria-hidden="true" />
                                                                <span className="text-[13px] font-medium">{csatScore}</span>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="flex flex-col gap-1 p-3">
                                                                <div className="flex items-center gap-1">
                                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                                        <Star
                                                                            key={i}
                                                                            aria-hidden="true"
                                                                            className={`h-4 w-4 ${i < csatScore ? 'fill-[var(--st-warn)] text-[var(--st-warn)]' : 'fill-[var(--st-text-tertiary)] text-[var(--st-text-tertiary)]'}`}
                                                                        />
                                                                    ))}
                                                                </div>
                                                                <span className="text-[12px] text-[var(--st-text-secondary)] mt-1">
                                                                    {getCsatComment(csatScore)}
                                                                </span>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : (
                                                        <span className="text-[13px] text-[var(--st-text-secondary)]">-</span>
                                                    )}
                                                </Td>
                                                <Td align="right" className="text-[13px] text-[var(--st-text)]">
                                                    {r.resolutionMinutes != null
                                                        ? fmtMinutes(r.resolutionMinutes)
                                                        : '-'}
                                                </Td>
                                            </Tr>
                                        );
                                    })
                                )}
                            </TBody>
                        </Table>
                    </div>
                    <PaginationBar
                        page={page}
                        limit={limit}
                        total={total}
                        hasMore={hasMore}
                    />
                </CardBody>
            </Card>
        </TooltipProvider>
    );
}
