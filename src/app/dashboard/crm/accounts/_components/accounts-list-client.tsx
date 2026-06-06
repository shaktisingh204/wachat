'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import { Building2, List, Plus } from 'lucide-react';

import { Button, useToast } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import { useT } from '@/lib/i18n/client';

import { archiveCrmAccount, setCrmAccountCategory, unarchiveCrmAccount } from '@/app/actions/crm-accounts.actions';
import { mergeAccounts } from '../actions';
import type { CrmAccount } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import type { DateRange } from 'react-day-picker';

import { AccountsTable } from './accounts-table';
import {
    AccountsBulkBar,
    AccountsFiltersRow,
    type AccountCategoryFilter,
    type AccountStatusFilter,
} from './accounts-filters';
import { AccountsKpiStrip, type AccountKpis } from './accounts-kpis';

const ACCOUNTS_PER_PAGE = 20;

export interface AccountsListClientProps {
    accounts: WithId<CrmAccount>[];
    total: number;
    kpis: AccountKpis;
    params: {
        page: number;
        search: string;
        statusFilter: AccountStatusFilter;
        categoryFilter: AccountCategoryFilter;
        industryFilter: string;
        countryFilter: string;
        currencyFilter: string;
        fromDate?: string;
        toDate?: string;
    };
}

export function AccountsListClient({ accounts, total, kpis, params }: AccountsListClientProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { t } = useT();

    const [isPending, startTransition] = React.useTransition();
    const [isMutating, setIsMutating] = React.useState(false);
    const isLoading = isPending || isMutating;

    const dateRange = React.useMemo<DateRange | undefined>(() => {
        if (!params.fromDate && !params.toDate) return undefined;
        return {
            from: params.fromDate ? new Date(params.fromDate) : undefined,
            to: params.toDate ? new Date(params.toDate) : undefined,
        };
    }, [params.fromDate, params.toDate]);

    const hasActiveFilters =
        params.categoryFilter !== 'all' ||
        !!params.industryFilter ||
        !!params.countryFilter ||
        !!params.currencyFilter ||
        !!params.fromDate ||
        !!params.toDate;

    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [view] = React.useState<'table'>('table');
    const [archiveTargetId, setArchiveTargetId] = React.useState<string | null>(null);

    const updateParams = React.useCallback(
        (updates: Record<string, string | null>) => {
            const next = new URLSearchParams(searchParams.toString());
            for (const [k, v] of Object.entries(updates)) {
                if (v === null || v === '') {
                    next.delete(k);
                } else {
                    next.set(k, v);
                }
            }
            startTransition(() => {
                router.push(`${pathname}?${next.toString()}`, { scroll: false });
            });
        },
        [searchParams, pathname, router],
    );

    const handleSearch = useDebouncedCallback((next: string) => {
        updateParams({ search: next, page: '1' });
    }, 300);

    const clearFilters = React.useCallback(() => {
        startTransition(() => {
            router.push(pathname, { scroll: false });
        });
    }, [pathname, router]);

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
            setSelected(all ? new Set(accounts.map((a) => String(a._id))) : new Set());
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
        setIsMutating(true);
        const res = isArchived
            ? await unarchiveCrmAccount(archiveTargetId)
            : await archiveCrmAccount(archiveTargetId);
        if (res.success) {
            toast({
                title: isArchived
                    ? t('crm.accounts.list.toast.restored')
                    : t('crm.accounts.list.toast.archived'),
            });
            startTransition(() => {
                router.refresh();
            });
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
        setIsMutating(false);
    }, [archiveTarget, archiveTargetId, router, toast, t]);

    const runBulkArchive = React.useCallback(async () => {
        if (selected.size === 0) return;
        setIsMutating(true);
        const targets = Array.from(selected);

        const results = await Promise.all(targets.map((id) => archiveCrmAccount(id)));

        let ok = 0;
        let fail = 0;
        results.forEach((res) => {
            if (res.success) ok++;
            else fail++;
        });

        setSelected(new Set());
        toast({
            title: fail
                ? t('crm.accounts.list.toast.bulkArchivedWithFails', { ok, fail })
                : t('crm.accounts.list.toast.bulkArchived', { ok }),
            variant: fail ? 'destructive' : 'default',
        });
        startTransition(() => {
            router.refresh();
        });
        setIsMutating(false);
    }, [selected, toast, t, router]);

    const runMergeAccounts = React.useCallback(async () => {
        if (selected.size !== 2) return;
        setIsMutating(true);
        const [primaryId, secondaryId] = Array.from(selected);
        toast({ title: 'Merging accounts...' });

        const res = await mergeAccounts(primaryId, secondaryId);

        setSelected(new Set());
        if (res.success) {
            toast({ title: 'Accounts merged successfully', variant: 'success' });
            startTransition(() => {
                router.refresh();
            });
        } else {
            toast({ title: 'Failed to merge accounts', description: res.error, variant: 'destructive' });
        }
        setIsMutating(false);
    }, [selected, toast, router]);

    const runBulkCategory = React.useCallback(
        async (next: 'new' | 'strategic' | 'key' | 'regular') => {
            if (selected.size === 0) return;
            setIsMutating(true);
            const targets = Array.from(selected);
            const res = await setCrmAccountCategory(targets, next);
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
                startTransition(() => {
                    router.refresh();
                });
            } else {
                toast({
                    title: t('crm.accounts.list.toast.bulkCategoryFailed'),
                    description: res.error ?? t('crm.accounts.list.toast.unknownError'),
                    variant: 'destructive',
                });
            }
            setIsMutating(false);
        },
        [selected, toast, t, router],
    );

    const exportRows = React.useMemo(() => {
        const rows = selected.size > 0 ? accounts.filter((a) => selected.has(String(a._id))) : accounts;
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
        void downloadXlsx(`accounts-${dateStamp()}.xlsx`, exportHeaders, exportRows, 'Accounts');
    }, [exportHeaders, exportRows]);

    const totalPages = Math.max(1, Math.ceil(total / ACCOUNTS_PER_PAGE));

    return (
        <>
            <EntityListShell
                title={t('crm.accounts.list.title')}
                subtitle={t('crm.accounts.list.subtitle')}
                viewSwitcher={
                    <div className="inline-flex rounded-md border border-[var(--st-border)] p-0.5">
                        <button
                            type="button"
                            aria-pressed={view === 'table'}
                            className="inline-flex items-center gap-1 rounded-sm bg-[var(--st-bg-secondary)] px-2 py-1 text-[12px] text-[var(--st-text)]"
                        >
                            <List className="h-3.5 w-3.5" /> {t('crm.accounts.list.view.table')}
                        </button>
                    </div>
                }
                search={{
                    value: params.search,
                    onChange: (v) => handleSearch(v),
                    placeholder: t('crm.accounts.list.search.placeholder'),
                }}
                primaryAction={
                    <Button asChild>
                        <Link href="/dashboard/crm/accounts/new">
                            <Plus className="h-4 w-4" /> {t('crm.accounts.list.action.new')}
                        </Link>
                    </Button>
                }
                filters={
                    <AccountsFiltersRow
                        statusFilter={params.statusFilter}
                        onStatusChange={(v) => updateParams({ status: v, page: '1' })}
                        categoryFilter={params.categoryFilter}
                        onCategoryChange={(v) => updateParams({ category: v, page: '1' })}
                        industryFilter={params.industryFilter}
                        onIndustryChange={(v) => updateParams({ industry: v, page: '1' })}
                        countryFilter={params.countryFilter}
                        onCountryChange={(v) => updateParams({ country: v, page: '1' })}
                        currencyFilter={params.currencyFilter}
                        onCurrencyChange={(v) => updateParams({ currency: v, page: '1' })}
                        dateRange={dateRange}
                        onDateRangeChange={(r) => {
                            updateParams({
                                fromDate: r?.from ? r.from.toISOString() : null,
                                toDate: r?.to ? r.to.toISOString() : null,
                                page: '1',
                            });
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
                            onMerge={selected.size === 2 ? () => void runMergeAccounts() : undefined}
                        />
                    ) : null
                }
                empty={
                    !isLoading && accounts.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Building2 className="h-8 w-8 text-[var(--st-text-secondary)]" />
                            <h3 className="text-base font-medium text-[var(--st-text)]">
                                {t('crm.accounts.list.empty.title')}
                            </h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                {t('crm.accounts.list.empty.subtitle')}
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/accounts/new">
                                    <Plus className="h-4 w-4" /> {t('crm.accounts.list.empty.action')}
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={isLoading && accounts.length === 0}
                pagination={
                    accounts.length > 0 ? (
                        <PaginationBar
                            page={params.page}
                            limit={ACCOUNTS_PER_PAGE}
                            hasMore={params.page < totalPages}
                            total={total}
                            controlled={{
                                onChange: (next) => updateParams({ page: String(next.page) }),
                            }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    <AccountsKpiStrip
                        kpis={kpis}
                        statusFilter={params.statusFilter}
                        categoryFilter={params.categoryFilter}
                        hasActiveFilters={hasActiveFilters}
                        onClearAll={clearFilters}
                        onSetStatus={(next) => updateParams({ status: next, page: '1' })}
                        onSetCategory={(next) => updateParams({ category: next, page: '1' })}
                    />

                    <AccountsTable
                        accounts={accounts}
                        loading={isLoading}
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
