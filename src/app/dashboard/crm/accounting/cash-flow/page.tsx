import { ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { getCashFlowStatement } from '@/app/actions/crm-accounting-reports.actions';

import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

export default async function CashFlowPage(props: { searchParams: Promise<{ year?: string }> }) {
    const searchParams = await props.searchParams;
    const year = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();
    const { monthly, totalIn, totalOut } = await getCashFlowStatement(year);
    const netCashFlow = totalIn - totalOut;

    return (
        <EntityListShell
            title="Cash Flow Statement"
            subtitle={`Inflow vs Outflow Analysis for ${year}`}
        >

            <div className="grid gap-4 md:grid-cols-3">
                <ZoruCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Total Inflow</p>
                    <div className="mt-2 text-[22px] font-semibold flex items-center gap-2 text-emerald-500">
                        <ArrowUpCircle className="h-5 w-5" />
                        ₹{totalIn.toLocaleString()}
                    </div>
                </ZoruCard>
                <ZoruCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Total Outflow</p>
                    <div className="mt-2 text-[22px] font-semibold flex items-center gap-2 text-destructive">
                        <ArrowDownCircle className="h-5 w-5" />
                        ₹{totalOut.toLocaleString()}
                    </div>
                </ZoruCard>
                <ZoruCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Net Cash Flow</p>
                    <div className={`mt-2 text-[22px] font-semibold flex items-center gap-2 ${netCashFlow >= 0 ? 'text-accent-foreground' : 'text-destructive'}`}>
                        ₹{netCashFlow.toLocaleString()}
                    </div>
                </ZoruCard>
            </div>

            <ZoruCard>
                <h2 className="text-[16px] font-semibold text-foreground">Monthly Breakdown</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">Detailed view of cash movement by month.</p>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Month</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Inflow</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Outflow</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Net Change</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {monthly.map((m) => (
                                <ZoruTableRow key={m.month} className="border-border">
                                    <ZoruTableCell className="font-medium text-foreground">{m.month}</ZoruTableCell>
                                    <ZoruTableCell className="text-right text-foreground">₹{m.inflow.toLocaleString()}</ZoruTableCell>
                                    <ZoruTableCell className="text-right text-foreground">₹{m.outflow.toLocaleString()}</ZoruTableCell>
                                    <ZoruTableCell className={`text-right font-semibold ${m.net >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                                        ₹{m.net.toLocaleString()}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    )
}
