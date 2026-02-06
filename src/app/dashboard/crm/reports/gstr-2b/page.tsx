'use server';

export const dynamic = 'force-dynamic';

import { getPurchaseOrders } from '@/app/actions/crm-purchase-orders.actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';

import { MonthPicker } from '@/components/crm/month-picker';

export default async function Gstr2bPage({ searchParams }: { searchParams: { month?: string, year?: string } }) {
    const month = searchParams.month ? parseInt(searchParams.month) : undefined;
    const year = searchParams.year ? parseInt(searchParams.year) : undefined;

    // Fetch all purchase orders (limit 50) as proxy for bills
    const { orders, total } = await getPurchaseOrders(1, 50, { month, year });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        <FileText className="h-8 w-8 text-primary" />
                        GSTR-2B Report
                    </h1>
                    <p className="text-muted-foreground">Auto-drafted ITC statement based on Purchase Orders/Bills.</p>
                </div>
                <MonthPicker />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Purchase Documents</CardTitle>
                    <CardDescription>Eligible ITC from recorded purchase orders.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Order No.</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>ITC Eligibility</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No documents found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    orders.map((po) => (
                                        <TableRow key={po._id.toString()}>
                                            <TableCell>{format(new Date(po.orderDate), 'PP')}</TableCell>
                                            <TableCell className="font-medium">{po.orderNumber}</TableCell>
                                            <TableCell>Vendor</TableCell> {/* Placeholder */}
                                            <TableCell className="text-right">
                                                {po.currency} {po.total.toFixed(2)}
                                            </TableCell>
                                            <TableCell>{po.status}</TableCell>
                                            <TableCell>Yes</TableCell>
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
