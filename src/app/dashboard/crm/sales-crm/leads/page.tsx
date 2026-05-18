'use client';

import { ZoruButton, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import { Plus,
  Sparkles } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';

/**
 * Leads — list page (rebuilt per §1D.1, follow-up additions wire in
 * funnel chart, saved views, duplicates link, and bulk pickers).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 stat cards + funnel chart on the right)
 *     • Views menu (saved presets) + Filter row
 *     • View switcher (Table / Kanban) + Find duplicates link
 *     • Bulk action bar when rows are selected
 *     • <LeadsTable /> or <LeadsKanban />
 *     • Pagination
 */

import * as React from 'react';
import Link from 'next/link';

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
import { getSession } from '@/app/actions/user.actions';
import type { CrmLead } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import type { DateRange } from 'react-day-picker';

import { LeadsTable } from './_components/leads-table';
import { LeadsKanban } from './_components/leads-kanban';
import { LeadsKpiStrip } from './_components/leads-kpi-strip';
import { LeadsHeaderTools, type LeadsViewMode } from './_components/leads-header-tools';
import {
    LeadsBulkBar,
    LeadsFiltersRow,
    buildLeadsViewState,
    type LeadsStatusFilter,
} from './_components/leads-filters';

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

    // Saved view preset + extra client-side predicate
    const [activePresetId, setActivePresetId] = React.useState<string>('all');
    const [clientPredicate, setClientPredicate] = React.useState<
        ((lead: Record<string, unknown>) => boolean) | null
    >(null);
    const [currentUserId, setCurrentUserId] = React.useState<string | undefined>();

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

    // Selection + view + dialogs
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [view, setView] = React.useState<LeadsViewMode>('table');
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
        setActivePresetId('all');
        setClientPredicate(null);
    }, []);

    const hasActiveFilters =
        statusFilter !== 'all' ||
        !!sourceFilter ||
        !!pipelineFilter ||
        !!ownerFilter ||
        !!dateRange?.from ||
        !!dateRange?.to ||
        !!minValue ||
        !!maxValue ||
        activePresetId !== 'all';

    // ─── Row actions ─────────────────────────────────────────────────────
    const handleToggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const displayedLeads = React.useMemo(() => {
        if (!clientPredicate) return leads;
        return leads.filter((l) => clientPredicate(l as unknown as Record<string, unknown>));
    }, [leads, clientPredicate]);

    const handleToggleAll = React.useCallback(
        (all: boolean) => {
            setSelected(all ? new Set(displayedLeads.map((l) => String(l._id))) : new Set());
        },
        [displayedLeads],
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
        async (op: 'archive' | 'delete' | 'status' | 'assign', payload?: string) => {
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

    const runBulkAddTags = React.useCallback(
        async (tagIds: string[]) => {
            if (selected.size === 0 || tagIds.length === 0) return;
            const ids = Array.from(selected);
            // Re-uses updateCrmLeadTags per lead — additive merge of tags.
            const { updateCrmLeadTags } = await import('@/app/actions/crm-leads.actions');
            const existingLeadsById = new Map(leads.map((l) => [String(l._id), l]));
            let ok = 0;
            for (const id of ids) {
                const lead = existingLeadsById.get(id);
                const current = ((lead as any)?.tags as string[] | undefined) ?? [];
                const next = Array.from(new Set([...current, ...tagIds]));
                const res = await updateCrmLeadTags(id, next);
                if (res.success) ok += 1;
            }
            toast({ title: `${ok} lead${ok === 1 ? '' : 's'} tagged` });
            setSelected(new Set());
            fetchData();
        },
        [selected, leads, fetchData, toast],
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

    const applyPreset = React.useCallback(
        (presetId: string) => {
            const next = buildLeadsViewState(presetId, currentUserId);
            setActivePresetId(presetId);
            setLeadsStatusFilter(next.statusFilter);
            setSourceFilter(next.sourceFilter);
            setPipelineFilter(next.pipelineFilter);
            setOwnerFilter(next.ownerFilter);
            setDateRange(next.dateRange);
            setMinValue(next.minValue);
            setMaxValue(next.maxValue);
            setClientPredicate(next.clientPredicate ? () => next.clientPredicate! : null);
            setPage(1);
            if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        },
        [currentUserId],
    );

    const totalPages = Math.max(1, Math.ceil(total / LEADS_PER_PAGE));

    // Funnel stages — derived from KPIs + a quick projection over the
    // currently loaded page for the Contacted/Proposal buckets that
    // aren't broken out in the server aggregate.
    const funnelStages = React.useMemo(() => {
        const counters = { Contacted: 0, Proposal: 0 } as Record<string, number>;
        for (const l of leads) {
            const s = String((l as any).status ?? '').trim();
            if (s === 'Contacted') counters.Contacted += 1;
            if (s === 'Proposal' || (l as any).stage === 'Proposal') counters.Proposal += 1;
        }
        return [
            { key: 'New', label: 'New', count: kpis.newCount },
            { key: 'Contacted', label: 'Contacted', count: counters.Contacted },
            { key: 'Qualified', label: 'Qualified', count: kpis.qualifiedCount },
            { key: 'Proposal', label: 'Proposal', count: counters.Proposal },
            { key: 'Won', label: 'Won', count: kpis.wonCount },
        ];
    }, [kpis, leads]);

    return (
        <>
            <EntityListShell
                title="All Leads"
                subtitle="Pipeline of incoming prospects — convert into accounts and deals."
                viewSwitcher={
                    <LeadsHeaderTools
                        view={view}
                        onViewChange={setView}
                        activePresetId={activePresetId}
                        onSelectPreset={applyPreset}
                    />
                }
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search title, name, email, company…',
                }}
                primaryAction={
                    <ZoruButton asChild>
                        <Link href="/dashboard/crm/sales-crm/leads/new">
                            <Plus className="h-4 w-4" /> New Lead
                        </Link>
                    </ZoruButton>
                }
                filters={
                    <LeadsFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setLeadsStatusFilter(v);
                            setActivePresetId('all');
                            setClientPredicate(null);
                            setPage(1);
                        }}
                        sourceFilter={sourceFilter}
                        onSourceChange={(v) => {
                            setSourceFilter(v);
                            setActivePresetId('all');
                            setClientPredicate(null);
                            setPage(1);
                        }}
                        pipelineFilter={pipelineFilter}
                        onPipelineChange={(v) => {
                            setPipelineFilter(v);
                            setActivePresetId('all');
                            setClientPredicate(null);
                            setPage(1);
                        }}
                        ownerFilter={ownerFilter}
                        onOwnerChange={(v) => {
                            setOwnerFilter(v);
                            setActivePresetId('all');
                            setClientPredicate(null);
                            setPage(1);
                        }}
                        dateRange={dateRange}
                        onDateRangeChange={(r) => {
                            setDateRange(r);
                            setActivePresetId('all');
                            setClientPredicate(null);
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
                            onAssign={(userId) => runBulk('assign', userId ?? '')}
                            onAddTags={runBulkAddTags}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    !isPending && displayedLeads.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Sparkles className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">No leads yet</h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Start capturing prospects in your sales pipeline. New leads can
                                later be converted into accounts and deals.
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/sales-crm/leads/new">
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
                    <LeadsKpiStrip
                        kpis={kpis}
                        statusFilter={statusFilter}
                        hasActiveFilters={hasActiveFilters}
                        funnelStages={funnelStages}
                        onClearAll={clearFilters}
                        onPickStatus={setFilterFromKpi}
                    />

                    {view === 'table' ? (
                        <LeadsTable
                            leads={displayedLeads}
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
                        <LeadsKanban leads={displayedLeads} onAfterMove={fetchData} />
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
