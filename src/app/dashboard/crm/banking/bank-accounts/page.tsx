'use client';

import {
    Badge,
    Button,
    Card,
    Input,
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
    Checkbox,
    useZoruToast,
} from '@/components/zoruui';
import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import type { WithId } from 'mongodb';
import {
    Building2,
    Clock4,
    Coins,
    Download,
    Edit,
    Landmark,
    Plus,
    Trash2,
    Wallet,
    X,
} from 'lucide-react';

import {
    bulkUpdateCrmPaymentAccounts,
    deleteCrmPaymentAccount,
    getBankAccountKpis,
    getCrmPaymentAccounts,
    type BankAccountKpis,
} from '@/app/actions/crm-payment-accounts.actions';
import type { CrmPaymentAccount } from '@/lib/definitions';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';

type StatusFilter = 'all' | 'active' | 'inactive';
type ExportFormat = 'csv' | 'xlsx';

const PAGE_SIZE = 20;
const EMPTY_KPIS: BankAccountKpis = {
    totalAccounts: 0,
    totalBalance: 0,
    banksCount: 0,
    lastUpdatedAt: null,
};

const formatINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function formatRelative(iso: string | null): string {
    if (!iso) return 'Never';
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return 'Never';
    const diffMs = Date.now() - ts;
    const days = Math.floor(diffMs / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

export default function BankAccountsPage() {
    const { toast } = useZoruToast();

    const [accounts, setAccounts] = React.useState<WithId<CrmPaymentAccount>[]>([]);
    const [kpis, setKpis] = React.useState<BankAccountKpis>(EMPTY_KPIS);
    const [isPending, startTransition] = React.useTransition();

    const [search, setSearch] = React.useState('');
    const [bankFilter, setBankFilter] = React.useState<string>('all');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [page, setPage] = React.useState(1);

    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkConfirm, setBulkConfirm] = React.useState<null | 'delete' | 'archive' | 'activate'>(null);
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [all, kpiData] = await Promise.all([
                getCrmPaymentAccounts(),
                getBankAccountKpis(),
            ]);
            setAccounts(all.filter((a) => a.accountType === 'bank'));
            setKpis(kpiData ?? EMPTY_KPIS);
        });
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Bank options derived from data
    const bankOptions = React.useMemo(() => {
        const names = new Set<string>();
        for (const a of accounts) {
            const n = a.bankDetails?.bankName?.trim();
            if (n) names.add(n);
        }
        return Array.from(names).sort((x, y) => x.localeCompare(y));
    }, [accounts]);

    // Filter
    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return accounts.filter((a) => {
            if (statusFilter !== 'all' && a.status !== statusFilter) return false;
            if (bankFilter !== 'all') {
                const bn = (a.bankDetails?.bankName ?? '').trim().toLowerCase();
                if (bn !== bankFilter.toLowerCase()) return false;
            }
            if (q) {
                const hay = [
                    a.accountName,
                    a.bankDetails?.bankName,
                    a.bankDetails?.accountNumber,
                    a.bankDetails?.accountHolder,
                    a.bankDetails?.ifsc,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [accounts, search, bankFilter, statusFilter]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const pageRows = React.useMemo(
        () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [filtered, page],
    );

    const handleSearch = useDebouncedCallback((v: string) => {
        setSearch(v);
        setPage(1);
    }, 300);

    const hasActiveFilters = statusFilter !== 'all' || bankFilter !== 'all' || !!search;

    const clearFilters = React.useCallback(() => {
        setStatusFilter('all');
        setBankFilter('all');
        setSearch('');
        setPage(1);
    }, []);

    const toggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = React.useCallback(
        (all: boolean) => {
            setSelected(all ? new Set(pageRows.map((r) => String(r._id))) : new Set());
        },
        [pageRows],
    );

    const exportRows = React.useCallback(
        (format: ExportFormat) => {
            const rows = selected.size > 0
                ? filtered.filter((a) => selected.has(String(a._id)))
                : filtered;
            const headers = [
                'Account Name', 'Bank', 'Account Number', 'IFSC', 'Account Holder',
                'Currency', 'Balance', 'Status', 'Created At',
            ];
            const lines = [
                headers.join(','),
                ...rows.map((a) => [
                    csvEscape(a.accountName),
                    csvEscape(a.bankDetails?.bankName),
                    csvEscape(a.bankDetails?.accountNumber),
                    csvEscape(a.bankDetails?.ifsc),
                    csvEscape(a.bankDetails?.accountHolder),
                    csvEscape(a.currency ?? 'INR'),
                    csvEscape(a.currentBalance ?? 0),
                    csvEscape(a.status),
                    csvEscape(a.createdAt ? new Date(a.createdAt).toISOString() : ''),
                ].join(',')),
            ];
            const body = lines.join('\n');
            const mime = format === 'xlsx'
                ? 'application/vnd.ms-excel;charset=utf-8;'
                : 'text/csv;charset=utf-8;';
            const ext = format === 'xlsx' ? 'xls' : 'csv';
            const blob = new Blob([body], { type: mime });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `bank-accounts-${new Date().toISOString().slice(0, 10)}.${ext}`;
            link.click();
            URL.revokeObjectURL(url);
        },
        [filtered, selected],
    );

    const runBulk = React.useCallback(
        async (op: 'archive' | 'activate' | 'delete') => {
            const ids = Array.from(selected);
            if (ids.length === 0) return;
            const res = await bulkUpdateCrmPaymentAccounts(ids, op);
            if (res.success) {
                toast({
                    title:
                        op === 'delete'
                            ? `${res.updated ?? 0} account${res.updated === 1 ? '' : 's'} deleted`
                            : op === 'archive'
                                ? 'Accounts deactivated'
                                : 'Accounts activated',
                });
                setSelected(new Set());
                fetchData();
            } else {
                toast({ title: 'Bulk action failed', description: res.error, variant: 'destructive' });
            }
            setBulkConfirm(null);
        },
        [selected, fetchData, toast],
    );

    const handleDeleteOne = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteCrmPaymentAccount(deleteTargetId);
        if (res.success) {
            toast({ title: 'Account deleted' });
            fetchData();
        } else {
            toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, fetchData, toast]);

    const isEmpty = !isPending && accounts.length === 0;

    return (
        <>
            <EntityListShell
                title="Bank Accounts"
                subtitle="Connected business bank accounts — balances, reconciliation, and statements."
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search name, bank, account number…',
                }}
                primaryAction={
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard/crm/banking/bank-transactions">
                            <Button variant="ghost">Transactions</Button>
                        </Link>
                        <Button variant="secondary" onClick={() => exportRows('csv')}>
                            <Download className="h-4 w-4" /> Export
                        </Button>
                        <Button asChild>
                            <Link href="/dashboard/crm/banking/all/new">
                                <Plus className="h-4 w-4" /> Add Bank Account
                            </Link>
                        </Button>
                    </div>
                }
                filters={
                    isEmpty ? null : (
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="w-44">
                                <Select value={bankFilter} onValueChange={(v) => { setBankFilter(v); setPage(1); }}>
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue placeholder="Bank" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="all">All banks</ZoruSelectItem>
                                        {bankOptions.map((b) => (
                                            <ZoruSelectItem key={b} value={b}>{b}</ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                            <div className="w-40">
                                <Select
                                    value={statusFilter}
                                    onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}
                                >
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue placeholder="Status" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                                        <ZoruSelectItem value="active">Active</ZoruSelectItem>
                                        <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                            {hasActiveFilters ? (
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    <X className="h-3 w-3" /> Clear
                                </Button>
                            ) : null}
                            <div className="ml-auto text-xs text-zoru-ink-muted">
                                {total} of {accounts.length}
                            </div>
                        </div>
                    )
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-zoru-ink">
                                {selected.size} selected
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                                <Button variant="secondary" size="sm" onClick={() => exportRows('csv')}>
                                    <Download className="h-3.5 w-3.5" /> Export CSV
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => exportRows('xlsx')}>
                                    <Download className="h-3.5 w-3.5" /> Export XLSX
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => setBulkConfirm('archive')}>
                                    Deactivate
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => setBulkConfirm('delete')}>
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                                    Clear
                                </Button>
                            </div>
                        </div>
                    ) : null
                }
                empty={
                    isEmpty ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Landmark className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">No bank accounts yet</h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Add a bank account to track balances, reconcile statements, and feed your books.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/banking/all/new">
                                    <Plus className="h-4 w-4" /> Add your first bank account
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={isPending && accounts.length === 0}
                pagination={
                    !isEmpty && total > PAGE_SIZE ? (
                        <PaginationBar
                            page={page}
                            limit={PAGE_SIZE}
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
                            label="Total Accounts"
                            value={kpis.totalAccounts}
                            icon={<Wallet />}
                            period={kpis.totalAccounts === 1 ? 'bank account' : 'bank accounts'}
                        />
                        <StatCard
                            label="Total Balance"
                            value={formatINR(kpis.totalBalance)}
                            icon={<Coins />}
                            period="across all banks"
                        />
                        <StatCard
                            label="Banks"
                            value={kpis.banksCount}
                            icon={<Building2 />}
                            period="distinct banks"
                        />
                        <StatCard
                            label="Last Reconciled"
                            value={formatRelative(kpis.lastUpdatedAt)}
                            icon={<Clock4 />}
                            period={kpis.lastUpdatedAt ? new Date(kpis.lastUpdatedAt).toLocaleDateString() : '—'}
                        />
                    </div>

                    {/* Table */}
                    <Card>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-border hover:bg-transparent">
                                        <ZoruTableHead className="w-10">
                                            <Checkbox
                                                checked={pageRows.length > 0 && pageRows.every((r) => selected.has(String(r._id)))}
                                                onCheckedChange={(v) => toggleAll(!!v)}
                                                aria-label="Select all"
                                            />
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">Account Name</ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">Bank</ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">Account Number</ZoruTableHead>
                                        <ZoruTableHead className="text-right text-muted-foreground">Balance</ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                        <ZoruTableHead className="text-right text-muted-foreground">Actions</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {pageRows.map((account) => {
                                        const id = String(account._id);
                                        const checked = selected.has(id);
                                        return (
                                            <ZoruTableRow key={id} className="border-border">
                                                <ZoruTableCell>
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={() => toggleOne(id)}
                                                        aria-label={`Select ${account.accountName}`}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-medium text-foreground">
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/banking/bank-accounts/${id}`}
                                                        label={account.accountName}
                                                        subtitle={account.bankDetails?.accountHolder || undefined}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[13px] text-foreground">
                                                    {account.bankDetails?.bankName || 'N/A'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-xs text-foreground">
                                                    {account.bankDetails?.accountNumber || 'N/A'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-semibold text-foreground">
                                                    {new Intl.NumberFormat('en-IN', {
                                                        style: 'currency',
                                                        currency: account.currency || 'INR',
                                                    }).format(account.currentBalance || 0)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <Badge variant={(account.status === 'active' ? 'green' : 'rose-soft') as any}>
                                                        {account.status}
                                                    </Badge>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <Button variant="ghost" size="icon" disabled>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setDeleteTargetId(id)}
                                                        aria-label="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })}
                                    {pageRows.length === 0 && accounts.length > 0 ? (
                                        <ZoruTableRow>
                                            <ZoruTableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                                                No accounts match your filters.
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ) : null}
                                </ZoruTableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this bank account?"
                description="This permanently removes the account. Linked transactions are kept but lose their account reference."
                confirmLabel="Delete"
                onConfirm={handleDeleteOne}
            />

            <ConfirmDialog
                open={bulkConfirm === 'delete'}
                onOpenChange={(o) => !o && setBulkConfirm(null)}
                title={`Delete ${selected.size} account${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected bank accounts. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={() => runBulk('delete')}
            />

            <ConfirmDialog
                open={bulkConfirm === 'archive'}
                onOpenChange={(o) => !o && setBulkConfirm(null)}
                title={`Deactivate ${selected.size} account${selected.size === 1 ? '' : 's'}?`}
                description="Inactive accounts are hidden from default voucher pickers. You can reactivate later."
                confirmLabel="Deactivate"
                confirmTone="primary"
                onConfirm={() => runBulk('archive')}
            />
        </>
    );
}
