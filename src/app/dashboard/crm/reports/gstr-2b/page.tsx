import { ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { getPurchaseOrders } from '@/app/actions/crm-purchase-orders.actions';

import { format } from 'date-fns';

import { MonthPicker } from '@/components/crm/month-picker';

import { EntityListShell } from '@/components/crm/entity-list-shell';

export default async function Gstr2bPage(props: { searchParams: Promise<{ month?: string, year?: string }> }) {
    const searchParams = await props.searchParams;
    const month = searchParams.month ? parseInt(searchParams.month) : undefined;
    const year = searchParams.year ? parseInt(searchParams.year) : undefined;

    const { orders } = await getPurchaseOrders(1, 50, { month, year });

    return (
        <EntityListShell
            title="GSTR-2B Report"
            subtitle="Auto-drafted ITC statement based on Purchase Orders/Bills."
            primaryAction={<MonthPicker />}
        >

            <ZoruCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Purchase Documents</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">Eligible ITC from recorded purchase orders.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Order No.</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Vendor</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Total Amount</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">ITC Eligibility</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {orders.length === 0 ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={6} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No documents found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                orders.map((po) => (
                                    <ZoruTableRow key={po._id.toString()} className="border-border">
                                        <ZoruTableCell className="text-[13px] text-foreground">{format(new Date(po.orderDate), 'PP')}</ZoruTableCell>
                                        <ZoruTableCell className="font-medium text-foreground">{po.orderNumber}</ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">Vendor</ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-foreground">
                                            {po.currency} {po.total.toFixed(2)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">{po.status}</ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">Yes</ZoruTableCell>
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
