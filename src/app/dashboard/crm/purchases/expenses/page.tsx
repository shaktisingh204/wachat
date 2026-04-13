'use server';

import { getExpenses } from '@/app/actions/crm-expenses.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function ExpensesPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        page?: string;
    }>;
}) {
    const params = await searchParams;
    const query = params?.query || '';
    const currentPage = Number(params?.page) || 1;
    const { expenses, total } = await getExpenses(currentPage, 20, query);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Expenses"
                subtitle="Track and manage your business expenses."
                icon={Wallet}
                actions={
                    <Link
                        href="/dashboard/crm/purchases/expenses/new"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-clay-obsidian px-4 text-[13px] font-medium text-white hover:bg-clay-obsidian-hover"
                    >
                        <Plus className="h-4 w-4" strokeWidth={1.75} />
                        Record Expense
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold text-clay-ink">All Expenses</h2>
                        <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Showing {expenses.length} of {total} expenses</p>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink-muted" />
                        <Input
                            type="search"
                            placeholder="Search expenses..."
                            className="h-10 rounded-clay-md border-clay-border bg-clay-surface pl-9 text-[13px]"
                            defaultValue={query}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Date</TableHead>
                                <TableHead className="text-clay-ink-muted">Account</TableHead>
                                <TableHead className="text-clay-ink-muted">Vendor/Payee</TableHead>
                                <TableHead className="text-clay-ink-muted">Reference</TableHead>
                                <TableHead className="text-clay-ink-muted">Description</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Amount</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expenses.length === 0 ? (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No expenses found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                expenses.map((expense) => (
                                    <TableRow key={expense._id.toString()} className="border-clay-border">
                                        <TableCell className="text-[13px] text-clay-ink">{format(new Date(expense.expenseDate), 'PP')}</TableCell>
                                        <TableCell className="font-medium text-clay-ink">{expense.expenseAccount}</TableCell>
                                        <TableCell>
                                            {expense.vendorId ? <span className="text-[12.5px] italic text-clay-ink-muted">Vendor {expense.vendorId.toString().slice(-4)}</span> : <span className="text-[13px] text-clay-ink">-</span>}
                                        </TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{expense.referenceNumber || '-'}</TableCell>
                                        <TableCell className="max-w-[200px] truncate text-[13px] text-clay-ink">{expense.description}</TableCell>
                                        <TableCell className="text-right text-[13px] text-clay-ink">
                                            {expense.currency} {expense.amount.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right" />
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
