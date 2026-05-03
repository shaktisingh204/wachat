export const dynamic = 'force-dynamic';

import { getPurchaseOrders } from '@/app/actions/crm-purchase-orders.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileBarChart } from 'lucide-react';
import { format } from 'date-fns';

import { MonthPicker } from '@/components/crm/month-picker';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function Gstr2bPage(props: { searchParams: Promise<{ month?: string, year?: string }> }) {
    const searchParams = await props.searchParams;
    const month = searchParams.month ? parseInt(searchParams.month) : undefined;
    const year = searchParams.year ? parseInt(searchParams.year) : undefined;

    const { orders } = await getPurchaseOrders(1, 50, { month, year });

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="GSTR-2B Report"
                subtitle="Auto-drafted ITC statement based on Purchase Orders/Bills."
                icon={FileBarChart}
                actions={<MonthPicker />}
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Purchase Documents</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">Eligible ITC from recorded purchase orders.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground">Order No.</TableHead>
                                <TableHead className="text-muted-foreground">Vendor</TableHead>
                                <TableHead className="text-right text-muted-foreground">Total Amount</TableHead>
                                <TableHead className="text-muted-foreground">Status</TableHead>
                                <TableHead className="text-muted-foreground">ITC Eligibility</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.length === 0 ? (
                                <TableRow className="border-border">
                                    <TableCell colSpan={6} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No documents found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((po) => (
                                    <TableRow key={po._id.toString()} className="border-border">
                                        <TableCell className="text-[13px] text-foreground">{format(new Date(po.orderDate), 'PP')}</TableCell>
                                        <TableCell className="font-medium text-foreground">{po.orderNumber}</TableCell>
                                        <TableCell className="text-[13px] text-foreground">Vendor</TableCell>
                                        <TableCell className="text-right text-[13px] text-foreground">
                                            {po.currency} {po.total.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-[13px] text-foreground">{po.status}</TableCell>
                                        <TableCell className="text-[13px] text-foreground">Yes</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    )
}
