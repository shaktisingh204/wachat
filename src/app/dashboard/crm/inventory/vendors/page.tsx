'use client';

import * as React from 'react';
import Link from 'next/link';
import type { DateRange } from 'react-day-picker';
import type { WithId } from 'mongodb';
import { useDebouncedCallback } from 'use-debounce';
import { Building2, Plus, Trash2 } from 'lucide-react';

import { Badge, Button, Card, Checkbox, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityRowLink } from '@/components/crm/entity-row-link';

import {
    deleteCrmVendor,
    getCrmVendorKpis,
    getCrmVendors,
    saveCrmVendor,
    type CrmVendorKpis,
} from '@/app/actions/crm-vendors.actions';
import { getCrmVendorTypes } from '@/app/actions/crm-vendors.actions';
import type { CrmVendor } from '@/lib/definitions';

import {
    VendorsKpiStrip,
    type VendorsKpiFilter,
} from './_components/vendors-kpi-strip';
import {
    VendorsFiltersRow,
    type VendorTypeOption,
} from './_components/vendors-filters';
import { VendorsBulkBar } from './_components/vendors-bulk-bar';

/**
 * Inventory · Vendors — list page rebuilt with the Deep template
 * (ref: `sales-crm/all-leads/page.tsx`).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards) — total · active · purchase value · top vendor
 *     • Filter row — status · category · created date range
 *     • Bulk action bar (set type, export, delete)
 *     • Vendors table with EntityRowLink on the primary cell
 *     • Pagination
 *
 * The legacy `getCrmVendors()` server action returns the full tenant set
 * in one call, so filtering + pagination are applied client-side. This
 * keeps the action surface backwards compatible with `/purchases/vendors`
 * and any other consumer.
 */

const VENDORS_PER_PAGE = 20;

const EMPTY_KPIS: CrmVendorKpis = {
    total: 0,
    active: 0,
    totalPurchaseValue: 0,
    topVendor: null,
    currency: 'INR',
};

export default function VendorsPage() {
    const { toast } = useToast();

    /* ─── Data state ─────────────────────────────────────────────── */
    const [allVendors, setAllVendors] = React.useState<WithId<CrmVendor>[]>([]);
    const [kpis, setKpis] = React.useState<CrmVendorKpis>(EMPTY_KPIS);
    const [vendorTypes, setVendorTypes] = React.useState<VendorTypeOption[]>([]);
    const [isPending, startTransition] = React.useTransition();

    /* ─── Filters ────────────────────────────────────────────────── */
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<VendorsKpiFilter>('all');
    const [vendorTypeFilter, setVendorTypeFilter] = React.useState<string>('');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

    /* ─── Pagination + selection ─────────────────────────────────── */
    const [page, setPage] = React.useState(1);
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    /* ─── Confirmations ──────────────────────────────────────────── */
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    /* ─── Initial / refresh fetch ────────────────────────────────── */
    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [vendors, kpiData, types] = await Promise.all([
                getCrmVendors(),
                getCrmVendorKpis(),
                getCrmVendorTypes(),
            ]);
            setAllVendors(vendors);
            setKpis(kpiData ?? EMPTY_KPIS);
            setVendorTypes(
                (types ?? [])
                    .map((t) => ({
                        value: t.name ?? '',
                        label: t.name ?? '',
                    }))
                    .filter((t) => t.value.length > 0),
            );
        });
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    /* ─── Derived: filtered list ─────────────────────────────────── */
    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        const fromMs = dateRange?.from ? dateRange.from.getTime() : null;
        const toMs = dateRange?.to ? dateRange.to.getTime() : null;

        return allVendors.filter((v) => {
            if (q) {
                const hay = [v.name, v.email, v.phone, v.displayName, v.vendorType]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (vendorTypeFilter && v.vendorType !== vendorTypeFilter) return false;
            if (statusFilter !== 'all') {
                const updatedMs = v.updatedAt ? new Date(v.updatedAt).getTime() : 0;
                const yearMs = Date.now() - 365 * 24 * 60 * 60 * 1000;
                const isActive = updatedMs >= yearMs;
                if (statusFilter === 'active' && !isActive) return false;
                if (statusFilter === 'inactive' && isActive) return false;
            }
            if (fromMs != null || toMs != null) {
                const createdMs = v.createdAt ? new Date(v.createdAt).getTime() : 0;
                if (fromMs != null && createdMs < fromMs) return false;
                if (toMs != null && createdMs > toMs) return false;
            }
            return true;
        });
    }, [allVendors, search, statusFilter, vendorTypeFilter, dateRange]);

    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / VENDORS_PER_PAGE));
    const pageRows = React.useMemo(() => {
        const start = (page - 1) * VENDORS_PER_PAGE;
        return filtered.slice(start, start + VENDORS_PER_PAGE);
    }, [filtered, page]);

    /* ─── Filter helpers ─────────────────────────────────────────── */
    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const [searchDraft, setSearchDraft] = React.useState('');

    const hasActiveFilters =
        statusFilter !== 'all' ||
        !!vendorTypeFilter ||
        !!dateRange?.from ||
        !!dateRange?.to;

    const clearFilters = React.useCallback(() => {
        setStatusFilter('all');
        setVendorTypeFilter('');
        setDateRange(undefined);
        setSearchDraft('');
        setSearch('');
        setPage(1);
    }, []);

    const handlePickStatus = React.useCallback((next: VendorsKpiFilter) => {
        setStatusFilter((prev) => (prev === next ? 'all' : next));
        setPage(1);
    }, []);

    /* ─── Selection ──────────────────────────────────────────────── */
    const handleToggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const allChecked = pageRows.length > 0 && pageRows.every((v) => selected.has(String(v._id)));
    const someChecked = !allChecked && pageRows.some((v) => selected.has(String(v._id)));

    const handleToggleAll = React.useCallback(
        (all: boolean) => {
            setSelected((prev) => {
                const next = new Set(prev);
                if (all) {
                    for (const v of pageRows) next.add(String(v._id));
                } else {
                    for (const v of pageRows) next.delete(String(v._id));
                }
                return next;
            });
        },
        [pageRows],
    );

    /* ─── Delete (single) ────────────────────────────────────────── */
    const deleteTarget = React.useMemo(
        () => allVendors.find((v) => String(v._id) === deleteTargetId) ?? null,
        [allVendors, deleteTargetId],
    );

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteCrmVendor(deleteTargetId);
        if (res.success) {
            toast({ title: 'Vendor deleted' });
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

    /* ─── Bulk delete ────────────────────────────────────────────── */
    const handleConfirmBulkDelete = React.useCallback(async () => {
        if (selected.size === 0) return;
        const ids = Array.from(selected);
        let ok = 0;
        let lastError: string | undefined;
        for (const id of ids) {
            const res = await deleteCrmVendor(id);
            if (res.success) ok += 1;
            else lastError = res.error;
        }
        toast({
            title: `${ok} vendor${ok === 1 ? '' : 's'} deleted`,
            description:
                ok < ids.length && lastError
                    ? `${ids.length - ok} failed: ${lastError}`
                    : undefined,
            variant: ok < ids.length ? 'destructive' : undefined,
        });
        setSelected(new Set());
        setBulkDeleteOpen(false);
        fetchData();
    }, [selected, fetchData, toast]);

    /* ─── Bulk: change vendor type ───────────────────────────────── */
    const handleBulkChangeType = React.useCallback(
        async (nextType: string) => {
            if (selected.size === 0 || !nextType) return;
            const ids = Array.from(selected);
            const byId = new Map(allVendors.map((v) => [String(v._id), v]));
            let ok = 0;
            let lastError: string | undefined;
            for (const id of ids) {
                const v = byId.get(id);
                if (!v) continue;
                const fd = new FormData();
                fd.set('vendorId', id);
                fd.set('name', v.name ?? '');
                fd.set('vendorType', nextType);
                if (v.email) fd.set('email', v.email);
                if (v.phone) fd.set('phone', v.phone);
                if (v.displayName) fd.set('displayName', v.displayName);
                if (v.industryId) fd.set('industryId', String(v.industryId));
                const res = await saveCrmVendor(null, fd);
                if (!res.error) ok += 1;
                else lastError = res.error;
            }
            toast({
                title: `${ok} vendor${ok === 1 ? '' : 's'} updated`,
                description:
                    ok < ids.length && lastError
                        ? `${ids.length - ok} failed: ${lastError}`
                        : undefined,
                variant: ok < ids.length ? 'destructive' : undefined,
            });
            setSelected(new Set());
            fetchData();
        },
        [selected, allVendors, fetchData, toast],
    );

    /* ─── Export helpers ─────────────────────────────────────────── */
    const exportRows = React.useMemo(() => {
        if (selected.size > 0) {
            return allVendors.filter((v) => selected.has(String(v._id)));
        }
        return filtered;
    }, [allVendors, filtered, selected]);

    const exportCsv = React.useCallback(() => {
        const header = [
            'Name',
            'Display Name',
            'Email',
            'Phone',
            'Vendor Type',
            'City',
            'State',
            'Country',
            'GSTIN',
            'PAN',
            'CreatedAt',
        ];
        const escape = (val: unknown) =>
            `"${String(val ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...exportRows.map((v) =>
                [
                    escape(v.name),
                    escape(v.displayName),
                    escape(v.email),
                    escape(v.phone),
                    escape(v.vendorType),
                    escape(v.city),
                    escape(v.state),
                    escape(v.country),
                    escape(v.gstin),
                    escape(v.pan),
                    escape(v.createdAt ? new Date(v.createdAt).toISOString() : ''),
                ].join(','),
            ),
        ].join('\n');
        downloadBlob(csv, 'text/csv;charset=utf-8;', `vendors-${todaySlug()}.csv`);
    }, [exportRows]);

    const exportXlsx = React.useCallback(() => {
        // Lightweight "XLSX" via SpreadsheetML 2003 — opens cleanly in Excel
        // / Google Sheets / Numbers without adding the heavy `xlsx` dep.
        const header = [
            'Name',
            'Display Name',
            'Email',
            'Phone',
            'Vendor Type',
            'City',
            'State',
            'Country',
            'GSTIN',
            'PAN',
            'CreatedAt',
        ];
        const xmlEscape = (val: unknown) =>
            String(val ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        const rows = exportRows
            .map((v) =>
                `<Row>${[
                    v.name,
                    v.displayName,
                    v.email,
                    v.phone,
                    v.vendorType,
                    v.city,
                    v.state,
                    v.country,
                    v.gstin,
                    v.pan,
                    v.createdAt ? new Date(v.createdAt).toISOString() : '',
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
            `<Worksheet ss:Name="Vendors"><Table>${headerXml}${rows}</Table></Worksheet>` +
            `</Workbook>`;
        downloadBlob(
            xml,
            'application/vnd.ms-excel;charset=utf-8;',
            `vendors-${todaySlug()}.xls`,
        );
    }, [exportRows]);

    /* ─── Render ─────────────────────────────────────────────────── */
    return (
        <>
            <EntityListShell
                title="Vendors"
                subtitle="A list of your suppliers — track every party you buy from."
                search={{
                    value: searchDraft,
                    onChange: (next) => {
                        setSearchDraft(next);
                        handleSearch(next);
                    },
                    placeholder: 'Search name, email, phone, type…',
                }}
                primaryAction={
                    <Button asChild>
                        <Link href="/dashboard/crm/purchases/vendors/new">
                            <Plus className="h-4 w-4" /> New Vendor
                        </Link>
                    </Button>
                }
                filters={
                    <VendorsFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                        vendorTypeFilter={vendorTypeFilter}
                        onVendorTypeChange={(v) => {
                            setVendorTypeFilter(v);
                            setPage(1);
                        }}
                        vendorTypeOptions={vendorTypes}
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
                        <VendorsBulkBar
                            count={selected.size}
                            vendorTypeOptions={vendorTypes}
                            onClear={() => setSelected(new Set())}
                            onDelete={() => setBulkDeleteOpen(true)}
                            onChangeVendorType={handleBulkChangeType}
                            onExportCsv={exportCsv}
                            onExportXlsx={exportXlsx}
                        />
                    ) : null
                }
                empty={
                    !isPending && pageRows.length === 0 && allVendors.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Building2 className="h-8 w-8 text-[var(--st-text-secondary)]" />
                            <h3 className="text-base font-medium text-[var(--st-text)]">
                                No vendors yet
                            </h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                Add your first supplier to start tracking purchase orders,
                                bills, and payouts.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/purchases/vendors/new">
                                    <Plus className="h-4 w-4" /> Add your first vendor
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={isPending && allVendors.length === 0}
                pagination={
                    pageRows.length > 0 ? (
                        <PaginationBar
                            page={page}
                            limit={VENDORS_PER_PAGE}
                            hasMore={page < totalPages}
                            total={totalFiltered}
                            controlled={{
                                onChange: (next) => setPage(next.page),
                            }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    <VendorsKpiStrip
                        kpis={kpis}
                        statusFilter={statusFilter}
                        onClearAll={clearFilters}
                        onPickStatus={handlePickStatus}
                    />

                    <Card>
                        <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
                            All Vendors
                            {totalFiltered !== allVendors.length ? (
                                <Badge variant="secondary" className="ml-2">
                                    {totalFiltered.toLocaleString()} match
                                    {totalFiltered === 1 ? '' : 'es'}
                                </Badge>
                            ) : null}
                        </h2>
                        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--st-border)]">
                            <Table>
                                <THead>
                                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                        <Th className="w-10 text-[var(--st-text-secondary)]">
                                            <Checkbox
                                                aria-label="Select all on page"
                                                checked={
                                                    allChecked ? true : someChecked ? 'indeterminate' : false
                                                }
                                                onCheckedChange={(c) =>
                                                    handleToggleAll(c === true)
                                                }
                                            />
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Vendor Name
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Email
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Phone
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Type
                                        </Th>
                                        <Th className="text-right text-[var(--st-text-secondary)]">
                                            Actions
                                        </Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {pageRows.length > 0 ? (
                                        pageRows.map((vendor) => {
                                            const id = String(vendor._id);
                                            const isSel = selected.has(id);
                                            return (
                                                <Tr
                                                    key={id}
                                                    className="border-[var(--st-border)]"
                                                    data-state={isSel ? 'selected' : undefined}
                                                >
                                                    <Td>
                                                        <Checkbox
                                                            aria-label={`Select ${vendor.name}`}
                                                            checked={isSel}
                                                            onCheckedChange={() => handleToggleOne(id)}
                                                        />
                                                    </Td>
                                                    <Td className="font-medium text-[var(--st-text)]">
                                                        <EntityRowLink
                                                            href={`/dashboard/crm/purchases/vendors/${id}`}
                                                            label={vendor.name}
                                                            subtitle={
                                                                vendor.displayName &&
                                                                vendor.displayName !== vendor.name
                                                                    ? vendor.displayName
                                                                    : undefined
                                                            }
                                                        />
                                                    </Td>
                                                    <Td className="text-[var(--st-text)]">
                                                        {vendor.email || 'N/A'}
                                                    </Td>
                                                    <Td className="text-[var(--st-text)]">
                                                        {vendor.phone || 'N/A'}
                                                    </Td>
                                                    <Td>
                                                        <Badge variant="ghost" className="capitalize">
                                                            {vendor.vendorType ?? '—'}
                                                        </Badge>
                                                    </Td>
                                                    <Td className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={`Delete ${vendor.name}`}
                                                            onClick={() => setDeleteTargetId(id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                        </Button>
                                                    </Td>
                                                </Tr>
                                            );
                                        })
                                    ) : (
                                        <Tr className="border-[var(--st-border)]">
                                            <Td
                                                colSpan={6}
                                                className="h-24 text-center text-[var(--st-text-secondary)]"
                                            >
                                                {hasActiveFilters || search
                                                    ? 'No vendors match your filters.'
                                                    : 'No vendors have been added yet.'}
                                            </Td>
                                        </Tr>
                                    )}
                                </TBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this vendor?"
                description={
                    deleteTarget
                        ? `"${deleteTarget.name}" will be permanently removed. This action cannot be undone.`
                        : undefined
                }
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />

            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Delete ${selected.size} vendor${selected.size === 1 ? '' : 's'}?`}
                description="The selected vendors will be permanently removed. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete all"
                onConfirm={handleConfirmBulkDelete}
            />
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
