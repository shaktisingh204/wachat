'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  useDebouncedCallback } from 'use-debounce';
import { Building2,
  List,
  Plus } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import type { DateRange } from 'react-day-picker';

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

import { useT } from '@/lib/i18n/client';

import {
    archiveCrmAccount,
    getCrmAccountKpis,
    getCrmAccounts,
    setCrmAccountCategory,
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
    const { t } = useT();

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
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

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
        !!currencyFilter ||
        !!dateRange?.from ||
        !!dateRange?.to;

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
                getCrmAccountKpis(),
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
            if (dateRange?.from) {
                const fromMs = dateRange.from.getTime();
                filtered = filtered.filter(
                    (a) =>
                        !!a.createdAt &&
                        new Date(a.createdAt as unknown as string).getTime() >=
                            fromMs,
                );
            }
            if (dateRange?.to) {
                const toMs = dateRange.to.getTime() + 86_400_000 - 1;
                filtered = filtered.filter(
                    (a) =>
                        !!a.createdAt &&
                        new Date(a.createdAt as unknown as string).getTime() <=
                            toMs,
                );
            }

            setAccounts(filtered);
            setTotal(hasActiveFilters ? filtered.length : pageRes.total);

            setKpis({
                total: kpiRes.total,
                active: kpiRes.active,
                archived: kpiRes.archived,
                strategic: kpiRes.strategic,
                key: kpiRes.key,
                totalArr: kpiRes.totalArr ?? 0,
                topIndustries: kpiRes.topIndustries ?? [],
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
        dateRange,
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
        setDateRange(undefined);
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
                title: isArchived
                    ? t('crm.accounts.list.toast.restored')
                    : t('crm.accounts.list.toast.archived'),
            });
            fetchData();
        } else {
            toast({
                title: isArchived
                    ? t('crm.accounts.list.toast.restoreFailed')
                    : t('crm.accounts.list.toast.archiveFailed'),
                description: res.error,
                variant: 'destructive',
            });
        }
        setArchiveTargetId(null);
    }, [archiveTarget, archiveTargetId, fetchData, toast, t]);

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
            title: fail
                ? t('crm.accounts.list.toast.bulkArchivedWithFails', { ok, fail })
                : t('crm.accounts.list.toast.bulkArchived', { ok }),
            variant: fail ? 'destructive' : 'default',
        });
        setSelected(new Set());
        fetchData();
    }, [selected, fetchData, toast, t]);

    const runBulkCategory = React.useCallback(
        async (next: 'new' | 'strategic' | 'key' | 'regular') => {
            if (selected.size === 0) return;
            const res = await setCrmAccountCategory(Array.from(selected), next);
            if (res.success) {
                const count = res.modifiedCount ?? selected.size;
                toast({
                    title: t('crm.accounts.list.toast.categoryUpdated'),
                    description: t('crm.accounts.list.toast.categoryUpdatedDescription', {
                        count,
                        label: count === 1 ? 'account' : 'accounts',
                        next,
                    }),
                    variant: 'success',
                });
                setSelected(new Set());
                fetchData();
            } else {
                toast({
                    title: t('crm.accounts.list.toast.bulkCategoryFailed'),
                    description: res.error ?? t('crm.accounts.list.toast.unknownError'),
                    variant: 'destructive',
                });
            }
        },
        [selected, toast, fetchData, t],
    );

    const exportRows = React.useMemo(() => {
        const rows =
            selected.size > 0
                ? accounts.filter((a) => selected.has(String(a._id)))
                : accounts;
        return rows.map((a) => ({
            Name: a.name,
            Industry: a.industry ?? '',
            Website: a.website ?? '',
            Phone: a.phone ?? '',
            Country: a.country ?? '',
            State: a.state ?? '',
            City: a.city ?? '',
            Category: a.category ?? '',
            Currency: a.currency ?? '',
            GSTIN: a.gstin ?? '',
            PAN: a.pan ?? '',
            Status: a.status ?? 'active',
            CreatedAt: a.createdAt ? new Date(a.createdAt).toISOString() : '',
        }));
    }, [accounts, selected]);

    const exportHeaders = React.useMemo<string[]>(
        () => [
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
        ],
        [],
    );

    const exportCsv = React.useCallback(() => {
        downloadCsv(`accounts-${dateStamp()}.csv`, exportHeaders, exportRows);
    }, [exportHeaders, exportRows]);

    const exportXlsx = React.useCallback(() => {
        void downloadXlsx(
            `accounts-${dateStamp()}.xlsx`,
            exportHeaders,
            exportRows,
            'Accounts',
        );
    }, [exportHeaders, exportRows]);

    const totalPages = Math.max(1, Math.ceil(total / ACCOUNTS_PER_PAGE));

    return (
        <>
            <EntityListShell
                title={t('crm.accounts.list.title')}
                subtitle={t('crm.accounts.list.subtitle')}
                viewSwitcher={
                    <div className="inline-flex rounded-md border border-zoru-line p-0.5">
                        <button
                            type="button"
                            aria-pressed={view === 'table'}
                            className="inline-flex items-center gap-1 rounded-sm bg-zoru-surface px-2 py-1 text-[12px] text-zoru-ink"
                        >
                            <List className="h-3.5 w-3.5" /> {t('crm.accounts.list.view.table')}
                        </button>
                        {/* TODO 1D.1: card-grid view deferred — table is the contract default. */}
                    </div>
                }
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: t('crm.accounts.list.search.placeholder'),
                }}
                primaryAction={
                    <ZoruButton asChild>
                        <Link href="/dashboard/crm/accounts/new">
                            <Plus className="h-4 w-4" /> {t('crm.accounts.list.action.new')}
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
                        <AccountsBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onArchive={() => void runBulkArchive()}
                            onCategoryChange={(c) => void runBulkCategory(c)}
                            onExport={exportCsv}
                            onExportXlsx={exportXlsx}
                        />
                    ) : null
                }
                empty={
                    !isPending && accounts.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Building2 className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                {t('crm.accounts.list.empty.title')}
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                {t('crm.accounts.list.empty.subtitle')}
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/accounts/new">
                                    <Plus className="h-4 w-4" /> {t('crm.accounts.list.empty.action')}
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
                        ? t('crm.accounts.list.confirm.restoreTitle')
                        : t('crm.accounts.list.confirm.archiveTitle')
                }
                description={
                    archiveTarget?.status === 'archived'
                        ? t('crm.accounts.list.confirm.restoreDescription', { name: archiveTarget?.name ?? '' })
                        : t('crm.accounts.list.confirm.archiveDescription', { name: archiveTarget?.name ?? '' })
                }
                confirmLabel={
                    archiveTarget?.status === 'archived'
                        ? t('crm.accounts.list.confirm.restore')
                        : t('crm.accounts.list.confirm.archive')
                }
                confirmTone="primary"
                onConfirm={handleConfirmArchive}
            />
        </>
    );
}
