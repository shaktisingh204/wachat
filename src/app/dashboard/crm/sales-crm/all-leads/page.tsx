'use client';

/**
 * Leads — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (clickable filter cards)
 *     • Filter row (status · source · pipeline · owner · date range · score range)
 *     • View switcher (Table / Kanban)
 *     • Bulk action bar when rows are selected
 *     • <LeadsTable /> or <LeadsKanban />
 *     • Pagination
 *
 * Data flow is fully client-side: every dependent query refetches
 * through `getCrmLeads` whenever the filter or page state changes,
 * matching the original page's `useTransition` + `useDebouncedCallback`
 * pattern. All KPI counts come from a separate `getCrmLeadKpis` call
 * that runs once per filter-relevant render.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import {
    Archive,
    BarChart3,
    Building,
    CheckCircle2,
    LayoutGrid,
    List,
    Plus,
    Sparkles,
    Trophy,
    Users,
    X,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
    ZoruButton,
    ZoruStatCard,
    useZoruToast,
} from '@/components/zoruui';

import {
    archiveCrmLead,
    bulkLeadAction,
    deleteCrmLead,
    getCrmLeadKpis,
    getCrmLeads,
    unarchiveCrmLead,
    type CrmLeadKpis,
    type CrmLeadListFilters,
} from '@/app/actions/crm-leads.actions';
import { convertLeadToAccount } from '@/app/actions/worksuite/conversions.actions';
import type { CrmLead } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import type { DateRange } from 'react-day-picker';

import { LeadsTable } from './_components/leads-table';
import { LeadsKanban } from './_components/leads-kanban';
import {
    LeadsBulkBar,
    LeadsFiltersRow,
    type LeadsStatusFilter,
} from './_components/leads-filters';

type ViewMode = 'table' | 'kanban';

const LEADS_PER_PAGE = 20;

const EMPTY_KPIS: CrmLeadKpis = {
    total: 0,
    newCount: 0,
    qualifiedCount: 0,
    wonCount: 0,
    archivedCount: 0,
    conversionRate: 0,
};

export default function AllLeadsPage() {
    const router = useRouter();
    const { toast } = useZoruToast();

    // List state
    const [leads, setLeads] = React.useState<WithId<CrmLead>[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [isPending, startTransition] = React.useTransition();
    const [kpis, setKpis] = React.useState<CrmLeadKpis>(EMPTY_KPIS);

    // Filters
    const [search, setSearch] = React.useState('');
    const [statusFilter, setLeadsStatusFilter] = React.useState<LeadsStatusFilter>('all');
    const [sourceFilter, setSourceFilter] = React.useState('');
    const [pipelineFilter, setPipelineFilter] = React.useState('');
    const [ownerFilter, setOwnerFilter] = React.useState('');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [minValue, setMinValue] = React.useState<string>('');
    const [maxValue, setMaxValue] = React.useState<string>('');

    // Selection + view + dialogs
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [view, setView] = React.useState<ViewMode>('table');
    const [convertingId, setConvertingId] = React.useState<string | null>(null);
    const [archiveTargetId, setArchiveTargetId] = React.useState<string | null>(null);
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

    const filters: CrmLeadListFilters = React.useMemo(() => {
        const f: CrmLeadListFilters = {};
        if (statusFilter !== 'all') {
            f.status = statusFilter;
            if (statusFilter === 'archived') f.includeArchived = true;
        }
        if (sourceFilter) f.source = sourceFilter;
        if (pipelineFilter) f.pipelineId = pipelineFilter;
        if (ownerFilter) f.assignedTo = ownerFilter;
        if (dateRange?.from) f.createdAfter = dateRange.from;
        if (dateRange?.to) f.createdBefore = dateRange.to;
        const n = Number(minValue);
        if (Number.isFinite(n) && minValue !== '') f.minValue = n;
        const m = Number(maxValue);
        if (Number.isFinite(m) && maxValue !== '') f.maxValue = m;
        return f;
    }, [statusFilter, sourceFilter, pipelineFilter, ownerFilter, dateRange, minValue, maxValue]);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ leads: rows, total: count }, kpiData] = await Promise.all([
                getCrmLeads(page, LEADS_PER_PAGE, search, filters),
                getCrmLeadKpis(),
            ]);
            setLeads(rows);
            setTotal(count);
            setKpis(kpiData ?? EMPTY_KPIS);
        });
    }, [page, search, filters]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const clearFilters = React.useCallback(() => {
        setLeadsStatusFilter('all');
        setSourceFilter('');
        setPipelineFilter('');
        setOwnerFilter('');
        setDateRange(undefined);
        setMinValue('');
        setMaxValue('');
        setSearch('');
        setPage(1);
    }, []);

    const hasActiveFilters =
        statusFilter !== 'all' ||
        !!sourceFilter ||
        !!pipelineFilter ||
        !!ownerFilter ||
        !!dateRange?.from ||
        !!dateRange?.to ||
        !!minValue ||
        !!maxValue;

    // ─── Row actions ─────────────────────────────────────────────────────
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
            setSelected(all ? new Set(leads.map((l) => String(l._id))) : new Set());
        },
        [leads],
    );

    const handleConvert = React.useCallback(
        async (id: string) => {
            setConvertingId(id);
            const res = await convertLeadToAccount(id);
            setConvertingId(null);
            if (res.success) {
                toast({ title: 'Converted to account' });
                fetchData();
            } else {
                toast({
                    title: 'Conversion failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [fetchData, toast],
    );

    const archiveTarget = React.useMemo(
        () => leads.find((l) => String(l._id) === archiveTargetId) ?? null,
        [leads, archiveTargetId],
    );
    const deleteTarget = React.useMemo(
        () => leads.find((l) => String(l._id) === deleteTargetId) ?? null,
        [leads, deleteTargetId],
    );

    const handleConfirmArchive = React.useCallback(async () => {
        if (!archiveTargetId || !archiveTarget) return;
        const archived =
            (archiveTarget.status as string)?.toLowerCase() === 'archived';
        const res = archived
            ? await unarchiveCrmLead(archiveTargetId)
            : await archiveCrmLead(archiveTargetId);
        if (res.success) {
            toast({ title: archived ? 'Lead restored' : 'Lead archived' });
            fetchData();
        } else {
            toast({
                title: archived ? 'Restore failed' : 'Archive failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setArchiveTargetId(null);
    }, [archiveTarget, archiveTargetId, fetchData, toast]);

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteCrmLead(deleteTargetId);
        if (res.success) {
            toast({ title: 'Lead deleted' });
            fetchData();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, fetchData, toast]);

    // ─── Bulk actions ────────────────────────────────────────────────────
    const runBulk = React.useCallback(
        async (op: 'archive' | 'delete' | 'status', payload?: string) => {
            if (selected.size === 0) return;
            const ids = Array.from(selected);
            const res = await bulkLeadAction(ids, op, payload);
            if (res.success) {
                toast({
                    title: `${res.processed} lead${res.processed === 1 ? '' : 's'} updated`,
                });
                setSelected(new Set());
                fetchData();
            } else {
                toast({
                    title: 'Bulk action failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [selected, fetchData, toast],
    );

    const exportCsv = React.useCallback(() => {
        const rows =
            selected.size > 0
                ? leads.filter((l) => selected.has(String(l._id)))
                : leads;
        const header = [
            'Title',
            'Contact',
            'Email',
            'Phone',
            'Company',
            'Source',
            'Status',
            'Stage',
            'Value',
            'Currency',
            'CreatedAt',
        ];
        const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...rows.map((l) =>
                [
                    escape(l.title),
                    escape(l.contactName),
                    escape(l.email),
                    escape(l.phone),
                    escape(l.company),
                    escape(l.source),
                    escape(l.status),
                    escape(l.stage),
                    escape(l.value ?? 0),
                    escape(l.currency || 'INR'),
                    escape(l.createdAt ? new Date(l.createdAt).toISOString() : ''),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [leads, selected]);

    // ─── KPI cards: clicking applies a status filter on the list ─────────
    const setFilterFromKpi = React.useCallback((next: LeadsStatusFilter) => {
        setLeadsStatusFilter((prev) => (prev === next ? 'all' : next));
        setPage(1);
    }, []);

    const kpiCard = (
        label: string,
        value: React.ReactNode,
        icon: React.ReactNode,
        active: boolean,
        onClick: () => void,
    ) => (
        <button
            type="button"
            onClick={onClick}
            className={[
                'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
                active ? 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]' : '',
            ].join(' ')}
        >
            <ZoruStatCard label={label} value={value} icon={icon} />
        </button>
    );

    const totalPages = Math.max(1, Math.ceil(total / LEADS_PER_PAGE));

    return (
        <>
            <EntityListShell
                title="All Leads"
                subtitle="Pipeline of incoming prospects — convert into accounts and deals."
                viewSwitcher={
                    <div className="inline-flex rounded-md border border-zoru-line p-0.5">
                        <button
                            type="button"
                            onClick={() => setView('table')}
                            aria-pressed={view === 'table'}
                            className={[
                                'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                                view === 'table'
                                    ? 'bg-zoru-surface text-zoru-ink'
                                    : 'text-zoru-ink-muted hover:text-zoru-ink',
                            ].join(' ')}
                        >
                            <List className="h-3.5 w-3.5" /> Table
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('kanban')}
                            aria-pressed={view === 'kanban'}
                            className={[
                                'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                                view === 'kanban'
                                    ? 'bg-zoru-surface text-zoru-ink'
                                    : 'text-zoru-ink-muted hover:text-zoru-ink',
                            ].join(' ')}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                        </button>
                    </div>
                }
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search title, name, email, company…',
                }}
                primaryAction={
                    <ZoruButton asChild>
                        <Link href="/dashboard/crm/sales-crm/all-leads/new">
                            <Plus className="h-4 w-4" /> New Lead
                        </Link>
                    </ZoruButton>
                }
                filters={
                    <LeadsFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setLeadsStatusFilter(v);
                            setPage(1);
                        }}
                        sourceFilter={sourceFilter}
                        onSourceChange={(v) => {
                            setSourceFilter(v);
                            setPage(1);
                        }}
                        pipelineFilter={pipelineFilter}
                        onPipelineChange={(v) => {
                            setPipelineFilter(v);
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
                        minValue={minValue}
                        maxValue={maxValue}
                        onMinChange={(v) => {
                            setMinValue(v);
                            setPage(1);
                        }}
                        onMaxChange={(v) => {
                            setMaxValue(v);
                            setPage(1);
                        }}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <LeadsBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onArchive={() => runBulk('archive')}
                            onDelete={() => runBulk('delete')}
                            onStatusChange={(s) => runBulk('status', s)}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    !isPending && leads.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Sparkles className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">No leads yet</h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Start capturing prospects in your sales pipeline. New leads can
                                later be converted into accounts and deals.
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/sales-crm/all-leads/new">
                                    <Plus className="h-4 w-4" /> Add your first lead
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isPending && leads.length === 0}
                pagination={
                    leads.length > 0 ? (
                        <PaginationBar
                            page={page}
                            limit={LEADS_PER_PAGE}
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
                    {/* KPI strip */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                        {kpiCard(
                            'Total',
                            kpis.total.toLocaleString(),
                            <Users className="h-4 w-4" />,
                            statusFilter === 'all' && !hasActiveFilters,
                            () => clearFilters(),
                        )}
                        {kpiCard(
                            'New',
                            kpis.newCount.toLocaleString(),
                            <Sparkles className="h-4 w-4" />,
                            statusFilter === 'New',
                            () => setFilterFromKpi('New'),
                        )}
                        {kpiCard(
                            'Qualified',
                            kpis.qualifiedCount.toLocaleString(),
                            <CheckCircle2 className="h-4 w-4" />,
                            statusFilter === 'Qualified',
                            () => setFilterFromKpi('Qualified'),
                        )}
                        {kpiCard(
                            'Won',
                            kpis.wonCount.toLocaleString(),
                            <Trophy className="h-4 w-4" />,
                            statusFilter === 'Won',
                            () => setFilterFromKpi('Won'),
                        )}
                        {kpiCard(
                            'Conversion',
                            `${kpis.conversionRate}%`,
                            <BarChart3 className="h-4 w-4" />,
                            false,
                            () => {},
                        )}
                    </div>

                    {view === 'table' ? (
                        <LeadsTable
                            leads={leads}
                            loading={isPending}
                            selectedIds={selected}
                            onToggleOne={handleToggleOne}
                            onToggleAll={handleToggleAll}
                            onArchive={(id) => setArchiveTargetId(id)}
                            onDelete={(id) => setDeleteTargetId(id)}
                            onConvert={handleConvert}
                            convertingId={convertingId}
                        />
                    ) : (
                        <LeadsKanban leads={leads} />
                    )}
                </div>
            </EntityListShell>

            {/* Archive confirmation */}
            <ConfirmDialog
                open={!!archiveTargetId}
                onOpenChange={(o) => !o && setArchiveTargetId(null)}
                title={
                    (archiveTarget?.status as string)?.toLowerCase() === 'archived'
                        ? 'Restore this lead?'
                        : 'Archive this lead?'
                }
                description={
                    (archiveTarget?.status as string)?.toLowerCase() === 'archived'
                        ? `"${archiveTarget?.title}" will be restored to your active list with status set to New.`
                        : `"${archiveTarget?.title}" will be hidden from default views. You can restore it later.`
                }
                confirmLabel={
                    (archiveTarget?.status as string)?.toLowerCase() === 'archived'
                        ? 'Restore'
                        : 'Archive'
                }
                confirmTone="primary"
                onConfirm={handleConfirmArchive}
            />

            {/* Delete (hard) confirmation — uncommon but available */}
            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this lead permanently?"
                description={`This permanently removes "${deleteTarget?.title}". This action cannot be undone.`}
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />
        </>
    );
}

