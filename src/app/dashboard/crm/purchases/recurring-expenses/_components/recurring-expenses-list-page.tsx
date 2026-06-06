'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * Recurring Expenses — list page (client).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
    deleteRecurringExpense,
    getRecurringExpenses,
    type RecurringExpenseDoc,
    type RecurringExpenseStatus,
} from '@/app/actions/crm-recurring-expenses-v2.actions';

const BASE = '/dashboard/crm/purchases/recurring-expenses';

const STATUS_TONE: Record<RecurringExpenseStatus, StatusTone> = {
    active: 'green',
    paused: 'amber',
    completed: 'neutral',
    cancelled: 'red',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(amount: number | undefined, currency: string | undefined): string {
    if (amount == null || !Number.isFinite(amount)) return '—';
    return `${currency ?? ''} ${amount.toFixed(2)}`.trim();
}

export function RecurringExpensesListPage() {
    const [rows, setRows] = React.useState<RecurringExpenseDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        RecurringExpenseStatus | 'all'
    >('all');
    const [pendingDelete, setPendingDelete] = React.useState<RecurringExpenseDoc | null>(
        null,
    );
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const items = await getRecurringExpenses();
            setRows(items);
        } catch {
            setRows([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (q && !r.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [rows, search, statusFilter]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deleteRecurringExpense(id);
            if (result.success) {
                toast({ title: 'Schedule deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete schedule.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Recurring Expenses"
                    subtitle="Schedules that auto-generate expense entries."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New schedule
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search schedules…',
                    }}
                    filters={
                        <EnumFilterField
                            enumName="recurringExpenseStatus"
                            value={statusFilter}
                            onChange={(v) =>
                                setStatusFilter(v as RecurringExpenseStatus | 'all')
                            }
                            placeholder="All statuses"
                        />
                    }
                    loading={isLoading && rows.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Name</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Vendor</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Amount</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Frequency</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Next run</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={7} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : filtered.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={7}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No recurring expenses match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    filtered.map((r) => {
                                        const status = r.status;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <Tr key={r._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${r._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {r.name}
                                                    </Link>
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {r.vendor_id ?? '—'}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtMoney(r.amount, r.currency)}
                                                </Td>
                                                <Td className="capitalize text-[var(--st-text)]">
                                                    {r.frequency}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(r.next_run_at)}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={status} tone={tone} />
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${r._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(r)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                    </Button>
                                                </Td>
                                            </Tr>
                                        );
                                    })
                                )}
                            </TBody>
                        </Table>
                    </div>
                </EntityListShell>

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will stop future
                            auto-generated entries. Past entries are preserved.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
