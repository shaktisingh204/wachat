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
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Total Inflow</p>
                    <div className="mt-2 text-[22px] font-semibold flex items-center gap-2 text-clay-green">
                        <ArrowUpCircle className="h-5 w-5" />
                        ₹{totalIn.toLocaleString()}
                    </div>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Total Outflow</p>
                    <div className="mt-2 text-[22px] font-semibold flex items-center gap-2 text-clay-red">
                        <ArrowDownCircle className="h-5 w-5" />
                        ₹{totalOut.toLocaleString()}
                    </div>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Net Cash Flow</p>
                    <div className={`mt-2 text-[22px] font-semibold flex items-center gap-2 ${netCashFlow >= 0 ? 'text-clay-rose-ink' : 'text-clay-red'}`}>
                        ₹{netCashFlow.toLocaleString()}
                    </div>
                </ClayCard>
            </div>

            <ClayCard>
                <h2 className="text-[16px] font-semibold text-clay-ink">Monthly Breakdown</h2>
                <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Detailed view of cash movement by month.</p>
                <div className="mt-4 overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Month</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Inflow</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Outflow</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Net Change</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {monthly.map((m) => (
                                <TableRow key={m.month} className="border-clay-border">
                                    <TableCell className="font-medium text-clay-ink">{m.month}</TableCell>
                                    <TableCell className="text-right text-clay-ink">₹{m.inflow.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-clay-ink">₹{m.outflow.toLocaleString()}</TableCell>
                                    <TableCell className={`text-right font-semibold ${m.net >= 0 ? 'text-clay-green' : 'text-clay-red'}`}>
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
