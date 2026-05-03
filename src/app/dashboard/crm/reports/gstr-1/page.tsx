export const dynamic = 'force-dynamic';

import { getInvoices } from '@/app/actions/crm-invoices.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileBarChart } from 'lucide-react';
import { format } from 'date-fns';

import { MonthPicker } from '@/components/crm/month-picker';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function Gstr1Page(props: { searchParams: Promise<{ month?: string, year?: string }> }) {
    const searchParams = await props.searchParams;
    const month = searchParams.month ? parseInt(searchParams.month) : undefined;
    const year = searchParams.year ? parseInt(searchParams.year) : undefined;

    const { invoices } = await getInvoices(1, 50, { month, year });

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="GSTR-1 Report"
                subtitle="Outward supplies of goods or services."
                icon={FileBarChart}
                actions={<MonthPicker />}
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Sales Invoices</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">All recorded sales invoices for GSTR-1 filing.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground">Invoice No.</TableHead>
                                <TableHead className="text-muted-foreground">Customer</TableHead>
                                <TableHead className="text-right text-muted-foreground">Taxable Value</TableHead>
                                <TableHead className="text-right text-muted-foreground">Total Amount</TableHead>
                                <TableHead className="text-muted-foreground">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.length === 0 ? (
                                <TableRow className="border-border">
                                    <TableCell colSpan={6} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No invoices found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                invoices.map((inv) => (
                                    <TableRow key={inv._id.toString()} className="border-border">
                                        <TableCell className="text-[13px] text-foreground">{format(new Date(inv.invoiceDate), 'PP')}</TableCell>
                                        <TableCell className="font-medium text-foreground">{inv.invoiceNumber}</TableCell>
                                        <TableCell className="text-[13px] text-foreground">Client</TableCell>
                                        <TableCell className="text-right text-[13px] text-foreground">
                                            {inv.currency} {inv.subtotal?.toFixed(2) || inv.total.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right text-[13px] text-foreground">
                                            {inv.currency} {inv.total.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-[13px] text-foreground">{inv.status}</TableCell>
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
