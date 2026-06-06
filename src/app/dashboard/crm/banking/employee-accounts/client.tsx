'use client';

import { Badge, Button, Card, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import type { WithId } from 'mongodb';
import {
    AlertTriangle,
    CheckCircle2,
    Coins,
    Download,
    Edit,
    Plus,
    Trash2,
    Users,
    Wallet,
    X,
} from 'lucide-react';

import {
    bulkUpdateCrmPaymentAccounts,
    deleteCrmPaymentAccount,
    type EmployeeAccountKpis,
} from '@/app/actions/crm-payment-accounts.actions';
import type { CrmPaymentAccount } from '@/lib/definitions';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';

type StatusFilter = 'all' | 'active' | 'inactive';
type VerificationFilter = 'all' | 'verified' | 'unverified';
type ExportFormat = 'csv' | 'xlsx';

const PAGE_SIZE = 20;

const formatINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function isVerified(a: CrmPaymentAccount): boolean {
    const ifsc = a.bankDetails?.ifsc?.trim();
    const num = a.bankDetails?.accountNumber?.trim();
    return !!ifsc && !!num;
}

interface Props {
    accounts: WithId<CrmPaymentAccount>[];
    kpis: EmployeeAccountKpis;
}

export function EmployeeAccountsClient({ accounts, kpis }: Props) {
    const { toast } = useToast();
    const router = useRouter();

    const [isPending, startTransition] = React.useTransition();

    const [search, setSearch] = React.useState('');
    const [bankFilter, setBankFilter] = React.useState<string>('all');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [verificationFilter, setVerificationFilter] = React.useState<VerificationFilter>('all');
    const [page, setPage] = React.useState(1);

    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkConfirm, setBulkConfirm] = React.useState<null | 'delete' | 'archive' | 'activate'>(null);
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

    const [hydrated, setHydrated] = React.useState(false);
    React.useEffect(() => {
        setHydrated(true);
    }, []);

    const bankOptions = React.useMemo(() => {
        const names = new Set<string>();
        for (const a of accounts) {
            const n = a.bankDetails?.bankName?.trim();
            if (n) names.add(n);
        }
        return Array.from(names).sort((x, y) => x.localeCompare(y));
    }, [accounts]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return accounts.filter((a) => {
            if (statusFilter !== 'all' && a.status !== statusFilter) return false;
            if (bankFilter !== 'all') {
                const bn = (a.bankDetails?.bankName ?? '').trim().toLowerCase();
                if (bn !== bankFilter.toLowerCase()) return false;
            }
            if (verificationFilter === 'verified' && !isVerified(a)) return false;
            if (verificationFilter === 'unverified' && isVerified(a)) return false;
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
    }, [accounts, search, bankFilter, statusFilter, verificationFilter]);

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

    const hasActiveFilters =
        statusFilter !== 'all' ||
        bankFilter !== 'all' ||
        verificationFilter !== 'all' ||
        !!search;

    const clearFilters = React.useCallback(() => {
        setStatusFilter('all');
        setBankFilter('all');
        setVerificationFilter('all');
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
                'Employee / Account', 'Bank', 'Account Number', 'IFSC', 'Account Holder',
                'Currency', 'Balance', 'Status', 'Verified', 'Created At',
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
                    csvEscape(isVerified(a) ? 'yes' : 'no'),
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
            link.download = `employee-accounts-${new Date().toISOString().slice(0, 10)}.${ext}`;
            link.click();
            URL.revokeObjectURL(url);
        },
        [filtered, selected],
    );

    const refreshData = React.useCallback(() => {
        startTransition(() => {
            router.refresh();
        });
    }, [router]);

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
                refreshData();
            } else {
                toast({ title: 'Bulk action failed', description: res.error, variant: 'destructive' });
            }
            setBulkConfirm(null);
        },
        [selected, refreshData, toast],
    );

    const handleDeleteOne = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteCrmPaymentAccount(deleteTargetId);
        if (res.success) {
            toast({ title: 'Account deleted' });
            refreshData();
        } else {
            toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, refreshData, toast]);

    if (!hydrated) {
        return null; // or a skeleton that matches to avoid hydration mismatches
    }

    const isEmpty = accounts.length === 0;

    return (
        <>
            <EntityListShell
                title="Employee Accounts"
                subtitle="Employee payout, reimbursement, and salary-advance accounts."
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search name, bank, account number…',
                }}
                primaryAction={
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={() => exportRows('csv')}>
                            <Download className="h-4 w-4" /> Export
                        </Button>
                        <Button asChild>
                            <Link href="/dashboard/crm/banking/all/new">
                                <Plus className="h-4 w-4" /> Add Employee Account
                            </Link>
                        </Button>
                    </div>
                }
                filters={
                    isEmpty ? null : (
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="w-44">
                                <Select value={bankFilter} onValueChange={(v) => { setBankFilter(v); setPage(1); }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Bank" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All banks</SelectItem>
                                        {bankOptions.map((b) => (
                                            <SelectItem key={b} value={b}>{b}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-40">
                                <Select
                                    value={statusFilter}
                                    onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-44">
                                <Select
                                    value={verificationFilter}
                                    onValueChange={(v) => { setVerificationFilter(v as VerificationFilter); setPage(1); }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Verification" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All accounts</SelectItem>
                                        <SelectItem value="verified">Verified</SelectItem>
                                        <SelectItem value="unverified">Unverified</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {hasActiveFilters ? (
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    <X className="h-3 w-3" /> Clear
                                </Button>
                            ) : null}
                            <div className="ml-auto text-xs text-[var(--st-text-secondary)]">
                                {total} of {accounts.length}
                            </div>
                        </div>
                    )
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-[var(--st-text)]">
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
                            <Users className="h-8 w-8 text-[var(--st-text-secondary)]" />
                            <h3 className="text-base font-medium text-[var(--st-text)]">No employee accounts yet</h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                Add accounts for employees to manage payouts, reimbursements, and salary advances.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/banking/all/new">
                                    <Plus className="h-4 w-4" /> Add your first employee account
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={isPending}
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
                            label="Total Employees"
                            value={kpis.totalEmployees}
                            icon={<Users />}
                            period={kpis.totalEmployees === 1 ? 'employee account' : 'employee accounts'}
                        />
                        <StatCard
                            label="Total Balance"
                            value={formatINR(kpis.totalBalance)}
                            icon={<Coins />}
                            period="aggregated payouts"
                        />
                        <StatCard
                            label="Active"
                            value={kpis.activeAccounts}
                            icon={<CheckCircle2 />}
                            period={`${kpis.totalEmployees - kpis.activeAccounts} inactive`}
                        />
                        <StatCard
                            label="Unverified"
                            value={kpis.unverifiedCount}
                            icon={<AlertTriangle />}
                            period="missing IFSC or account number"
                            invertDelta
                        />
                    </div>

                    {/* Table */}
                    <Card>
                        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                            <Table>
                                <THead>
                                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                        <Th className="w-10">
                                            <Checkbox
                                                checked={pageRows.length > 0 && pageRows.every((r) => selected.has(String(r._id)))}
                                                onCheckedChange={(v) => toggleAll(!!v)}
                                                aria-label="Select all"
                                            />
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">Account Name</Th>
                                        <Th className="text-[var(--st-text-secondary)]">Bank</Th>
                                        <Th className="text-right text-[var(--st-text-secondary)]">Balance</Th>
                                        <Th className="text-[var(--st-text-secondary)]">Verified</Th>
                                        <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                        <Th className="text-right text-[var(--st-text-secondary)]">Actions</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {pageRows.map((account) => {
                                        const id = String(account._id);
                                        const checked = selected.has(id);
                                        const verified = isVerified(account);
                                        return (
                                            <Tr key={id} className="border-[var(--st-border)]">
                                                <Td>
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={() => toggleOne(id)}
                                                        aria-label={`Select ${account.accountName}`}
                                                    />
                                                </Td>
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/banking/employee-accounts/${id}`}
                                                        label={account.accountName}
                                                        subtitle={account.bankDetails?.accountHolder || undefined}
                                                    />
                                                </Td>
                                                <Td className="text-[13px] text-[var(--st-text)]">
                                                    {account.bankDetails?.bankName || '—'}
                                                </Td>
                                                <Td className="text-right font-semibold text-[var(--st-text)]">
                                                    {new Intl.NumberFormat('en-IN', {
                                                        style: 'currency',
                                                        currency: account.currency || 'INR',
                                                    }).format(account.currentBalance || 0)}
                                                </Td>
                                                <Td>
                                                    <Badge variant={verified ? 'success' : 'warning'}>
                                                        {verified ? 'Verified' : 'Unverified'}
                                                    </Badge>
                                                </Td>
                                                <Td>
                                                    <Badge variant={account.status === 'active' ? 'success' : 'secondary'}>
                                                        {account.status}
                                                    </Badge>
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" disabled>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setDeleteTargetId(id)}
                                                        aria-label="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-[var(--st-danger)]" />
                                                    </Button>
                                                </Td>
                                            </Tr>
                                        );
                                    })}
                                    {pageRows.length === 0 && accounts.length > 0 ? (
                                        <Tr>
                                            <Td colSpan={7} className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
                                                No accounts match your filters.
                                            </Td>
                                        </Tr>
                                    ) : null}
                                </TBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this employee account?"
                description="This permanently removes the account. Linked transactions are kept but lose their account reference."
                confirmLabel="Delete"
                onConfirm={handleDeleteOne}
            />

            <ConfirmDialog
                open={bulkConfirm === 'delete'}
                onOpenChange={(o) => !o && setBulkConfirm(null)}
                title={`Delete ${selected.size} account${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected employee accounts. This action cannot be undone."
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
