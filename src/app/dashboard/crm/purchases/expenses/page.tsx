'use server';

import { Suspense } from 'react';
import { getExpenses } from '@/app/actions/crm-expenses.actions';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, IndianRupee } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
// import { Pagination } from '@/components/ui/pagination';
const Pagination: any = () => null;

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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Expenses</h1>
                    <p className="text-muted-foreground">Track and manage your business expenses.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/crm/purchases/expenses/new">
                        <Plus className="mr-2 h-4 w-4" /> Record Expense
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Expenses</CardTitle>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search expenses..."
                                className="pl-8"
                                defaultValue={query}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Account</TableHead>
                                    <TableHead>Vendor/Payee</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            No expenses found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    expenses.map((expense) => (
                                        <TableRow key={expense._id.toString()}>
                                            <TableCell>{format(new Date(expense.expenseDate), 'PP')}</TableCell>
                                            <TableCell className="font-medium">{expense.expenseAccount}</TableCell>
                                            <TableCell>
                                                {expense.vendorId ? <span className="text-muted-foreground italic">Vendor {expense.vendorId.toString().slice(-4)}</span> : '-'}
                                            </TableCell>
                                            <TableCell>{expense.referenceNumber || '-'}</TableCell>
                                            <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                                            <TableCell className="text-right">
                                                {expense.currency} {expense.amount.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {/* Add view/edit action if needed later */}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <div className="text-xs text-muted-foreground">
                        Showing {expenses.length} of {total} expenses
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
