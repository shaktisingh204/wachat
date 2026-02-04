'use server';

import { Suspense } from 'react';
import { getProformaInvoices } from '@/app/actions/crm-proforma-invoices.actions';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, BadgeInfo } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { MonthPicker } from '@/components/crm/month-picker';

export default async function ProformaInvoicesPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        page?: string;
        month?: string;
        year?: string;
    }>;
}) {
    const params = await searchParams;
    const query = params?.query || '';
    const currentPage = Number(params?.page) || 1;
    const month = params?.month ? parseInt(params.month) : undefined;
    const year = params?.year ? parseInt(params.year) : undefined;

    const { invoices, total } = await getProformaInvoices(currentPage, 20, { query, month, year });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        <BadgeInfo className="h-8 w-8 text-primary" />
                        Proforma Invoices
                    </h1>
                    <p className="text-muted-foreground">Manage your proforma invoices.</p>
                </div>
                <div className="flex gap-2">
                    <MonthPicker />
                    <Button asChild>
                        <Link href="/dashboard/crm/sales/proforma/new">
                            <Plus className="mr-2 h-4 w-4" /> New Proforma
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Proforma Invoices</CardTitle>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search proforma..." // Note: Client component usage for search input might be needed for real interactivity, handled via URL
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
                                    <TableHead>Proforma #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No proforma invoices found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    invoices.map((inv) => (
                                        <TableRow key={inv._id.toString()}>
                                            <TableCell className="font-medium">{inv.proformaNumber}</TableCell>
                                            <TableCell>{format(new Date(inv.proformaDate), 'PP')}</TableCell>
                                            <TableCell>Client</TableCell> {/* Placeholder since we don't have join yet here */}
                                            <TableCell>
                                                <Badge variant="outline">{inv.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {inv.currency} {inv.total.toFixed(2)}
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
                        Showing {invoices.length} of {total} records
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
