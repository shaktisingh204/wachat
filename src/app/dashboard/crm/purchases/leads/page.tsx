'use client';

import * as React from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import type { WithId } from 'mongodb';
import type { DateRange } from 'react-day-picker';
import { useDebouncedCallback } from 'use-debounce';
import { Plus, Target, Upload } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    Checkbox,
    Dialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';

import { SabFileToFileButton } from '@/components/sabfiles';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityRowLink } from '@/components/crm/entity-row-link';

import {
    addCrmLead,
    archiveCrmLead,
    bulkLeadAction,
    deleteCrmLead,
    getCrmLeadKpis,
    getCrmLeads,
    type CrmLeadKpis,
    type CrmLeadListFilters,
} from '@/app/actions/crm-leads.actions';
import { getInvitedUsers } from '@/app/actions/team.actions';
import type { CrmLead } from '@/lib/definitions';

import {
    PurchaseLeadsKpiStrip,
    type PurchaseLeadsKpiFilter,
} from './_components/purchase-leads-kpi-strip';
import {
    PurchaseLeadsFiltersRow,
    type OwnerOption,
    type SourceOption,
} from './_components/purchase-leads-filters';
import { PurchaseLeadsBulkBar } from './_components/purchase-leads-bulk-bar';

/**
 * Purchases · Vendor Leads — list page rebuilt with the Deep template
 * (ref: `sales-crm/all-leads/page.tsx`).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards) — total · qualified · won · conversion rate
 *     • Filter row — status · owner · source · created date range
 *     • Bulk action bar (status, archive, delete, export)
 *     • Leads table with EntityRowLink on the primary cell
 *     • Pagination
 *     • CSV import dialog (preserved from previous implementation)
 *
 * Data lives in `crm_leads`. Multi-tenant via `getSession()` inside each
 * server action.
 */

const LEADS_PER_PAGE = 20;

const EMPTY_KPIS: CrmLeadKpis = {
    total: 0,
    newCount: 0,
    qualifiedCount: 0,
    wonCount: 0,
    archivedCount: 0,
    conversionRate: 0,
};

type RowResult = { row: number; ok: boolean; error?: string };

export default function VendorLeadsPage() {
    const { toast } = useZoruToast();

    /* ─── Data state ─────────────────────────────────────────────── */
    const [leads, setLeads] = React.useState<WithId<CrmLead>[]>([]);
    const [total, setTotal] = React.useState(0);
    const [kpis, setKpis] = React.useState<CrmLeadKpis>(EMPTY_KPIS);
    const [ownerOptions, setOwnerOptions] = React.useState<OwnerOption[]>([]);
    const [isPending, startTransition] = React.useTransition();

    /* ─── Filters ────────────────────────────────────────────────── */
    const [search, setSearch] = React.useState('');
    const [searchDraft, setSearchDraft] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
    const [ownerFilter, setOwnerFilter] = React.useState('');
    const [sourceFilter, setSourceFilter] = React.useState('');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

    /* ─── Pagination + selection ─────────────────────────────────── */
    const [page, setPage] = React.useState(1);
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    /* ─── Confirmations ──────────────────────────────────────────── */
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    /* ─── CSV import dialog ──────────────────────────────────────── */
    const [importOpen, setImportOpen] = React.useState(false);
    const [importBusy, setImportBusy] = React.useState(false);
    const [importResults, setImportResults] = React.useState<RowResult[]>([]);

    /* ─── Derived filter object for server action ────────────────── */
    const filters: CrmLeadListFilters = React.useMemo(() => {
        const f: CrmLeadListFilters = {};
        const statusKey = statusFilter.toLowerCase();
        if (statusKey !== 'all') {
            // crm_leads.status uses Pascal-case display values for active
            // leads, but `archived` is lower-case. Map accordingly.
            if (statusKey === 'archived') {
                f.status = 'archived';
                f.includeArchived = true;
            } else {
                f.status = statusKey.charAt(0).toUpperCase() + statusKey.slice(1);
            }
        }
        if (sourceFilter) f.source = sourceFilter;
        if (ownerFilter) f.assignedTo = ownerFilter;
        if (dateRange?.from) f.createdAfter = dateRange.from;
        if (dateRange?.to) f.createdBefore = dateRange.to;
        return f;
    }, [statusFilter, sourceFilter, ownerFilter, dateRange]);

    /* ─── Fetch ──────────────────────────────────────────────────── */
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

    React.useEffect(() => {
        let cancelled = false;
        getInvitedUsers().then((users) => {
            if (cancelled) return;
            setOwnerOptions(
                users.map((u) => ({
                    value: String(u._id),
                    label: u.name || u.email || 'Unnamed user',
                })),
            );
        });
        return () => {
            cancelled = true;
        };
    }, []);

    /* ─── Derived: source options from loaded leads ──────────────── */
    const sourceOptions = React.useMemo<SourceOption[]>(() => {
        const seen = new Map<string, string>();
        for (const lead of leads) {
            const src = (lead.source ?? '').trim();
            if (src && !seen.has(src.toLowerCase())) {
                seen.set(src.toLowerCase(), src);
            }
        }
        return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
    }, [leads]);

    /* ─── Filter helpers ─────────────────────────────────────────── */
    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const hasActiveFilters =
        statusFilter !== 'all' ||
        !!ownerFilter ||
        !!sourceFilter ||
        !!dateRange?.from ||
        !!dateRange?.to;

    const clearFilters = React.useCallback(() => {
        setStatusFilter('all');
        setOwnerFilter('');
        setSourceFilter('');
        setDateRange(undefined);
        setSearchDraft('');
        setSearch('');
        setPage(1);
    }, []);

    const handlePickStatus = React.useCallback((next: PurchaseLeadsKpiFilter) => {
        setStatusFilter((prev) => (prev === next ? 'all' : next));
        setPage(1);
    }, []);

    // The KPI strip filter type is narrower than the filters row — derive a
    // matching key for the strip from the broader `statusFilter`.
    const kpiActiveFilter: PurchaseLeadsKpiFilter = React.useMemo(() => {
        if (statusFilter === 'qualified') return 'qualified';
        if (statusFilter === 'won') return 'won';
        return 'all';
    }, [statusFilter]);

    /* ─── Selection ──────────────────────────────────────────────── */
    const handleToggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const allChecked = leads.length > 0 && leads.every((l) => selected.has(String(l._id)));
    const someChecked = !allChecked && leads.some((l) => selected.has(String(l._id)));

    const handleToggleAll = React.useCallback(
        (all: boolean) => {
            setSelected((prev) => {
                const next = new Set(prev);
                if (all) {
                    for (const l of leads) next.add(String(l._id));
                } else {
                    for (const l of leads) next.delete(String(l._id));
                }
                return next;
            });
        },
        [leads],
    );

    /* ─── Single delete ──────────────────────────────────────────── */
    const deleteTarget = React.useMemo(
        () => leads.find((l) => String(l._id) === deleteTargetId) ?? null,
        [leads, deleteTargetId],
    );

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteCrmLead(deleteTargetId);
        if (res.success) {
            toast({ title: 'Lead deleted' });
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

    /* ─── Single archive (row-level) ─────────────────────────────── */
    const handleArchiveOne = React.useCallback(
        async (id: string) => {
            const res = await archiveCrmLead(id);
            if (res.success) {
                toast({ title: 'Lead archived' });
                fetchData();
            } else {
                toast({
                    title: 'Archive failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [fetchData, toast],
    );

    /* ─── Bulk actions ───────────────────────────────────────────── */
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

    const handleConfirmBulkDelete = React.useCallback(async () => {
        await runBulk('delete');
        setBulkDeleteOpen(false);
    }, [runBulk]);

    /* ─── Export ─────────────────────────────────────────────────── */
    const exportRows = React.useMemo(() => {
        if (selected.size > 0) {
            return leads.filter((l) => selected.has(String(l._id)));
        }
        return leads;
    }, [leads, selected]);

    const exportCsv = React.useCallback(() => {
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
        const escape = (val: unknown) =>
            `"${String(val ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...exportRows.map((l) =>
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
        downloadBlob(
            csv,
            'text/csv;charset=utf-8;',
            `vendor-leads-${todaySlug()}.csv`,
        );
    }, [exportRows]);

    const exportXlsx = React.useCallback(() => {
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
        const xmlEscape = (val: unknown) =>
            String(val ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        const rows = exportRows
            .map((l) =>
                `<Row>${[
                    l.title,
                    l.contactName,
                    l.email,
                    l.phone,
                    l.company,
                    l.source,
                    l.status,
                    l.stage,
                    l.value ?? 0,
                    l.currency || 'INR',
                    l.createdAt ? new Date(l.createdAt).toISOString() : '',
                ]
                    .map((c) => `<Cell><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`)
                    .join('')}</Row>`,
            )
            .join('');
        const headerXml = `<Row>${header
            .map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
            .join('')}</Row>`;
        const xml =
            `<?xml version="1.0"?>` +
            `<?mso-application progid="Excel.Sheet"?>` +
            `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
            `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
            `<Worksheet ss:Name="VendorLeads"><Table>${headerXml}${rows}</Table></Worksheet>` +
            `</Workbook>`;
        downloadBlob(
            xml,
            'application/vnd.ms-excel;charset=utf-8;',
            `vendor-leads-${todaySlug()}.xls`,
        );
    }, [exportRows]);

    /* ─── CSV import (preserved from prior page) ─────────────────── */
    const importCsv = React.useCallback(
        async (file: File) => {
            setImportBusy(true);
            setImportResults([]);
            const text = await file.text();
            const parsed = Papa.parse<Record<string, string>>(text, {
                header: true,
                skipEmptyLines: true,
            });
            if (parsed.errors.length) {
                toast({
                    title: 'CSV parse failed',
                    description: parsed.errors[0]?.message ?? 'Could not parse file.',
                });
                setImportBusy(false);
                return;
            }
            const rows = parsed.data;
            const out: RowResult[] = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const fd = new FormData();
                for (const [k, v] of Object.entries(row)) {
                    if (v != null) fd.set(k, String(v));
                }
                try {
                    const res = await addCrmLead(null, fd);
                    out.push({ row: i + 2, ok: !res.error, error: res.error });
                } catch (e) {
                    out.push({
                        row: i + 2,
                        ok: false,
                        error: e instanceof Error ? e.message : 'Unknown error',
                    });
                }
                setImportResults([...out]);
            }
            setImportBusy(false);
            const okCount = out.filter((r) => r.ok).length;
            toast({
                title: 'Import complete',
                description: `${okCount} of ${rows.length} leads imported.`,
            });
            fetchData();
        },
        [fetchData, toast],
    );

    /* ─── Pagination derived ─────────────────────────────────────── */
    const totalPages = Math.max(1, Math.ceil(total / LEADS_PER_PAGE));

    /* ─── Render ─────────────────────────────────────────────────── */
    return (
        <>
            <EntityListShell
                title="Vendor Leads"
                subtitle="Manage potential vendors and suppliers — track leads, assign owners, and convert them to vendors."
                search={{
                    value: searchDraft,
                    onChange: (next) => {
                        setSearchDraft(next);
                        handleSearch(next);
                    },
                    placeholder: 'Search title, contact, email, company…',
                }}
                primaryAction={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setImportOpen(true)}
                        >
                            <Upload className="h-4 w-4" /> Import CSV
                        </Button>
                        <Button asChild>
                            <Link href="/dashboard/crm/purchases/vendors/new">
                                <Plus className="h-4 w-4" /> New Vendor Lead
                            </Link>
                        </Button>
                    </div>
                }
                filters={
                    <PurchaseLeadsFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(String(v));
                            setPage(1);
                        }}
                        ownerFilter={ownerFilter}
                        onOwnerChange={(v) => {
                            setOwnerFilter(v);
                            setPage(1);
                        }}
                        ownerOptions={ownerOptions}
                        sourceFilter={sourceFilter}
                        onSourceChange={(v) => {
                            setSourceFilter(v);
                            setPage(1);
                        }}
                        sourceOptions={sourceOptions}
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
                        <PurchaseLeadsBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onArchive={() => runBulk('archive')}
                            onDelete={() => setBulkDeleteOpen(true)}
                            onStatusChange={(s) => runBulk('status', s)}
                            onExportCsv={exportCsv}
                            onExportXlsx={exportXlsx}
                        />
                    ) : null
                }
                empty={
                    !isPending && leads.length === 0 && !hasActiveFilters && !search ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Target className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No vendor leads yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Track potential suppliers in your pipeline. Capture them via
                                form, import a CSV, or add manually below.
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button asChild>
                                    <Link href="/dashboard/crm/purchases/vendors/new">
                                        <Plus className="h-4 w-4" /> Add your first lead
                                    </Link>
                                </Button>
                                <Button variant="outline" onClick={() => setImportOpen(true)}>
                                    <Upload className="h-4 w-4" /> Import CSV
                                </Button>
                            </div>
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
                    <PurchaseLeadsKpiStrip
                        kpis={kpis}
                        statusFilter={kpiActiveFilter}
                        onClearAll={clearFilters}
                        onPickStatus={handlePickStatus}
                    />

                    <Card>
                        <h2 className="text-[16px] font-semibold text-foreground">
                            All Vendor Leads
                            {total > 0 ? (
                                <Badge variant="secondary" className="ml-2">
                                    {total.toLocaleString()} total
                                </Badge>
                            ) : null}
                        </h2>
                        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-border hover:bg-transparent">
                                        <ZoruTableHead className="w-10 text-muted-foreground">
                                            <Checkbox
                                                aria-label="Select all on page"
                                                checked={
                                                    allChecked ? true : someChecked ? 'indeterminate' : false
                                                }
                                                onCheckedChange={(c) =>
                                                    handleToggleAll(c === true)
                                                }
                                            />
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">
                                            Title
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">
                                            Contact
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">
                                            Company
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">
                                            Status
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">
                                            Source
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-right text-muted-foreground">
                                            Actions
                                        </ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {leads.length > 0 ? (
                                        leads.map((lead) => {
                                            const id = String(lead._id);
                                            const isSel = selected.has(id);
                                            return (
                                                <ZoruTableRow
                                                    key={id}
                                                    className="border-border"
                                                    data-state={isSel ? 'selected' : undefined}
                                                >
                                                    <ZoruTableCell>
                                                        <Checkbox
                                                            aria-label={`Select ${lead.title || lead.contactName}`}
                                                            checked={isSel}
                                                            onCheckedChange={() => handleToggleOne(id)}
                                                        />
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="font-medium text-foreground">
                                                        <EntityRowLink
                                                            href={`/dashboard/crm/sales-crm/all-leads/${id}`}
                                                            label={lead.title || lead.contactName || 'Untitled lead'}
                                                            subtitle={lead.email || undefined}
                                                        />
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-foreground">
                                                        {lead.contactName || 'N/A'}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-foreground">
                                                        {lead.company || 'N/A'}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell>
                                                        <Badge variant="ghost" className="capitalize">
                                                            {lead.status || 'New'}
                                                        </Badge>
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-foreground">
                                                        {lead.source || '—'}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleArchiveOne(id)}
                                                            >
                                                                Archive
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setDeleteTargetId(id)}
                                                                className="text-destructive"
                                                            >
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </ZoruTableCell>
                                                </ZoruTableRow>
                                            );
                                        })
                                    ) : (
                                        <ZoruTableRow className="border-border">
                                            <ZoruTableCell
                                                colSpan={7}
                                                className="h-24 text-center text-muted-foreground"
                                            >
                                                {hasActiveFilters || search
                                                    ? 'No leads match your filters.'
                                                    : 'No vendor leads yet.'}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    )}
                                </ZoruTableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </EntityListShell>

            {/* Single-row delete */}
            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this lead permanently?"
                description={
                    deleteTarget
                        ? `This permanently removes "${deleteTarget.title || deleteTarget.contactName}". This action cannot be undone.`
                        : undefined
                }
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />

            {/* Bulk delete */}
            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Delete ${selected.size} lead${selected.size === 1 ? '' : 's'}?`}
                description="The selected leads will be permanently removed. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete all"
                onConfirm={handleConfirmBulkDelete}
            />

            {/* CSV import dialog */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <ZoruDialogContent className="sm:max-w-md">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Import leads from CSV</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Pick a CSV from your SabFiles library or upload a new one. Each
                            row becomes one lead. Recognized columns: title, contactName,
                            email, phone, company, website, country, status, source, value,
                            currency, stage, description, nextFollowUp.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>

                    <div className="flex flex-col gap-3">
                        <SabFileToFileButton
                            accept="document"
                            variant="outline"
                            onPickFile={(file) => importCsv(file)}
                        >
                            {importBusy ? 'Importing…' : 'Pick CSV from SabFiles'}
                        </SabFileToFileButton>

                        {importResults.length > 0 ? (
                            <div className="max-h-64 overflow-y-auto rounded border border-zoru-line text-xs">
                                {importResults.map((r) => (
                                    <div
                                        key={r.row}
                                        className={
                                            'flex justify-between px-3 py-1.5 ' +
                                            (r.ok ? 'text-zoru-fg' : 'text-zoru-danger')
                                        }
                                    >
                                        <span>Row {r.row}</span>
                                        <span>{r.ok ? 'OK' : r.error || 'Failed'}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <ZoruDialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setImportOpen(false)}
                            disabled={importBusy}
                        >
                            {importBusy ? 'Working…' : 'Close'}
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>
        </>
    );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function downloadBlob(data: string, mime: string, filename: string): void {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function todaySlug(): string {
    return new Date().toISOString().slice(0, 10);
}
