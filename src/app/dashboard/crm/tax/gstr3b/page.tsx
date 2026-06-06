'use client';

/**
 * GSTR-3B page — deep template per the rebuild plan: KPI strip (FY
 * filings / pending / last filing / total tax), filter row, bulk
 * download bar, CSV/XLSX export, pagination, EntityRowLink on the
 * primary cell. All actions are multi-tenant via `getSession()` server-
 * side. Period picker + Generate still live at the top so users can
 * materialise the current month's return.
 */

import * as React from 'react';
import {
    Badge,
    Button,
    Card,
    Checkbox,
    Input,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
    Download,
    LoaderCircle,
    Receipt,
    CalendarClock,
    AlertTriangle,
    Wallet,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
    generateGstr3bReport,
    getGstr3bKpis,
    listGstr3bFilings,
    type Gstr3bFilingRow,
    type Gstr3bKpis,
    type Period,
} from '@/app/actions/crm-india-gst.actions';
import type { ReportRunResult } from '@/lib/reports/types';

const PAGE_SIZE = 20;

const MONTHS = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

const STATUS_OPTIONS: Array<{ value: 'all' | 'succeeded' | 'failed'; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'succeeded', label: 'Succeeded' },
    { value: 'failed', label: 'Failed' },
];

const FY_OPTIONS: Array<{ value: 'current' | 'previous' | 'all'; label: string }> = [
    { value: 'current', label: 'Current FY' },
    { value: 'previous', label: 'Previous FY' },
    { value: 'all', label: 'All time' },
];

const EMPTY_KPIS: Gstr3bKpis = {
    totalFiledFy: 0,
    pendingFy: 0,
    totalTaxFy: 0,
    netPayableFy: 0,
};

function currentPeriod(): Period {
    const d = new Date();
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

function fmtInr(n: unknown): string {
    const num = Number(n);
    if (!Number.isFinite(num)) return '-';
    return `INR ${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | Date | undefined | null): string {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    if (!Number.isFinite(date.getTime())) return '—';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day} ${month} ${year}`;
}

function formatDateTime(d: string | Date | undefined | null): string {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    if (!Number.isFinite(date.getTime())) return '—';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${minutes} UTC`;
}

function monthLabel(month: number): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1] ?? '—';
}

function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function rowsToCsv(rows: Gstr3bFilingRow[]): string {
    const header = [
        'Period',
        'Month',
        'Year',
        'Status',
        'GeneratedAt',
        'FinishedAt',
        'OutwardTaxable',
        'NetPayable',
        'RowCount',
        'Error',
    ];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [
        header.join(','),
        ...rows.map((r) =>
            [
                escape(r.period),
                escape(r.month),
                escape(r.year),
                escape(r.status),
                escape(r.startedAt),
                escape(r.finishedAt ?? ''),
                escape(r.outwardTaxable ?? 0),
                escape(r.netPayable ?? 0),
                escape(r.rowCount ?? 0),
                escape(r.error ?? ''),
            ].join(','),
        ),
    ].join('\n');
}

function rowsToXlsx(rows: Gstr3bFilingRow[]): string {
    const header = [
        'Period',
        'Month',
        'Year',
        'Status',
        'GeneratedAt',
        'FinishedAt',
        'OutwardTaxable',
        'NetPayable',
        'RowCount',
        'Error',
    ];
    const xmlEscape = (v: unknown) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    const headerRow = `<Row>${header
        .map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
        .join('')}</Row>`;
    const bodyRows = rows
        .map(
            (r) =>
                `<Row>${[
                    r.period,
                    r.month,
                    r.year,
                    r.status,
                    r.startedAt,
                    r.finishedAt ?? '',
                    r.outwardTaxable ?? 0,
                    r.netPayable ?? 0,
                    r.rowCount ?? 0,
                    r.error ?? '',
                ]
                    .map((v) =>
                        typeof v === 'number'
                            ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>`
                            : `<Cell><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`,
                    )
                    .join('')}</Row>`,
        )
        .join('');
    return `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="GSTR-3B"><Table>${headerRow}${bodyRows}</Table></Worksheet></Workbook>`;
}

export default function Gstr3bPage() {
    const { toast } = useZoruToast();
    const [period, setPeriod] = React.useState<Period>(currentPeriod);
    const [loading, setLoading] = React.useState(false);
    const [result, setResult] = React.useState<ReportRunResult | null>(null);

    // List state
    const [rows, setRows] = React.useState<Gstr3bFilingRow[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [listLoading, setListLoading] = React.useState(true);
    const [kpis, setKpis] = React.useState<Gstr3bKpis>(EMPTY_KPIS);

    // Filters
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'all' | 'succeeded' | 'failed'>('all');
    const [fyFilter, setFyFilter] = React.useState<'current' | 'previous' | 'all'>('current');

    // Selection
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    const fetchKpis = React.useCallback(async () => {
        const k = await getGstr3bKpis();
        setKpis(k ?? EMPTY_KPIS);
    }, []);

    const fetchList = React.useCallback(async () => {
        setListLoading(true);
        try {
            const res = await listGstr3bFilings(page, PAGE_SIZE, search, {
                status: statusFilter,
                fy: fyFilter,
            });
            setRows(res.rows);
            setTotal(res.total);
        } finally {
            setListLoading(false);
        }
    }, [page, search, statusFilter, fyFilter]);

    React.useEffect(() => {
        fetchKpis();
    }, [fetchKpis]);

    React.useEffect(() => {
        fetchList();
    }, [fetchList]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const handleGenerate = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await generateGstr3bReport(period);
            if (res.error) {
                toast({
                    title: 'Could not generate GSTR-3B',
                    description: res.error,
                    variant: 'destructive',
                });
                setResult(null);
                return;
            }
            setResult(res.result ?? null);
            toast({ title: 'GSTR-3B generated' });
            fetchKpis();
            fetchList();
        } finally {
            setLoading(false);
        }
    }, [period, toast, fetchKpis, fetchList]);

    // ─── Selection ─────────────────────────────────────────────────────
    const toggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const allOnPageSelected =
        rows.length > 0 && rows.every((r) => selected.has(r.runId));
    const someOnPageSelected =
        rows.some((r) => selected.has(r.runId)) && !allOnPageSelected;

    const toggleAllOnPage = React.useCallback(() => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (allOnPageSelected) {
                for (const r of rows) next.delete(r.runId);
            } else {
                for (const r of rows) next.add(r.runId);
            }
            return next;
        });
    }, [allOnPageSelected, rows]);

    const clearSelection = React.useCallback(() => setSelected(new Set()), []);

    const selectedRows = React.useMemo(
        () => rows.filter((r) => selected.has(r.runId)),
        [rows, selected],
    );

    // ─── Export ─────────────────────────────────────────────────────────
    const exportCsv = React.useCallback(() => {
        const target = selectedRows.length > 0 ? selectedRows : rows;
        const blob = new Blob([rowsToCsv(target)], {
            type: 'text/csv;charset=utf-8;',
        });
        downloadBlob(`gstr3b-${new Date().toISOString().slice(0, 10)}.csv`, blob);
    }, [rows, selectedRows]);

    const exportXlsx = React.useCallback(() => {
        const target = selectedRows.length > 0 ? selectedRows : rows;
        const blob = new Blob([rowsToXlsx(target)], {
            type: 'application/vnd.ms-excel',
        });
        downloadBlob(`gstr3b-${new Date().toISOString().slice(0, 10)}.xls`, blob);
    }, [rows, selectedRows]);

    const bulkDownload = React.useCallback(() => {
        if (selectedRows.length === 0) return;
        // Bulk download = one consolidated CSV with all selected runs.
        const blob = new Blob([rowsToCsv(selectedRows)], {
            type: 'text/csv;charset=utf-8;',
        });
        downloadBlob(
            `gstr3b-bulk-${selectedRows.length}-${new Date()
                .toISOString()
                .slice(0, 10)}.csv`,
            blob,
        );
        toast({
            title: `${selectedRows.length} filing${selectedRows.length === 1 ? '' : 's'} downloaded`,
        });
    }, [selectedRows, toast]);

    const hasActiveFilters =
        !!search || statusFilter !== 'all' || fyFilter !== 'current';

    const clearFilters = React.useCallback(() => {
        setSearch('');
        setStatusFilter('all');
        setFyFilter('current');
        setPage(1);
    }, []);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const kpiStrip = (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
                label="Total filed (FY)"
                value={kpis.totalFiledFy}
                icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
            />
            <KpiCard
                label="Pending (FY)"
                value={kpis.pendingFy}
                icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                hint={kpis.pendingFy > 0 ? 'Months without a generation' : 'All months generated'}
            />
            <KpiCard
                label="Last filing"
                value={formatDate(kpis.lastFilingAt)}
                icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
            />
            <KpiCard
                label="Total tax (FY)"
                value={fmtInr(kpis.totalTaxFy)}
                icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                hint={`Net payable: ${fmtInr(kpis.netPayableFy)}`}
            />
        </div>
    );

    return (
        <EntityListShell
            title="GSTR-3B"
            subtitle="Monthly summary return — outward, ITC, RCM, tax payable."
            search={{
                value: search,
                onChange: (v) => handleSearch(v),
                placeholder: 'Search period (MM-YYYY)…',
            }}
            primaryAction={
                <Button variant="outline" onClick={exportCsv}>
                    <Download className="h-4 w-4" /> Export CSV
                </Button>
            }
            filters={
                <>
                    <Select
                        value={statusFilter}
                        onValueChange={(v) => {
                            setStatusFilter(v as 'all' | 'succeeded' | 'failed');
                            setPage(1);
                        }}
                    >
                        <ZoruSelectTrigger className="w-40">
                            <ZoruSelectValue placeholder="Status" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {STATUS_OPTIONS.map((o) => (
                                <ZoruSelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                    <Select
                        value={fyFilter}
                        onValueChange={(v) => {
                            setFyFilter(v as 'current' | 'previous' | 'all');
                            setPage(1);
                        }}
                    >
                        <ZoruSelectTrigger className="w-40">
                            <ZoruSelectValue placeholder="Financial year" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {FY_OPTIONS.map((o) => (
                                <ZoruSelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                    {hasActiveFilters ? (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    ) : null}
                </>
            }
            bulkBar={
                selected.size > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[13px] text-zoru-ink">
                            {selected.size} filing{selected.size === 1 ? '' : 's'} selected
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={bulkDownload}>
                                <Download className="h-4 w-4" /> Bulk download
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportCsv}>
                                <Download className="h-4 w-4" /> CSV
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportXlsx}>
                                <Download className="h-4 w-4" /> XLSX
                            </Button>
                            <Button variant="ghost" size="sm" onClick={clearSelection}>
                                Clear
                            </Button>
                        </div>
                    </div>
                ) : null
            }
            loading={listLoading && rows.length === 0}
            pagination={
                total > PAGE_SIZE ? (
                    <PaginationBar
                        page={page}
                        limit={PAGE_SIZE}
                        hasMore={page < totalPages}
                        total={total}
                        controlled={{
                            onChange: (next) => setPage(next.page),
                        }}
                    />
                ) : null
            }
        >
            <div className="flex flex-col gap-4">
                {kpiStrip}

                <Card>
                    <h2 className="text-[15px] font-semibold text-zoru-ink">
                        Generate filing
                    </h2>
                    <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                        Pick a period — we will materialise the 9-section summary and
                        log it into your filing history.
                    </p>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                        <div>
                            <label className="mb-1 block text-[12px] text-zoru-ink-muted">
                                Month
                            </label>
                            <Select
                                value={String(period.month)}
                                onValueChange={(v) =>
                                    setPeriod((p) => ({ ...p, month: Number(v) }))
                                }
                            >
                                <ZoruSelectTrigger className="w-40">
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {MONTHS.map((m) => (
                                        <ZoruSelectItem key={m.value} value={m.value}>
                                            {m.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[12px] text-zoru-ink-muted">
                                Year
                            </label>
                            <Input
                                type="number"
                                value={period.year}
                                onChange={(e) =>
                                    setPeriod((p) => ({
                                        ...p,
                                        year: Number(e.target.value) || p.year,
                                    }))
                                }
                                className="w-32"
                                min={2017}
                                max={2099}
                            />
                        </div>
                        <Button onClick={handleGenerate} disabled={loading}>
                            {loading ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                                'Generate'
                            )}
                        </Button>
                    </div>
                </Card>

                {result?.summary && (
                    <Card>
                        <h2 className="text-[15px] font-semibold text-zoru-ink">
                            Latest summary — {monthLabel(period.month)} {period.year}
                        </h2>
                        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                            <StatBox
                                label="Outward Taxable"
                                value={fmtInr(result.summary.outward_taxable)}
                            />
                            <StatBox
                                label="Outward Tax"
                                value={fmtInr(result.summary.outward_total_tax)}
                            />
                            <StatBox label="ITC" value={fmtInr(result.summary.itc_total)} />
                            <StatBox
                                label="Net Payable"
                                value={fmtInr(result.summary.net_payable)}
                            />
                        </div>
                    </Card>
                )}

                {result && result.rows.length > 0 && (
                    <Card>
                        <h2 className="text-[15px] font-semibold text-zoru-ink">
                            Sections
                        </h2>
                        <div className="mt-4 overflow-x-auto rounded-lg border border-zoru-line">
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                        {result.columns.map((c) => (
                                            <ZoruTableHead
                                                key={c}
                                                className="text-zoru-ink-muted"
                                            >
                                                {c.replace(/_/g, ' ')}
                                            </ZoruTableHead>
                                        ))}
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {result.rows.map((row, i) => (
                                        <ZoruTableRow key={i} className="border-zoru-line">
                                            {row.map((cell, j) => (
                                                <ZoruTableCell
                                                    key={j}
                                                    className={
                                                        j === 0
                                                            ? 'text-zoru-ink'
                                                            : 'text-right font-mono text-zoru-ink'
                                                    }
                                                >
                                                    {j === 0
                                                        ? String(cell)
                                                        : typeof cell === 'number'
                                                          ? cell.toFixed(2)
                                                          : String(cell ?? '')}
                                                </ZoruTableCell>
                                            ))}
                                        </ZoruTableRow>
                                    ))}
                                </ZoruTableBody>
                            </Table>
                        </div>
                    </Card>
                )}

                <Card className="p-0">
                    <div className="flex items-center justify-between border-b border-zoru-line px-4 py-3">
                        <h2 className="text-[15px] font-semibold text-zoru-ink">
                            Filing history
                        </h2>
                        <p className="text-[12px] text-zoru-ink-muted">
                            {total} filing{total === 1 ? '' : 's'}
                        </p>
                    </div>
                    {rows.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                            <p className="text-[13px] text-zoru-ink-muted">
                                {hasActiveFilters
                                    ? 'No filings match the current filters.'
                                    : 'No GSTR-3B filings generated yet. Pick a period above and click Generate.'}
                            </p>
                            {hasActiveFilters ? (
                                <Button
                                    className="mt-3"
                                    variant="outline"
                                    onClick={clearFilters}
                                >
                                    Clear filters
                                </Button>
                            ) : null}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                        <ZoruTableHead className="w-10">
                                            <Checkbox
                                                checked={
                                                    allOnPageSelected
                                                        ? true
                                                        : someOnPageSelected
                                                          ? 'indeterminate'
                                                          : false
                                                }
                                                onCheckedChange={toggleAllOnPage}
                                                aria-label="Select all on page"
                                            />
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Period
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Status
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-right text-zoru-ink-muted">
                                            Outward Taxable
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-right text-zoru-ink-muted">
                                            Net Payable
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Generated
                                        </ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {rows.map((r) => {
                                        const isSelected = selected.has(r.runId);
                                        return (
                                            <ZoruTableRow key={r.runId} className="border-zoru-line">
                                                <ZoruTableCell>
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleOne(r.runId)}
                                                        aria-label={`Select filing ${r.period}`}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <EntityRowLink
                                                        href={`/dashboard/sabbi/reports/runs/${r.runId}`}
                                                        label={`${monthLabel(r.month)} ${r.year}`}
                                                        subtitle={r.period}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <Badge
                                                        variant={
                                                            r.status === 'succeeded'
                                                                ? 'success'
                                                                : r.status === 'failed'
                                                                  ? 'danger'
                                                                  : 'warning'
                                                        }
                                                    >
                                                        {r.status}
                                                    </Badge>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                    {fmtInr(r.outwardTaxable ?? 0)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                    {fmtInr(r.netPayable ?? 0)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink-muted">
                                                    {formatDateTime(r.startedAt)}
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })}
                                </ZoruTableBody>
                            </Table>
                        </div>
                    )}
                </Card>
            </div>
        </EntityListShell>
    );
}

function KpiCard({
    label,
    value,
    icon,
    hint,
}: {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    hint?: string;
}) {
    return (
        <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                        {label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zoru-ink">{value}</p>
                    {hint ? (
                        <p className="mt-1 truncate text-[12px] text-zoru-ink-muted">
                            {hint}
                        </p>
                    ) : null}
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2 text-zoru-ink">
                    {icon}
                </div>
            </div>
        </Card>
    );
}

function StatBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-4">
            <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </p>
            <p className="mt-1 font-mono text-[16px] text-zoru-ink">{value}</p>
        </div>
    );
}
