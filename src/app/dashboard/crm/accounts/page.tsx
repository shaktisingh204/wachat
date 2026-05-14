'use client';

/**
 * Accounts — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (Total · Active · Strategic · Key · Archived — clickable filters)
 *     • Filter row (status · category · industry · country · currency)
 *     • View switcher (Table — default; card grid deferred)
 *     • Bulk action bar when rows are selected
 *     • <AccountsTable />
 *     • Pagination
 *
 * Data flow is client-side. `getCrmAccounts` already accepts `status` so
 * `archived` / `active` filtering happens server-side; everything else is
 * applied client-side from the in-memory page (sufficient for SMB-scale
 * tenants). When the dataset grows past ~500 accounts, swap to a
 * dedicated `getCrmAccountKpis()` action — same trajectory as contacts.
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import { Building2, List, Plus } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ZoruButton, useZoruToast } from '@/components/zoruui';

import {
    archiveCrmAccount,
    getCrmAccounts,
    unarchiveCrmAccount,
} from '@/app/actions/crm-accounts.actions';
import type { CrmAccount } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import { AccountsTable } from './_components/accounts-table';
import {
    AccountsBulkBar,
    AccountsFiltersRow,
    type AccountCategoryFilter,
    type AccountStatusFilter,
} from './_components/accounts-filters';
import {
    AccountsKpiStrip,
    EMPTY_ACCOUNT_KPIS,
    type AccountKpis,
} from './_components/accounts-kpis';

const ACCOUNTS_PER_PAGE = 20;

type ViewMode = 'table';

export default function CrmAccountsPage() {
    const { toast } = useZoruToast();

    /* ─── List state ──────────────────────────────────────────────── */
    const [accounts, setAccounts] = React.useState<WithId<CrmAccount>[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [isPending, startTransition] = React.useTransition();
    const [kpis, setKpis] = React.useState<AccountKpis>(EMPTY_ACCOUNT_KPIS);

    /* ─── Filters ────────────────────────────────────────────────── */
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] =
        React.useState<AccountStatusFilter>('active');
    const [categoryFilter, setCategoryFilter] =
        React.useState<AccountCategoryFilter>('all');
    const [industryFilter, setIndustryFilter] = React.useState('');
    const [countryFilter, setCountryFilter] = React.useState('');
    const [currencyFilter, setCurrencyFilter] = React.useState('');

    /* ─── Selection + view + dialogs ────────────────────────────── */
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [view] = React.useState<ViewMode>('table');
    const [archiveTargetId, setArchiveTargetId] = React.useState<string | null>(
        null,
    );

    const hasActiveFilters =
        categoryFilter !== 'all' ||
        !!industryFilter ||
        !!countryFilter ||
        !!currencyFilter;

    /* ─── Fetch ────────────────────────────────────────────────── */
    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const apiStatus: 'active' | 'archived' | 'all' =
                statusFilter === 'archived'
                    ? 'archived'
                    : statusFilter === 'all'
                      ? 'all'
                      : 'active';

            const [pageRes, kpiRes] = await Promise.all([
                getCrmAccounts(
                    page,
                    ACCOUNTS_PER_PAGE,
                    search || undefined,
                    apiStatus,
                ),
                // Lightweight KPI fetch — pull the first 500 rows in `all`
                // mode and bucket client-side. TODO 1D.1: replace with
                // dedicated `getCrmAccountKpis()` when tenants grow past
                // ~500 accounts.
                getCrmAccounts(1, 500, undefined, 'all'),
            ]);

            let filtered = pageRes.accounts;
            if (categoryFilter !== 'all') {
                filtered = filtered.filter((a) => a.category === categoryFilter);
            }
            if (industryFilter) {
                filtered = filtered.filter(
                    (a) => (a.industry ?? '') === industryFilter,
                );
            }
            if (countryFilter) {
                filtered = filtered.filter(
                    (a) => (a.country ?? '') === countryFilter,
                );
            }
            if (currencyFilter) {
                filtered = filtered.filter(
                    (a) => (a.currency ?? '') === currencyFilter,
                );
            }

            setAccounts(filtered);
            setTotal(hasActiveFilters ? filtered.length : pageRes.total);

            const all = kpiRes.accounts;
            setKpis({
                total: kpiRes.total,
                active: all.filter((a) => a.status !== 'archived').length,
                archived: all.filter((a) => a.status === 'archived').length,
                strategic: all.filter((a) => a.category === 'strategic').length,
                key: all.filter((a) => a.category === 'key').length,
            });
        });
    }, [
        page,
        search,
        statusFilter,
        categoryFilter,
        industryFilter,
        countryFilter,
        currencyFilter,
        hasActiveFilters,
    ]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const clearFilters = React.useCallback(() => {
        setStatusFilter('active');
        setCategoryFilter('all');
        setIndustryFilter('');
        setCountryFilter('');
        setCurrencyFilter('');
        setSearch('');
        setPage(1);
    }, []);

    /* ─── Row actions ────────────────────────────────────────── */
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
            setSelected(
                all ? new Set(accounts.map((a) => String(a._id))) : new Set(),
            );
        },
        [accounts],
    );

    const archiveTarget = React.useMemo(
        () => accounts.find((a) => String(a._id) === archiveTargetId) ?? null,
        [accounts, archiveTargetId],
    );

    const handleConfirmArchive = React.useCallback(async () => {
        if (!archiveTargetId || !archiveTarget) return;
        const isArchived = archiveTarget.status === 'archived';
        const res = isArchived
            ? await unarchiveCrmAccount(archiveTargetId)
            : await archiveCrmAccount(archiveTargetId);
        if (res.success) {
            toast({
                title: isArchived ? 'Account restored' : 'Account archived',
            });
            fetchData();
        } else {
            toast({
                title: isArchived ? 'Restore failed' : 'Archive failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setArchiveTargetId(null);
    }, [archiveTarget, archiveTargetId, fetchData, toast]);

    /* ─── Bulk actions ──────────────────────────────────────── */
    const runBulkArchive = React.useCallback(async () => {
        if (selected.size === 0) return;
        let ok = 0;
        let fail = 0;
        for (const id of Array.from(selected)) {
            const res = await archiveCrmAccount(id);
            if (res.success) ok++;
            else fail++;
        }
        toast({
            title: `${ok} archived${fail ? `, ${fail} failed` : ''}`,
            variant: fail ? 'destructive' : 'default',
        });
        setSelected(new Set());
        fetchData();
    }, [selected, fetchData, toast]);

    const runBulkCategory = React.useCallback(
        async (next: 'new' | 'strategic' | 'key' | 'regular') => {
            if (selected.size === 0) return;
            // TODO 1D.1: per-row category PATCH needs a dedicated action.
            // `updateCrmAccount` requires the full {name, ...} contract so
            // bulk-setting just the category isn't safe yet. Surface a hint
            // until a `setCrmAccountCategory(ids[], category)` lands.
            toast({
                title: 'Bulk category change not yet wired',
                description: `Selected ${selected.size} → ${next}. Needs a dedicated action.`,
                variant: 'warning',
            });
        },
        [selected, toast],
    );

    const exportCsv = React.useCallback(() => {
        const rows =
            selected.size > 0
                ? accounts.filter((a) => selected.has(String(a._id)))
                : accounts;
        const header = [
            'Name',
            'Industry',
            'Website',
            'Phone',
            'Country',
            'State',
            'City',
            'Category',
            'Currency',
            'GSTIN',
            'PAN',
            'Status',
            'CreatedAt',
        ];
        const escape = (v: unknown) =>
            `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...rows.map((a) =>
                [
                    escape(a.name),
                    escape(a.industry),
                    escape(a.website),
                    escape(a.phone),
                    escape(a.country),
                    escape(a.state),
                    escape(a.city),
                    escape(a.category),
                    escape(a.currency),
                    escape(a.gstin),
                    escape(a.pan),
                    escape(a.status ?? 'active'),
                    escape(
                        a.createdAt ? new Date(a.createdAt).toISOString() : '',
                    ),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [accounts, selected]);

    const totalPages = Math.max(1, Math.ceil(total / ACCOUNTS_PER_PAGE));

    return (
        <>
            <EntityListShell
                title="Accounts"
                subtitle="Companies and organisations in your CRM."
                viewSwitcher={
                    <div className="inline-flex rounded-md border border-zoru-line p-0.5">
                        <button
                            type="button"
                            aria-pressed={view === 'table'}
                            className="inline-flex items-center gap-1 rounded-sm bg-zoru-surface px-2 py-1 text-[12px] text-zoru-ink"
                        >
                            <List className="h-3.5 w-3.5" /> Table
                        </button>
                        {/* TODO 1D.1: card-grid view deferred — table is the contract default. */}
                    </div>
                }
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search name, industry, website…',
                }}
                primaryAction={
                    <ZoruButton asChild>
                        <Link href="/dashboard/crm/accounts/new">
                            <Plus className="h-4 w-4" /> New account
                        </Link>
                    </ZoruButton>
                }
                filters={
                    <AccountsFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                        categoryFilter={categoryFilter}
                        onCategoryChange={(v) => {
                            setCategoryFilter(v);
                            setPage(1);
                        }}
                        industryFilter={industryFilter}
                        onIndustryChange={(v) => {
                            setIndustryFilter(v);
                            setPage(1);
                        }}
                        countryFilter={countryFilter}
                        onCountryChange={(v) => {
                            setCountryFilter(v);
                            setPage(1);
                        }}
                        currencyFilter={currencyFilter}
                        onCurrencyChange={(v) => {
                            setCurrencyFilter(v);
                            setPage(1);
                        }}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <AccountsBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onArchive={() => void runBulkArchive()}
                            onCategoryChange={(c) => void runBulkCategory(c)}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    !isPending && accounts.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Building2 className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No accounts yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Accounts are the companies you sell to,
                                support, and invoice. They group contacts,
                                deals, quotes and invoices in one place.
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/accounts/new">
                                    <Plus className="h-4 w-4" /> Add your first
                                    account
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isPending && accounts.length === 0}
                pagination={
                    accounts.length > 0 ? (
                        <PaginationBar
                            page={page}
                            limit={ACCOUNTS_PER_PAGE}
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
                    <AccountsKpiStrip
                        kpis={kpis}
                        statusFilter={statusFilter}
                        categoryFilter={categoryFilter}
                        hasActiveFilters={hasActiveFilters}
                        onClearAll={clearFilters}
                        onSetStatus={(next) => {
                            setStatusFilter(next);
                            setPage(1);
                        }}
                        onSetCategory={(next) => {
                            setCategoryFilter(next);
                            setPage(1);
                        }}
                    />

                    <AccountsTable
                        accounts={accounts}
                        loading={isPending}
                        selectedIds={selected}
                        onToggleOne={handleToggleOne}
                        onToggleAll={handleToggleAll}
                        onArchive={(id) => setArchiveTargetId(id)}
                    />
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!archiveTargetId}
                onOpenChange={(o) => !o && setArchiveTargetId(null)}
                title={
                    archiveTarget?.status === 'archived'
                        ? 'Restore this account?'
                        : 'Archive this account?'
                }
                description={
                    archiveTarget?.status === 'archived'
                        ? `"${archiveTarget?.name}" will return to your active list.`
                        : `"${archiveTarget?.name}" will be hidden from default views. You can restore it later.`
                }
                confirmLabel={
                    archiveTarget?.status === 'archived' ? 'Restore' : 'Archive'
                }
                confirmTone="primary"
                onConfirm={handleConfirmArchive}
            />
        </>
    );
}
