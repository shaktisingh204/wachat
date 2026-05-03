export const dynamic = 'force-dynamic';

import { getCashFlowStatement } from '@/app/actions/crm-accounting-reports.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpCircle, ArrowDownCircle, ArrowLeftRight } from 'lucide-react';

import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function CashFlowPage(props: { searchParams: Promise<{ year?: string }> }) {
    const searchParams = await props.searchParams;
    const year = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();
    const { monthly, totalIn, totalOut } = await getCashFlowStatement(year);
    const netCashFlow = totalIn - totalOut;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Cash Flow Statement"
                subtitle={`Inflow vs Outflow Analysis for ${year}`}
                icon={ArrowLeftRight}
            />

            <div className="grid gap-4 md:grid-cols-3">
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Total Inflow</p>
                    <div className="mt-2 text-[22px] font-semibold flex items-center gap-2 text-emerald-500">
                        <ArrowUpCircle className="h-5 w-5" />
                        ₹{totalIn.toLocaleString()}
                    </div>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Total Outflow</p>
                    <div className="mt-2 text-[22px] font-semibold flex items-center gap-2 text-destructive">
                        <ArrowDownCircle className="h-5 w-5" />
                        ₹{totalOut.toLocaleString()}
                    </div>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Net Cash Flow</p>
                    <div className={`mt-2 text-[22px] font-semibold flex items-center gap-2 ${netCashFlow >= 0 ? 'text-accent-foreground' : 'text-destructive'}`}>
                        ₹{netCashFlow.toLocaleString()}
                    </div>
                </ClayCard>
            </div>

            <ClayCard>
                <h2 className="text-[16px] font-semibold text-foreground">Monthly Breakdown</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">Detailed view of cash movement by month.</p>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Month</TableHead>
                                <TableHead className="text-muted-foreground text-right">Inflow</TableHead>
                                <TableHead className="text-muted-foreground text-right">Outflow</TableHead>
                                <TableHead className="text-muted-foreground text-right">Net Change</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {monthly.map((m) => (
                                <TableRow key={m.month} className="border-border">
                                    <TableCell className="font-medium text-foreground">{m.month}</TableCell>
                                    <TableCell className="text-right text-foreground">₹{m.inflow.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-foreground">₹{m.outflow.toLocaleString()}</TableCell>
                                    <TableCell className={`text-right font-semibold ${m.net >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                                        ₹{m.net.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    )
}
