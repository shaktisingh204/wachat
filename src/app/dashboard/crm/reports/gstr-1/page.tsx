import { ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { getInvoices } from '@/app/actions/crm-invoices.actions';

import { format } from 'date-fns';

import { MonthPicker } from '@/components/crm/month-picker';

import { EntityListShell } from '@/components/crm/entity-list-shell';

export default async function Gstr1Page(props: { searchParams: Promise<{ month?: string, year?: string }> }) {
    const searchParams = await props.searchParams;
    const month = searchParams.month ? parseInt(searchParams.month) : undefined;
    const year = searchParams.year ? parseInt(searchParams.year) : undefined;

    const { invoices } = await getInvoices(1, 50, { month, year });

    return (
        <EntityListShell
            title="GSTR-1 Report"
            subtitle="Outward supplies of goods or services."
            primaryAction={<MonthPicker />}
        >

            <ZoruCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Sales Invoices</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">All recorded sales invoices for GSTR-1 filing.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Invoice No.</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Customer</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Taxable Value</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Total Amount</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {invoices.length === 0 ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={6} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No invoices found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                invoices.map((inv) => (
                                    <ZoruTableRow key={inv._id.toString()} className="border-border">
                                        <ZoruTableCell className="text-[13px] text-foreground">{format(new Date(inv.invoiceDate), 'PP')}</ZoruTableCell>
                                        <ZoruTableCell className="font-medium text-foreground">{inv.invoiceNumber}</ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">Client</ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-foreground">
                                            {inv.currency} {inv.subtotal?.toFixed(2) || inv.total.toFixed(2)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-foreground">
                                            {inv.currency} {inv.total.toFixed(2)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">{inv.status}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    )
}
