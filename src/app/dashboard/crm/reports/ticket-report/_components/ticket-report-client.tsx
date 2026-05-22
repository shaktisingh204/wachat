'use client';

/**
 * Ticket Report — client wrapper.
 *
 * Renders the chart (recharts), the data table with `EntityRowLink`s,
 * pagination, bulk-row selection with export selected, and full
 * CSV/XLSX export controls.
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
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Download, FileSpreadsheet } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    DropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuTrigger,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui';
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
    'hsl(var(--primary))',
    'hsl(var(--chart-2, 142 71% 45%))',
    'hsl(var(--chart-3, 38 92% 50%))',
    'hsl(var(--chart-4, 0 84% 60%))',
    'hsl(var(--chart-5, 217 91% 60%))',
    'hsl(var(--muted-foreground))',
];

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'danger'> = {
    resolved: 'success',
    closed: 'success',
    open: 'warning',
    pending: 'secondary',
    on_hold: 'secondary',
};

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'secondary'> = {
    urgent: 'danger',
    high: 'danger',
    medium: 'warning',
    low: 'secondary',
};

export interface TicketReportClientProps {
    metrics: TicketMetrics;
    rows: TicketReportRow[];
    total: number;
    page: number;
    limit: number;
}

function rowToExport(r: TicketReportRow): ExportRow {
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
        <>
            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <div className="mb-3">
                        <h2 className="text-[16px] font-semibold text-foreground">
                            Tickets opened vs closed
                        </h2>
                        <p className="text-[12.5px] text-muted-foreground">
                            Daily volume across the selected range.
                        </p>
                    </div>
                    <div className="h-[280px] w-full">
                        {metrics.byDay.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
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
                                        stroke="hsl(var(--border))"
                                    />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="opened"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        dot={false}
                                        name="Opened"
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="closed"
                                        stroke="hsl(142 71% 45%)"
                                        strokeWidth={2}
                                        dot={false}
                                        name="Closed"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                <Card>
                    <div className="mb-3">
                        <h2 className="text-[16px] font-semibold text-foreground">
                            By priority
                        </h2>
                    </div>
                    <div className="h-[280px] w-full">
                        {priorityData.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
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
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>

            <Card>
                <div className="mb-3">
                    <h2 className="text-[16px] font-semibold text-foreground">
                        By category
                    </h2>
                </div>
                <div className="h-[260px] w-full">
                    {categoryData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
                            No category data.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryData}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="hsl(var(--border))"
                                />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar
                                    dataKey="value"
                                    fill="hsl(var(--primary))"
                                    name="Tickets"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </Card>

            {/* Table toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] text-muted-foreground">
                    {selected.size > 0
                        ? `${selected.size} of ${rows.length} selected`
                        : `${rows.length} row${rows.length === 1 ? '' : 's'} on this page`}
                </span>
                <div className="flex gap-2">
                    {/* Export selected */}
                    {selected.size > 0 && (
                        <DropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Download className="mr-1.5 h-3.5 w-3.5" />
                                    Export selected ({selected.size})
                                </Button>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent align="end">
                                <ZoruDropdownMenuItem onClick={() => handleExportSelected('csv')}>
                                    <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
                                </ZoruDropdownMenuItem>
                                <ZoruDropdownMenuItem onClick={() => handleExportSelected('xlsx')}>
                                    <FileSpreadsheet className="mr-2 h-4 w-4" /> XLSX
                                </ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Export all (current page) */}
                    <DropdownMenu>
                        <ZoruDropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Export all
                            </Button>
                        </ZoruDropdownMenuTrigger>
                        <ZoruDropdownMenuContent align="end">
                            <ZoruDropdownMenuItem onClick={() => handleExportAll('csv')}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem onClick={() => handleExportAll('xlsx')}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> XLSX
                            </ZoruDropdownMenuItem>
                        </ZoruDropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Table */}
            <Card>
                <div className="mb-3">
                    <h2 className="text-[16px] font-semibold text-foreground">
                        Tickets
                    </h2>
                    <p className="text-[12.5px] text-muted-foreground">
                        Select rows to export a subset. Click a subject to open the ticket.
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="w-10">
                                    <input
                                        type="checkbox"
                                        aria-label="Select all"
                                        checked={
                                            rows.length > 0 &&
                                            selected.size === rows.length
                                        }
                                        onChange={toggleAll}
                                        className="h-4 w-4 rounded border-border"
                                    />
                                </ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">
                                    Subject
                                </ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">
                                    Status
                                </ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">
                                    Priority
                                </ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">
                                    Channel
                                </ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">
                                    Agent
                                </ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">
                                    Resolution
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {rows.length === 0 ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell
                                        colSpan={7}
                                        className="h-24 text-center text-[13px] text-muted-foreground"
                                    >
                                        No tickets in range.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                rows.map((r) => (
                                    <ZoruTableRow
                                        key={r.id}
                                        className="border-border"
                                    >
                                        <ZoruTableCell>
                                            <input
                                                type="checkbox"
                                                aria-label={`Select ${r.subject}`}
                                                checked={selected.has(r.id)}
                                                onChange={() => toggleRow(r.id)}
                                                className="h-4 w-4 rounded border-border"
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">
                                            <EntityRowLink
                                                href={`/dashboard/crm/tickets/${r.id}`}
                                                label={r.subject}
                                                subtitle={r.category}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge
                                                variant={STATUS_VARIANT[r.status] ?? 'secondary'}
                                            >
                                                {r.status}
                                            </Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge
                                                variant={PRIORITY_VARIANT[r.priority] ?? 'secondary'}
                                            >
                                                {r.priority}
                                            </Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">
                                            {r.channel}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">
                                            {r.agent}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-foreground">
                                            {r.resolutionMinutes != null
                                                ? fmtMinutes(r.resolutionMinutes)
                                                : '—'}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>
                <PaginationBar
                    page={page}
                    limit={limit}
                    total={total}
                    hasMore={hasMore}
                />
            </Card>
        </>
    );
}
