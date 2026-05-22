'use client';

/**
 * Lead Agents — list page (Deep template).
 *
 * Mirrors the §1D Leads page composition:
 *   • KPI strip (4 cards: total agents, active, leads handled, top performer)
 *   • Filter row (search + agent select + lead select + date range)
 *   • Bulk action bar (bulk delete + bulk export)
 *   • CSV/XLSX export
 *   • PaginationBar
 *   • EntityRowLink on the primary cell (lead -> lead detail)
 *
 * Data lives in `crm_lead_agents` (one row = one lead↔employee assignment).
 * Tenant scoping is enforced by `getSession()` inside every server action.
 * Add/edit UX still flows through the existing `<EditAgentDialog>` (a thin
 * wrapper over the worksuite save action) so we don't reinvent the form.
 */

import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
    Download,
    Pencil,
    Plus,
    Trash2,
    Trophy,
    UserCheck,
    UserCog,
    Users,
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
    Dialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
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
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    bulkDeleteLeadAgents,
    deleteLeadAgent,
    getLeadAgentKpis,
    getLeadAgents,
    saveLeadAgent,
    type LeadAgentKpis,
} from '@/app/actions/worksuite/crm-plus.actions';
import { lookupEntity } from '@/app/actions/crm-lookup.actions';
import { getSession } from '@/app/actions/user.actions';
import type { WsLeadAgent } from '@/lib/worksuite/crm-types';

const AGENTS_PER_PAGE = 20;

const EMPTY_KPIS: LeadAgentKpis = {
    total: 0,
    active: 0,
    leadsHandled: 0,
    topPerformerId: '',
    topPerformerLeads: 0,
};

type AgentRow = WsLeadAgent & { _id: string };

function getCreatedAt(row: AgentRow): Date | null {
    const v = row?.createdAt;
    if (!v) return null;
    if (v instanceof Date) return v;
    const t = Date.parse(String(v));
    return Number.isFinite(t) ? new Date(t) : null;
}

export default function LeadAgentsPage(): React.JSX.Element {
    const { toast } = useZoruToast();

    // List + KPIs
    const [rows, setRows] = React.useState<AgentRow[]>([]);
    const [kpis, setKpis] = React.useState<LeadAgentKpis>(EMPTY_KPIS);
    const [isPending, startTransition] = React.useTransition();

    // Filters
    const [search, setSearch] = React.useState('');
    const [agentFilter, setAgentFilter] = React.useState<string>('');
    const [leadFilter, setLeadFilter] = React.useState<string>('');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [currentUserId, setCurrentUserId] = React.useState<string | undefined>();
    void currentUserId;

    // Selection / pagination / dialogs
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [page, setPage] = React.useState(1);

    // Add/edit dialog state
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<AgentRow | null>(null);

    // Resolved labels for ObjectId references (lazily filled by lookupEntity).
    const [labels, setLabels] = React.useState<{
        lead: Record<string, string>;
        user: Record<string, string>;
    }>({ lead: {}, user: {} });
    const [topPerformerName, setTopPerformerName] = React.useState<string>('');

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
                getLeadAgents(),
                getLeadAgentKpis(),
            ]);
            const arr = Array.isArray(list) ? (list as AgentRow[]) : [];
            setRows(arr);
            setKpis(kpiData ?? EMPTY_KPIS);
        });
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Hydrate lead + user labels via `lookupEntity` so the table shows
    // human-readable names instead of raw ObjectIds.
    React.useEffect(() => {
        const leadIds = Array.from(
            new Set(rows.map((r) => String(r.lead_id ?? '')).filter(Boolean)),
        );
        const userIds = Array.from(
            new Set(rows.map((r) => String(r.user_id ?? '')).filter(Boolean)),
        );
        if (leadIds.length === 0 && userIds.length === 0) return;

        let cancelled = false;
        (async () => {
            const [leadRes, userRes] = await Promise.all([
                leadIds.length > 0
                    ? lookupEntity('lead', { ids: leadIds })
                    : Promise.resolve({ items: [] }),
                userIds.length > 0
                    ? lookupEntity('employee', { ids: userIds })
                    : Promise.resolve({ items: [] }),
            ]);
            if (cancelled) return;
            const leadLabels: Record<string, string> = {};
            for (const it of leadRes.items ?? []) {
                leadLabels[it.id] = it.chip?.primary ?? '';
            }
            const userLabels: Record<string, string> = {};
            for (const it of userRes.items ?? []) {
                userLabels[it.id] = it.chip?.primary ?? '';
            }
            setLabels({ lead: leadLabels, user: userLabels });
            if (kpis.topPerformerId) {
                setTopPerformerName(userLabels[kpis.topPerformerId] ?? '');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [rows, kpis.topPerformerId]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const filteredRows = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (q) {
                const leadLabel = labels.lead[String(r.lead_id ?? '')] ?? '';
                const userLabel = labels.user[String(r.user_id ?? '')] ?? '';
                const hay = `${leadLabel} ${userLabel} ${String(r.lead_id ?? '')} ${String(r.user_id ?? '')}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (agentFilter && String(r.user_id ?? '') !== agentFilter) return false;
            if (leadFilter && String(r.lead_id ?? '') !== leadFilter) return false;
            if (dateRange?.from || dateRange?.to) {
                const created = getCreatedAt(r);
                if (!created) return false;
                if (dateRange.from && created < dateRange.from) return false;
                if (dateRange.to && created > dateRange.to) return false;
            }
            return true;
        });
    }, [rows, search, agentFilter, leadFilter, dateRange, labels]);

    const totalFiltered = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / AGENTS_PER_PAGE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * AGENTS_PER_PAGE;
    const pageRows = filteredRows.slice(pageStart, pageStart + AGENTS_PER_PAGE);

    const hasActiveFilters =
        !!search ||
        !!agentFilter ||
        !!leadFilter ||
        !!dateRange?.from ||
        !!dateRange?.to;

    const clearFilters = React.useCallback(() => {
        setSearch('');
        setAgentFilter('');
        setLeadFilter('');
        setDateRange(undefined);
        setPage(1);
    }, []);

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
            setSelected(all ? new Set(pageRows.map((r) => String(r._id))) : new Set());
        },
        [pageRows],
    );

    const allOnPageSelected =
        pageRows.length > 0 && pageRows.every((r) => selected.has(String(r._id)));

    // Single-row delete
    const handleConfirmSingleDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteLeadAgent(deleteTargetId);
        if (res.success) {
            toast({ title: 'Assignment deleted' });
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(deleteTargetId);
                return next;
            });
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

    // Bulk delete
    const handleConfirmBulkDelete = React.useCallback(async () => {
        if (selected.size === 0) {
            setBulkDeleteOpen(false);
            return;
        }
        const ids = Array.from(selected);
        const res = await bulkDeleteLeadAgents(ids);
        if (res.success) {
            toast({
                title: `${res.processed} assignment${res.processed === 1 ? '' : 's'} deleted`,
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

    // Export
    const exportRows = React.useCallback(
        (format: 'csv' | 'xlsx') => {
            const out =
                selected.size > 0
                    ? filteredRows.filter((r) => selected.has(String(r._id)))
                    : filteredRows;
            const header = ['Lead', 'LeadId', 'Agent', 'AgentId', 'CreatedAt'];
            const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const lines = [
                header.join(','),
                ...out.map((r) =>
                    [
                        escape(labels.lead[String(r.lead_id ?? '')] ?? ''),
                        escape(String(r.lead_id ?? '')),
                        escape(labels.user[String(r.user_id ?? '')] ?? ''),
                        escape(String(r.user_id ?? '')),
                        escape(
                            getCreatedAt(r)
                                ? (getCreatedAt(r) as Date).toISOString()
                                : '',
                        ),
                    ].join(','),
                ),
            ];
            const body = lines.join('\n');
            const mime =
                format === 'csv'
                    ? 'text/csv;charset=utf-8;'
                    : 'application/vnd.ms-excel;charset=utf-8;';
            const blob = new Blob([body], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lead-agents-${new Date().toISOString().slice(0, 10)}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
        },
        [filteredRows, labels, selected],
    );

    const handleOpenCreate = React.useCallback(() => {
        setEditing(null);
        setDialogOpen(true);
    }, []);
    const handleOpenEdit = React.useCallback((row: AgentRow) => {
        setEditing(row);
        setDialogOpen(true);
    }, []);

    const handleDialogClose = React.useCallback(
        (saved: boolean) => {
            setDialogOpen(false);
            setEditing(null);
            if (saved) fetchData();
        },
        [fetchData],
    );

    return (
        <>
            <EntityListShell
                title="Lead Agents"
                subtitle="Employees assigned to specific leads as the primary sales contact."
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search by lead or agent…',
                }}
                primaryAction={
                    <ZoruButton onClick={handleOpenCreate}>
                        <Plus className="h-4 w-4" /> Assign Agent
                    </ZoruButton>
                }
                filters={
                    <AgentsFiltersRow
                        agentFilter={agentFilter}
                        onAgentChange={(v) => {
                            setAgentFilter(v);
                            setPage(1);
                        }}
                        leadFilter={leadFilter}
                        onLeadChange={(v) => {
                            setLeadFilter(v);
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
                        <AgentsBulkBar
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
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
                                <UserCog className="h-6 w-6 text-zoru-ink-muted" strokeWidth={1.75} />
                            </div>
                            <h3 className="text-base font-medium text-zoru-ink">
                                {hasActiveFilters
                                    ? 'No agent assignments match your filters'
                                    : 'No agent assignments yet'}
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                {hasActiveFilters
                                    ? 'Try clearing your filters or assigning a new agent.'
                                    : 'Assign an employee to a lead to give them ownership of the sales conversation.'}
                            </p>
                            <ZoruButton onClick={handleOpenCreate}>
                                <Plus className="h-4 w-4" /> Assign your first agent
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isPending && rows.length === 0}
                pagination={
                    totalFiltered > 0 ? (
                        <PaginationBar
                            page={safePage}
                            limit={AGENTS_PER_PAGE}
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
                        <ZoruStatCard
                            label="Total agents"
                            value={kpis.total.toLocaleString()}
                            icon={<UserCog />}
                            period="all assignments"
                        />
                        <ZoruStatCard
                            label="Active"
                            value={kpis.active.toLocaleString()}
                            icon={<UserCheck />}
                            period="distinct employees"
                        />
                        <ZoruStatCard
                            label="Leads handled"
                            value={kpis.leadsHandled.toLocaleString()}
                            icon={<Users />}
                            period="distinct leads"
                        />
                        <ZoruStatCard
                            label="Top performer"
                            value={
                                topPerformerName ||
                                (kpis.topPerformerId
                                    ? labels.user[kpis.topPerformerId] || '—'
                                    : '—')
                            }
                            icon={<Trophy />}
                            period={
                                kpis.topPerformerLeads > 0
                                    ? `${kpis.topPerformerLeads} lead${kpis.topPerformerLeads === 1 ? '' : 's'}`
                                    : 'no assignments yet'
                            }
                        />
                    </div>

                    {pageRows.length > 0 ? (
                        <AgentsTable
                            rows={pageRows}
                            labels={labels}
                            selectedIds={selected}
                            allSelected={allOnPageSelected}
                            onToggleOne={handleToggleOne}
                            onToggleAll={handleToggleAll}
                            onEdit={handleOpenEdit}
                            onDelete={(id) => setDeleteTargetId(id)}
                        />
                    ) : null}
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this assignment?"
                description="This removes the agent ↔ lead link. The lead and the employee both remain. This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={handleConfirmSingleDelete}
            />

            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Delete ${selected.size} assignment${selected.size === 1 ? '' : 's'}?`}
                description="This removes the selected agent ↔ lead links. The underlying leads and employees remain. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmBulkDelete}
            />

            <AgentDialog
                open={dialogOpen}
                editing={editing}
                onClose={handleDialogClose}
            />
        </>
    );
}

/* ─── Filters row ─────────────────────────────────────────────────────── */

interface AgentsFiltersRowProps {
    agentFilter: string;
    onAgentChange: (v: string) => void;
    leadFilter: string;
    onLeadChange: (v: string) => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

function AgentsFiltersRow(props: AgentsFiltersRowProps): React.JSX.Element {
    return (
        <ZoruCard>
            <ZoruCardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-4">
                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Agent
                    </ZoruLabel>
                    <EntityFormField
                        entity="employee"
                        name="agentFilter"
                        initialId={props.agentFilter || null}
                        placeholder="Any agent"
                        onChange={(next) => props.onAgentChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Lead
                    </ZoruLabel>
                    <EntityFormField
                        entity="lead"
                        name="leadFilter"
                        initialId={props.leadFilter || null}
                        placeholder="Any lead"
                        onChange={(next) => props.onLeadChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1 md:col-span-1 lg:col-span-2">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Assigned
                    </ZoruLabel>
                    <ZoruDateRangePicker
                        value={props.dateRange}
                        onChange={props.onDateRangeChange}
                    />
                </div>

                {props.hasActiveFilters ? (
                    <div className="flex items-end md:col-span-3 lg:col-span-4">
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={props.onClear}
                        >
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </ZoruButton>
                    </div>
                ) : null}
            </ZoruCardContent>
        </ZoruCard>
    );
}

/* ─── Bulk action bar ─────────────────────────────────────────────────── */

interface AgentsBulkBarProps {
    count: number;
    onClear: () => void;
    onDelete: () => void;
    onExportCsv: () => void;
    onExportXlsx: () => void;
}

function AgentsBulkBar(props: AgentsBulkBarProps): React.JSX.Element {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zoru-ink">
                {props.count} selected
            </span>
            <span className="flex-1" />
            <ZoruDropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                    <ZoruButton size="sm" variant="outline">
                        <Download className="h-3.5 w-3.5" /> Export
                    </ZoruButton>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                    <ZoruDropdownMenuItem onClick={props.onExportCsv}>
                        Export as CSV
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem onClick={props.onExportXlsx}>
                        Export as XLSX
                    </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
            <ZoruButton size="sm" variant="destructive" onClick={props.onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </ZoruButton>
            <ZoruButton size="sm" variant="ghost" onClick={props.onClear}>
                Clear
            </ZoruButton>
        </div>
    );
}

/* ─── Table ───────────────────────────────────────────────────────────── */

interface AgentsTableProps {
    rows: AgentRow[];
    labels: { lead: Record<string, string>; user: Record<string, string> };
    selectedIds: Set<string>;
    allSelected: boolean;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onEdit: (row: AgentRow) => void;
    onDelete: (id: string) => void;
}

function AgentsTable(props: AgentsTableProps): React.JSX.Element {
    return (
        <ZoruCard className="overflow-hidden">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow>
                        <ZoruTableHead className="w-10">
                            <ZoruCheckbox
                                aria-label="Select all on this page"
                                checked={props.allSelected}
                                onCheckedChange={(c) => props.onToggleAll(c === true)}
                            />
                        </ZoruTableHead>
                        <ZoruTableHead>Lead</ZoruTableHead>
                        <ZoruTableHead>Agent</ZoruTableHead>
                        <ZoruTableHead>Assigned</ZoruTableHead>
                        <ZoruTableHead className="w-32 text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {props.rows.map((r) => {
                        const id = String(r._id);
                        const leadId = String(r.lead_id ?? '');
                        const userId = String(r.user_id ?? '');
                        const leadLabel = props.labels.lead[leadId] || leadId || '—';
                        const userLabel = props.labels.user[userId] || userId || '—';
                        const created = getCreatedAt(r);
                        const isSelected = props.selectedIds.has(id);
                        return (
                            <ZoruTableRow
                                key={id}
                                data-state={isSelected ? 'selected' : undefined}
                            >
                                <ZoruTableCell>
                                    <ZoruCheckbox
                                        aria-label={`Select assignment ${id}`}
                                        checked={isSelected}
                                        onCheckedChange={() => props.onToggleOne(id)}
                                    />
                                </ZoruTableCell>
                                <ZoruTableCell>
                                    {leadId ? (
                                        <EntityRowLink
                                            href={`/dashboard/crm/sales-crm/all-leads/${leadId}`}
                                            label={leadLabel}
                                            subtitle={leadId !== leadLabel ? leadId : undefined}
                                        />
                                    ) : (
                                        <span className="text-zoru-ink-muted">—</span>
                                    )}
                                </ZoruTableCell>
                                <ZoruTableCell>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-sm font-medium text-zoru-ink">
                                            {userLabel}
                                        </span>
                                        {userId && userId !== userLabel ? (
                                            <ZoruBadge variant="ghost">{userId}</ZoruBadge>
                                        ) : null}
                                    </div>
                                </ZoruTableCell>
                                <ZoruTableCell>
                                    <span className="text-[12.5px] text-zoru-ink-muted">
                                        {created ? created.toLocaleDateString() : '—'}
                                    </span>
                                </ZoruTableCell>
                                <ZoruTableCell className="text-right">
                                    <div className="inline-flex items-center gap-1">
                                        <ZoruButton
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => props.onEdit(r)}
                                            aria-label="Edit assignment"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </ZoruButton>
                                        <ZoruButton
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => props.onDelete(id)}
                                            aria-label="Delete assignment"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </ZoruButton>
                                    </div>
                                </ZoruTableCell>
                            </ZoruTableRow>
                        );
                    })}
                </ZoruTableBody>
            </ZoruTable>
        </ZoruCard>
    );
}

/* ─── Save dialog (lead + agent picker) ──────────────────────────────── */

interface AgentDialogProps {
    open: boolean;
    editing: AgentRow | null;
    onClose: (saved: boolean) => void;
}

function AgentDialog({ open, editing, onClose }: AgentDialogProps): React.JSX.Element {
    const { toast } = useZoruToast();
    const [leadId, setLeadId] = React.useState<string>('');
    const [userId, setUserId] = React.useState<string>('');
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        setLeadId(editing?.lead_id ? String(editing.lead_id) : '');
        setUserId(editing?.user_id ? String(editing.user_id) : '');
        setIsSaving(false);
    }, [open, editing]);

    const handleSave = React.useCallback(async () => {
        if (!leadId || !userId) {
            toast({
                title: 'Missing fields',
                description: 'Pick both a lead and an agent.',
                variant: 'destructive',
            });
            return;
        }
        setIsSaving(true);
        const fd = new FormData();
        if (editing?._id) fd.set('_id', String(editing._id));
        fd.set('lead_id', leadId);
        fd.set('user_id', userId);
        const res = await saveLeadAgent(null, fd);
        setIsSaving(false);
        if (res?.error) {
            toast({
                title: 'Save failed',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        toast({ title: editing ? 'Assignment updated' : 'Agent assigned' });
        onClose(true);
    }, [editing, leadId, userId, onClose, toast]);

    return (
        <ZoruDialog open={open} onOpenChange={(o) => !o && onClose(false)}>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>
                        {editing ? 'Edit assignment' : 'Assign agent to lead'}
                    </ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Link an employee to a lead as the primary sales contact. Both fields are
                        required.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="flex flex-col gap-3 py-2">
                    <div className="space-y-1">
                        <ZoruLabel>Lead</ZoruLabel>
                        <EntityFormField
                            entity="lead"
                            name="lead_id"
                            initialId={leadId || null}
                            allowCreate
                            placeholder="Select or create a lead…"
                            onChange={(next) => setLeadId(next ?? '')}
                        />
                    </div>
                    <div className="space-y-1">
                        <ZoruLabel>Agent</ZoruLabel>
                        <EntityFormField
                            entity="employee"
                            name="user_id"
                            initialId={userId || null}
                            allowCreate
                            placeholder="Select or create an employee…"
                            onChange={(next) => setUserId(next ?? '')}
                        />
                    </div>
                </div>
                <ZoruDialogFooter>
                    <ZoruButton
                        type="button"
                        variant="ghost"
                        onClick={() => onClose(false)}
                        disabled={isSaving}
                    >
                        Cancel
                    </ZoruButton>
                    <ZoruButton type="button" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save'}
                    </ZoruButton>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
