'use client';

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import {
    Download,
    MoreHorizontal,
    Pause,
    Play,
    Plus,
    Trash2,
    Workflow,
    X,
} from 'lucide-react';

import { Badge, Button, Card, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';

import {
    bulkAutomationAction,
    deleteCrmAutomation,
    getCrmAutomationKpis,
    listCrmAutomations,
    type CrmAutomationKpis,
    type CrmAutomationListItem,
    type CrmAutomationStatusFilter,
} from '@/app/actions/crm-automations.actions';

const AUTOMATIONS_PER_PAGE = 20;

const EMPTY_KPIS: CrmAutomationKpis = {
    total: 0,
    active: 0,
    paused: 0,
    executionsToday: 0,
};

type TriggerFilter =
    | 'all'
    | 'lead-created'
    | 'stage-change'
    | 'time-based'
    | 'form-submit'
    | 'manual'
    | 'other';

const KNOWN_TRIGGERS: Array<{ value: TriggerFilter; label: string }> = [
    { value: 'all', label: 'All triggers' },
    { value: 'lead-created', label: 'Lead created' },
    { value: 'stage-change', label: 'Stage change' },
    { value: 'time-based', label: 'Time based' },
    { value: 'form-submit', label: 'Form submit' },
    { value: 'manual', label: 'Manual' },
];

function formatTrigger(trigger?: string): string {
    if (!trigger) return '—';
    return trigger
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function formatDate(value: string | Date | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
}

export default function AutomationsPage() {
    const { toast } = useToast();

    // List + KPIs
    const [items, setItems] = React.useState<CrmAutomationListItem[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [isPending, startTransition] = React.useTransition();
    const [kpis, setKpis] = React.useState<CrmAutomationKpis>(EMPTY_KPIS);

    // Filters
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] =
        React.useState<CrmAutomationStatusFilter>('all');
    const [triggerFilter, setTriggerFilter] = React.useState<TriggerFilter>('all');

    // Selection + dialogs
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkConfirm, setBulkConfirm] = React.useState<'delete' | null>(null);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ items: rows, total: count }, kpiData] = await Promise.all([
                listCrmAutomations(page, AUTOMATIONS_PER_PAGE, search, {
                    status: statusFilter,
                    trigger:
                        triggerFilter === 'all' || triggerFilter === 'other'
                            ? undefined
                            : triggerFilter,
                }),
                getCrmAutomationKpis(),
            ]);
            setItems(rows);
            setTotal(count);
            setKpis(kpiData ?? EMPTY_KPIS);
        });
    }, [page, search, statusFilter, triggerFilter]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const hasActiveFilters =
        statusFilter !== 'all' || triggerFilter !== 'all' || !!search;

    const clearFilters = React.useCallback(() => {
        setStatusFilter('all');
        setTriggerFilter('all');
        setSearch('');
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
            setSelected(all ? new Set(items.map((i) => String(i._id))) : new Set());
        },
        [items],
    );

    const deleteTarget = React.useMemo(
        () => items.find((i) => String(i._id) === deleteTargetId) ?? null,
        [items, deleteTargetId],
    );

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteCrmAutomation(deleteTargetId);
        if (res.message) {
            toast({ title: res.message });
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

    const runBulk = React.useCallback(
        async (op: 'delete' | 'activate' | 'pause') => {
            if (selected.size === 0) return;
            const res = await bulkAutomationAction(Array.from(selected), op);
            if (res.success) {
                toast({
                    title: `${res.processed ?? 0} automation${
                        res.processed === 1 ? '' : 's'
                    } ${op === 'delete' ? 'deleted' : op === 'activate' ? 'activated' : 'paused'}`,
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
            setBulkConfirm(null);
        },
        [selected, fetchData, toast],
    );

    const exportRows = React.useCallback(
        async (format: 'csv' | 'xlsx') => {
            const rows =
                selected.size > 0
                    ? items.filter((i) => selected.has(String(i._id)))
                    : items;
            if (rows.length === 0) {
                toast({ title: 'Nothing to export' });
                return;
            }
            const header = [
                'Name',
                'Trigger',
                'Actions',
                'Conditions',
                'Active',
                'Runs',
                'Last Run',
                'Created At',
            ];
            const data = rows.map((r) => [
                r.name ?? '',
                formatTrigger(r.trigger),
                Number(r.actionsCount ?? 0),
                Number(r.conditionsCount ?? 0),
                r.isActive ? 'Yes' : 'No',
                Number(r.runCount ?? 0),
                r.lastRunAt ? new Date(r.lastRunAt).toISOString() : '',
                r.createdAt ? new Date(r.createdAt).toISOString() : '',
            ]);
            const date = new Date().toISOString().slice(0, 10);
            const filename = `automations-${date}.${format}`;
            if (format === 'csv') {
                const esc = (v: unknown) =>
                    `"${String(v ?? '').replace(/"/g, '""')}"`;
                const csv = [
                    header.join(','),
                    ...data.map((r) => r.map(esc).join(',')),
                ].join('\n');
                triggerDownload(
                    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
                    filename,
                );
                return;
            }
            try {
                const ExcelJS = (await import('exceljs')).default;
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Automations');
                [header, ...data].forEach((row) => worksheet.addRow(row));
                const buf = await workbook.xlsx.writeBuffer();
                triggerDownload(
                    new Blob([buf], {
                        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    }),
                    filename,
                );
            } catch {
                toast({
                    title: 'Export failed',
                    description: 'Could not generate XLSX file.',
                    variant: 'destructive',
                });
            }
        },
        [items, selected, toast],
    );

    const totalPages = Math.max(1, Math.ceil(total / AUTOMATIONS_PER_PAGE));
    const allSelectedOnPage =
        items.length > 0 && items.every((i) => selected.has(String(i._id)));

    return (
        <>
            <EntityListShell
                title="Automations"
                subtitle="Trigger-based rules that send emails, create tasks and update records automatically."
                search={{
                    value: search,
                    onChange: handleSearch,
                    placeholder: 'Search by name…',
                }}
                primaryAction={
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Download className="h-4 w-4" /> Export
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => exportRows('csv')}>
                                    Export as CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => exportRows('xlsx')}>
                                    Export as XLSX
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button asChild>
                            <Link href="/dashboard/crm/sales-crm/automations/new">
                                <Plus className="h-4 w-4" /> New automation
                            </Link>
                        </Button>
                    </div>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <Select
                            value={statusFilter}
                            onValueChange={(v) => {
                                setStatusFilter(v as CrmAutomationStatusFilter);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All status</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={triggerFilter}
                            onValueChange={(v) => {
                                setTriggerFilter(v as TriggerFilter);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Trigger" />
                            </SelectTrigger>
                            <SelectContent>
                                {KNOWN_TRIGGERS.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {hasActiveFilters ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                            >
                                <X className="h-4 w-4" /> Clear
                            </Button>
                        ) : null}
                    </div>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-[13px] text-[var(--st-text)]">
                                <span className="font-medium">{selected.size}</span> selected
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => runBulk('activate')}
                                >
                                    <Play className="h-4 w-4" /> Activate
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => runBulk('pause')}
                                >
                                    <Pause className="h-4 w-4" /> Pause
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportRows('csv')}
                                >
                                    <Download className="h-4 w-4" /> Export CSV
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportRows('xlsx')}
                                >
                                    <Download className="h-4 w-4" /> Export XLSX
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setBulkConfirm('delete')}
                                >
                                    <Trash2 className="h-4 w-4" /> Delete
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelected(new Set())}
                                >
                                    <X className="h-4 w-4" /> Clear
                                </Button>
                            </div>
                        </div>
                    ) : null
                }
                empty={
                    !isPending && items.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Workflow className="h-8 w-8 text-[var(--st-text-secondary)]" />
                            <h3 className="text-base font-medium text-[var(--st-text)]">
                                No automations yet
                            </h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                {hasActiveFilters
                                    ? 'No automations match the current filters.'
                                    : 'Create rules to automate follow-ups, task creation and field updates.'}
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/sales-crm/automations/new">
                                    <Plus className="h-4 w-4" /> New automation
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={isPending && items.length === 0}
                pagination={
                    items.length > 0 ? (
                        <PaginationBar
                            page={page}
                            limit={AUTOMATIONS_PER_PAGE}
                            hasMore={page < totalPages}
                            total={total}
                            controlled={{ onChange: (next) => setPage(next.page) }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            label="Total"
                            value={kpis.total.toLocaleString()}
                            icon={<Workflow />}
                        />
                        <StatCard
                            label="Active"
                            value={kpis.active.toLocaleString()}
                        />
                        <StatCard
                            label="Paused"
                            value={kpis.paused.toLocaleString()}
                        />
                        <StatCard
                            label="Executions today"
                            value={kpis.executionsToday.toLocaleString()}
                        />
                    </div>

                    {/* Table */}
                    <Card className="p-0">
                        <div className="overflow-x-auto rounded-lg">
                            <Table>
                                <THead>
                                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                        <Th className="w-10">
                                            <Checkbox
                                                checked={allSelectedOnPage}
                                                onCheckedChange={(c) =>
                                                    handleToggleAll(Boolean(c))
                                                }
                                                aria-label="Select all"
                                            />
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Name
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Trigger
                                        </Th>
                                        <Th className="text-right text-[var(--st-text-secondary)]">
                                            Actions
                                        </Th>
                                        <Th className="text-right text-[var(--st-text-secondary)]">
                                            Conditions
                                        </Th>
                                        <Th className="text-right text-[var(--st-text-secondary)]">
                                            Runs
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Last run
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Status
                                        </Th>
                                        <Th className="w-10" />
                                    </Tr>
                                </THead>
                                <TBody>
                                    {items.map((a) => {
                                        const id = String(a._id);
                                        const isActive = Boolean(a.isActive);
                                        return (
                                            <Tr
                                                key={id}
                                                className="border-[var(--st-border)]"
                                                data-state={
                                                    selected.has(id) ? 'selected' : undefined
                                                }
                                            >
                                                <Td>
                                                    <Checkbox
                                                        checked={selected.has(id)}
                                                        onCheckedChange={() =>
                                                            handleToggleOne(id)
                                                        }
                                                        aria-label={`Select ${a.name}`}
                                                    />
                                                </Td>
                                                <Td>
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/sales-crm/automations/${id}`}
                                                        label={a.name || 'Untitled automation'}
                                                    />
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {formatTrigger(a.trigger)}
                                                </Td>
                                                <Td className="text-right text-[var(--st-text)]">
                                                    {Number(a.actionsCount ?? 0)}
                                                </Td>
                                                <Td className="text-right text-[var(--st-text)]">
                                                    {Number(a.conditionsCount ?? 0)}
                                                </Td>
                                                <Td className="text-right text-[var(--st-text)]">
                                                    {Number(a.runCount ?? 0)}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {formatDate(a.lastRunAt)}
                                                </Td>
                                                <Td>
                                                    {isActive ? (
                                                        <Badge variant="success">
                                                            Active
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="ghost">
                                                            Paused
                                                        </Badge>
                                                    )}
                                                </Td>
                                                <Td>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                aria-label="Row actions"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem asChild>
                                                                <Link
                                                                    href={`/dashboard/crm/sales-crm/automations/${id}`}
                                                                >
                                                                    Edit
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onSelect={() =>
                                                                    setDeleteTargetId(id)
                                                                }
                                                                className="text-[var(--st-danger)]"
                                                            >
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </Td>
                                            </Tr>
                                        );
                                    })}
                                </TBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this automation?"
                description={`"${deleteTarget?.name ?? 'This automation'}" will be permanently removed.`}
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />
            <ConfirmDialog
                open={bulkConfirm === 'delete'}
                onOpenChange={(o) => !o && setBulkConfirm(null)}
                title={`Delete ${selected.size} automation${selected.size === 1 ? '' : 's'}?`}
                description="These automations will be permanently removed. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={() => runBulk('delete')}
            />
        </>
    );
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
