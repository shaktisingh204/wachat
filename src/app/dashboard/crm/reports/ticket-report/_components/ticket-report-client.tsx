'use client';

/**
 * Ticket Report — client wrapper.
 *
 * Renders the chart (recharts), the data table with `EntityRowLink`s,
 * pagination, and the CSV/XLSX exporters. The parent server page hands
 * the pre-computed metrics + first page of rows; subsequent page-flips
 * fetch via `listTicketReportRows`.
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
    ZoruButton,
    ZoruCard,
    ZoruDropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuTrigger,
    ZoruTable,
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

export interface TicketReportClientProps {
    metrics: TicketMetrics;
    rows: TicketReportRow[];
    total: number;
    page: number;
    limit: number;
}

export function TicketReportClient({
    metrics,
    rows,
    total,
    page,
    limit,
}: TicketReportClientProps) {
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

    const exportRows: ExportRow[] = React.useMemo(
        () =>
            rows.map((r) => ({
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
            })),
        [rows],
    );

    const exportHeaders = [
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

    const handleCsv = (): void => {
        downloadCsv(
            `ticket-report-${dateStamp()}.csv`,
            exportHeaders,
            exportRows,
        );
    };

    const handleXlsx = (): void => {
        void downloadXlsx(
            `ticket-report-${dateStamp()}.xlsx`,
            exportHeaders,
            exportRows,
            'Tickets',
        );
    };

    const hasMore = page * limit < total;

    return (
        <>
            <div className="flex justify-end">
                <ZoruDropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                        <ZoruButton variant="outline" size="sm">
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
                        </ZoruButton>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem onClick={handleCsv}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem onClick={handleXlsx}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> XLSX
                        </ZoruDropdownMenuItem>
                    </ZoruDropdownMenuContent>
                </ZoruDropdownMenu>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <ZoruCard className="lg:col-span-2">
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
                                    margin={{
                                        top: 8,
                                        right: 12,
                                        bottom: 8,
                                        left: 0,
                                    }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="hsl(var(--border))"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11 }}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tick={{ fontSize: 11 }}
                                    />
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
                </ZoruCard>

                <ZoruCard>
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
                </ZoruCard>
            </div>

            <ZoruCard>
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
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 11 }}
                                />
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
            </ZoruCard>

            <ZoruCard>
                <div className="mb-3">
                    <h2 className="text-[16px] font-semibold text-foreground">
                        Tickets
                    </h2>
                    <p className="text-[12.5px] text-muted-foreground">
                        Click a row to open the ticket.
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
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
                                        colSpan={6}
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
                                        <ZoruTableCell className="text-[13px] text-foreground">
                                            <EntityRowLink
                                                href={`/dashboard/crm/tickets/${r.id}`}
                                                label={r.subject}
                                                subtitle={r.category}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">
                                            {r.status}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">
                                            {r.priority}
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
                    </ZoruTable>
                </div>
                <PaginationBar
                    page={page}
                    limit={limit}
                    total={total}
                    hasMore={hasMore}
                />
            </ZoruCard>
        </>
    );
}
