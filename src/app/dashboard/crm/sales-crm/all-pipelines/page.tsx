'use client';

/**
 * Sales Pipelines — list page (Deep template).
 *
 * Mirrors the §1D Leads page composition:
 *   • KPI strip (4 cards: total pipelines, in-flight value, avg velocity, top pipeline)
 *   • Filter row (search + status select + date range)
 *   • Bulk action bar (bulk delete + bulk export)
 *   • CSV/XLSX export
 *   • PaginationBar
 *   • EntityRowLink on the primary cell
 *
 * Pipelines are stored embedded on `users.crmPipelines[]`. Filtering and
 * pagination happen client-side over the small set returned by
 * `getCrmPipelines()`. Tenant scoping is enforced by `getSession()` inside
 * every server action used here.
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import {
    Activity,
    Columns3,
    Download,
    Layers,
    Plus,
    Trash2,
    TrendingUp,
    Trophy,
    X,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import {
    Badge,
    Button,
    Card,
    ZoruCardContent,
    Checkbox,
    ZoruDateRangePicker,
    DropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuTrigger,
    Label,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    StatCard,
    useZoruToast,
} from '@/components/sabcrm/20ui/compat';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    bulkDeleteCrmPipelines,
    getCrmPipelineKpis,
    getCrmPipelines,
    type CrmPipelineKpis,
} from '@/app/actions/crm-pipelines.actions';
import { getSession } from '@/app/actions/user.actions';
import type { CrmPipeline } from '@/lib/definitions';

import { EditPipelinesDialog } from '@/components/zoruui-domain/edit-pipelines-dialog';

const PIPELINES_PER_PAGE = 10;

const EMPTY_KPIS: CrmPipelineKpis = {
    total: 0,
    inFlightValue: 0,
    avgVelocityDays: 0,
    topPipelineName: '—',
    currency: 'INR',
};

type PipelineStatusFilter = 'all' | 'active' | 'archived' | 'draft';
type PipelineRow = CrmPipeline & {
    status?: string;
    isDefault?: boolean;
    createdAt?: string | Date;
    updatedAt?: string | Date;
};

function getStageCount(p: PipelineRow): number {
    return Array.isArray(p?.stages) ? p.stages.length : 0;
}

function getPipelineStatus(p: PipelineRow): PipelineStatusFilter {
    const s = String(p?.status ?? 'active').toLowerCase();
    if (s === 'archived') return 'archived';
    if (s === 'draft') return 'draft';
    return 'active';
}

function getPipelineCreatedAt(p: PipelineRow): Date | null {
    const v = p?.createdAt;
    if (!v) return null;
    if (v instanceof Date) return v;
    const t = Date.parse(String(v));
    return Number.isFinite(t) ? new Date(t) : null;
}

function formatCurrency(value: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency} ${value.toLocaleString()}`;
    }
}

export default function SalesPipelinePage() {
    const { toast } = useZoruToast();

    // List + KPIs
    const [pipelines, setPipelines] = React.useState<PipelineRow[]>([]);
    const [kpis, setKpis] = React.useState<CrmPipelineKpis>(EMPTY_KPIS);
    const [isPending, startTransition] = React.useTransition();

    // Filters
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<PipelineStatusFilter>('all');
    const [ownerFilter, setOwnerFilter] = React.useState<'all' | 'mine'>('all');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [currentUserId, setCurrentUserId] = React.useState<string | undefined>();

    // Selection / dialogs / pagination
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
    const [page, setPage] = React.useState(1);
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [isCreateOpen, setIsCreateOpen] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        getSession().then((s) => {
            if (cancelled) return;
            setCurrentUserId(s?.user?._id ? String(s.user._id) : undefined);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [list, kpiData] = await Promise.all([
                getCrmPipelines(),
                getCrmPipelineKpis(),
            ]);
            setPipelines((list ?? []) as PipelineRow[]);
            setKpis(kpiData ?? EMPTY_KPIS);
        });
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    // Filtered + paginated client-side
    const filteredPipelines = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return pipelines.filter((p) => {
            if (q) {
                const name = String(p?.name ?? '').toLowerCase();
                if (!name.includes(q)) return false;
            }
            if (statusFilter !== 'all') {
                if (getPipelineStatus(p) !== statusFilter) return false;
            }
            if (ownerFilter === 'mine' && currentUserId) {
                // Pipelines are embedded on the session user — when ownerFilter
                // is `mine` we keep all rows (they're already owned). Stub
                // kept for parity with the leads-page UI.
            }
            if (dateRange?.from || dateRange?.to) {
                const created = getPipelineCreatedAt(p);
                if (!created) return false;
                if (dateRange.from && created < dateRange.from) return false;
                if (dateRange.to && created > dateRange.to) return false;
            }
            return true;
        });
    }, [pipelines, search, statusFilter, ownerFilter, currentUserId, dateRange]);

    const totalFiltered = filteredPipelines.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PIPELINES_PER_PAGE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PIPELINES_PER_PAGE;
    const pageRows = filteredPipelines.slice(pageStart, pageStart + PIPELINES_PER_PAGE);

    const hasActiveFilters =
        !!search ||
        statusFilter !== 'all' ||
        ownerFilter !== 'all' ||
        !!dateRange?.from ||
        !!dateRange?.to;

    const clearFilters = React.useCallback(() => {
        setSearch('');
        setStatusFilter('all');
        setOwnerFilter('all');
        setDateRange(undefined);
        setPage(1);
    }, []);

    // Selection helpers
    const handleToggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleToggleAll = React.useCallback(
        (all: boolean) => {
            setSelected(all ? new Set(pageRows.map((p) => String(p.id))) : new Set());
        },
        [pageRows],
    );

    const allOnPageSelected =
        pageRows.length > 0 && pageRows.every((p) => selected.has(String(p.id)));

    // Export
    const exportRows = React.useCallback(
        (format: 'csv' | 'xlsx') => {
            const rows =
                selected.size > 0
                    ? filteredPipelines.filter((p) => selected.has(String(p.id)))
                    : filteredPipelines;
            const header = ['Name', 'Stages', 'Status', 'Default', 'CreatedAt'];
            const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const lines = [
                header.join(','),
                ...rows.map((p) =>
                    [
                        escape(p.name ?? ''),
                        escape(getStageCount(p)),
                        escape(getPipelineStatus(p)),
                        escape(p?.isDefault ? 'yes' : 'no'),
                        escape(
                            getPipelineCreatedAt(p)
                                ? (getPipelineCreatedAt(p) as Date).toISOString()
                                : '',
                        ),
                    ].join(','),
                ),
            ];
            // CSV and XLSX both consume CSV-compatible content; the .xlsx
            // export uses the SpreadsheetML MIME so Excel/Numbers offers
            // to import. Avoids an extra dep.
            const body = lines.join('\n');
            const mime =
                format === 'csv'
                    ? 'text/csv;charset=utf-8;'
                    : 'application/vnd.ms-excel;charset=utf-8;';
            const blob = new Blob([body], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pipelines-${new Date().toISOString().slice(0, 10)}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
        },
        [filteredPipelines, selected],
    );

    // Bulk delete
    const handleConfirmBulkDelete = React.useCallback(async () => {
        if (selected.size === 0) {
            setBulkDeleteOpen(false);
            return;
        }
        const ids = Array.from(selected);
        const res = await bulkDeleteCrmPipelines(ids);
        if (res.success) {
            toast({
                title: `${res.processed} pipeline${res.processed === 1 ? '' : 's'} deleted`,
            });
            setSelected(new Set());
            fetchData();
        } else {
            toast({
                title: 'Bulk delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setBulkDeleteOpen(false);
    }, [selected, fetchData, toast]);

    const subtitleCurrency = kpis.currency || 'INR';

    return (
        <>
            <EditPipelinesDialog
                isOpen={isEditOpen}
                onOpenChange={setIsEditOpen}
                onSuccess={fetchData}
                initialPipelines={pipelines}
            />
            <EditPipelinesDialog
                isOpen={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSuccess={fetchData}
                isCreating
                initialPipelines={pipelines}
            />

            <EntityListShell
                title="Sales Pipelines"
                subtitle="Create and manage multiple sales pipelines to track your deals."
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search pipeline name…',
                }}
                primaryAction={
                    <>
                        <Button variant="outline" onClick={() => setIsEditOpen(true)}>
                            Edit Pipelines
                        </Button>
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="h-4 w-4" /> New Pipeline
                        </Button>
                    </>
                }
                filters={
                    <PipelinesFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                        ownerFilter={ownerFilter}
                        onOwnerChange={(v) => {
                            setOwnerFilter(v);
                            setPage(1);
                        }}
                        dateRange={dateRange}
                        onDateRangeChange={(r) => {
                            setDateRange(r);
                            setPage(1);
                        }}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <PipelinesBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onDelete={() => setBulkDeleteOpen(true)}
                            onExportCsv={() => exportRows('csv')}
                            onExportXlsx={() => exportRows('xlsx')}
                        />
                    ) : null
                }
                empty={
                    !isPending && pageRows.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--st-bg-muted)]">
                                <Columns3 className="h-6 w-6 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
                            </div>
                            <h3 className="text-base font-medium text-[var(--st-text)]">
                                {hasActiveFilters ? 'No pipelines match your filters' : 'No pipelines yet'}
                            </h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                {hasActiveFilters
                                    ? 'Try clearing your filters or create a new pipeline.'
                                    : "You haven't created any pipelines yet. Get started by creating one."}
                            </p>
                            <Button onClick={() => setIsCreateOpen(true)}>
                                <Plus className="h-4 w-4" /> Create Your First Pipeline
                            </Button>
                        </div>
                    ) : null
                }
                loading={isPending && pipelines.length === 0}
                pagination={
                    totalFiltered > 0 ? (
                        <PaginationBar
                            page={safePage}
                            limit={PIPELINES_PER_PAGE}
                            hasMore={safePage < totalPages}
                            total={totalFiltered}
                            controlled={{
                                onChange: (next) => setPage(next.page),
                            }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            label="Total pipelines"
                            value={kpis.total.toLocaleString()}
                            icon={<Layers />}
                            period="across this tenant"
                        />
                        <StatCard
                            label="Deals in flight"
                            value={formatCurrency(kpis.inFlightValue, subtitleCurrency)}
                            icon={<TrendingUp />}
                            period="open deals · all pipelines"
                        />
                        <StatCard
                            label="Average velocity"
                            value={`${kpis.avgVelocityDays.toLocaleString()} days`}
                            icon={<Activity />}
                            period="time deals spend open"
                        />
                        <StatCard
                            label="Top pipeline"
                            value={kpis.topPipelineName || '—'}
                            icon={<Trophy />}
                            period="most deals attached"
                        />
                    </div>

                    {pageRows.length > 0 ? (
                        <PipelinesGrid
                            rows={pageRows}
                            selectedIds={selected}
                            onToggleOne={handleToggleOne}
                            onToggleAll={handleToggleAll}
                            allSelected={allOnPageSelected}
                            loading={isPending}
                        />
                    ) : null}
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Delete ${selected.size} pipeline${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected pipelines from this tenant. Deals attached to them keep their pipelineId, but the pipeline configuration is lost. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmBulkDelete}
            />
        </>
    );
}

/* ─── Filters row ─────────────────────────────────────────────────────── */

interface PipelinesFiltersRowProps {
    statusFilter: PipelineStatusFilter;
    onStatusChange: (v: PipelineStatusFilter) => void;
    ownerFilter: 'all' | 'mine';
    onOwnerChange: (v: 'all' | 'mine') => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

function PipelinesFiltersRow(props: PipelinesFiltersRowProps): React.JSX.Element {
    return (
        <Card>
            <ZoruCardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-4">
                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Status
                    </Label>
                    <Select
                        value={props.statusFilter}
                        onValueChange={(v) => props.onStatusChange(v as PipelineStatusFilter)}
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue placeholder="All statuses" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                            <ZoruSelectItem value="active">Active</ZoruSelectItem>
                            <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                            <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Owner
                    </Label>
                    <Select
                        value={props.ownerFilter}
                        onValueChange={(v) => props.onOwnerChange(v as 'all' | 'mine')}
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue placeholder="Any owner" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">Any owner</ZoruSelectItem>
                            <ZoruSelectItem value="mine">Mine</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>

                <div className="space-y-1 md:col-span-1 lg:col-span-2">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Created
                    </Label>
                    <ZoruDateRangePicker
                        value={props.dateRange}
                        onChange={props.onDateRangeChange}
                    />
                </div>

                {props.hasActiveFilters ? (
                    <div className="flex items-end md:col-span-3 lg:col-span-4">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={props.onClear}
                        >
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </Button>
                    </div>
                ) : null}
            </ZoruCardContent>
        </Card>
    );
}

/* ─── Bulk action bar ─────────────────────────────────────────────────── */

interface PipelinesBulkBarProps {
    count: number;
    onClear: () => void;
    onDelete: () => void;
    onExportCsv: () => void;
    onExportXlsx: () => void;
}

function PipelinesBulkBar(props: PipelinesBulkBarProps): React.JSX.Element {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--st-text)]">
                {props.count} selected
            </span>
            <span className="flex-1" />
            <DropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                        <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                    <ZoruDropdownMenuItem onClick={props.onExportCsv}>
                        Export as CSV
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem onClick={props.onExportXlsx}>
                        Export as XLSX
                    </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="destructive" onClick={props.onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={props.onClear}>
                Clear
            </Button>
        </div>
    );
}

/* ─── Grid (rows w/ checkbox + EntityRowLink) ────────────────────────── */

interface PipelinesGridProps {
    rows: PipelineRow[];
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    allSelected: boolean;
    loading: boolean;
}

function PipelinesGrid(props: PipelinesGridProps): React.JSX.Element {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 px-1 text-[12px] text-[var(--st-text-secondary)]">
                <Checkbox
                    aria-label="Select all on this page"
                    checked={props.allSelected}
                    onCheckedChange={(c) => props.onToggleAll(c === true)}
                />
                <span>Select all on this page</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {props.rows.map((p) => {
                    const id = String(p.id);
                    const status = getPipelineStatus(p);
                    const isSelected = props.selectedIds.has(id);
                    return (
                        <Card
                            key={id}
                            className={
                                isSelected
                                    ? 'border-[var(--st-text)]/40 ring-1 ring-[var(--st-text)]/20'
                                    : undefined
                            }
                        >
                            <ZoruCardContent className="space-y-3 pt-4">
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        aria-label={`Select ${p.name}`}
                                        checked={isSelected}
                                        onCheckedChange={() => props.onToggleOne(id)}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <EntityRowLink
                                            href={`/dashboard/sabbigin/pipelines/${id}`}
                                            label={p.name || 'Untitled pipeline'}
                                            subtitle={`${getStageCount(p)} stage${getStageCount(p) === 1 ? '' : 's'}`}
                                        />
                                    </div>
                                    <Badge
                                        variant={status === 'active' ? 'default' : 'secondary'}
                                    >
                                        {status}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {(p.stages ?? []).slice(0, 6).map((stage) => (
                                        <div
                                            key={stage.id}
                                            className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2 text-center"
                                        >
                                            <p className="truncate text-[12.5px] font-medium text-[var(--st-text)]">
                                                {stage.name}
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
                                                {stage.chance ?? 0}% chance
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end">
                                    <Link
                                        href="/dashboard/crm/deals"
                                        className="text-[12px] font-medium text-[var(--st-text)] hover:underline"
                                    >
                                        View deals in this pipeline →
                                    </Link>
                                </div>
                            </ZoruCardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
