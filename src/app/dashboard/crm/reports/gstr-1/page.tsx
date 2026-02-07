

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getInvoices } from '@/app/actions/crm-invoices.actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, LoaderCircle } from 'lucide-react';
import { format } from 'date-fns';

import { MonthPicker } from '@/components/crm/month-picker';

export default async function Gstr1Page({ searchParams }: { searchParams: { month?: string, year?: string } }) {
    const month = searchParams.month ? parseInt(searchParams.month) : undefined;
    const year = searchParams.year ? parseInt(searchParams.year) : undefined;

    // Fetch all invoices (limit 50 for now, ideally pagination or date filter)
    const { invoices, total } = await getInvoices(1, 50, { month, year });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        <FileText className="h-8 w-8 text-primary" />
                        GSTR-1 Report
                    </h1>
                    <p className="text-muted-foreground">Outward supplies of goods or services.</p>
                </div>
                <MonthPicker />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Sales Invoices</CardTitle>
                    <CardDescription>All recorded sales invoices for GSTR-1 filing.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Invoice No.</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead className="text-right">Taxable Value</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No invoices found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    invoices.map((inv) => (
                                        <TableRow key={inv._id.toString()}>
                                            <TableCell>{format(new Date(inv.invoiceDate), 'PP')}</TableCell>
                                            <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                                            <TableCell>Client</TableCell> {/* Placeholder, need generic join or stored name */}
                                            <TableCell className="text-right">
                                                {inv.currency} {inv.subtotal?.toFixed(2) || inv.total.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {inv.currency} {inv.total.toFixed(2)}
                                            </TableCell>
                                            <TableCell>{inv.status}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
