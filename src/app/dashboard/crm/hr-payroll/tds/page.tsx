export const dynamic = 'force-dynamic';

import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileMinus } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { MonthPicker } from '@/components/crm/month-picker';

import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function TdsPage(props: { searchParams: Promise<{ month?: string, year?: string }> }) {
    const searchParams = await props.searchParams;

    let currentPeriod = startOfMonth(new Date());
    if (searchParams.month && searchParams.year) {
        currentPeriod = new Date(parseInt(searchParams.year), parseInt(searchParams.month) - 1, 1);
    }

    const payslips = await getPayslips(currentPeriod);

    let totalTDS = 0;

    const complianceData = payslips.map(slip => {
        const tds = slip.deductions.find(d => d.name.includes('Tax') || d.name.includes('TDS'))?.amount || 0;
        totalTDS += tds;

        return {
            ...slip,
            tds
        };
    }).filter(item => item.tds > 0);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="TDS Management"
                subtitle={`Tax Deducted at Source tracking for ${format(currentPeriod, 'MMMM yyyy')}.`}
                icon={FileMinus}
                actions={<MonthPicker />}
            />

            <ClayCard>
                <p className="text-[12.5px] font-medium text-clay-ink-muted">Total TDS Collected</p>
                <div className="mt-2 text-2xl font-bold text-clay-ink">₹{totalTDS.toLocaleString()}</div>
            </ClayCard>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Deduction Details</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Breakdown by employee.</p>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Gross Salary</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Tax Deduction (TDS)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {complianceData.length === 0 ? (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={3} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No tax deductions found for this month.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                complianceData.map((slip) => (
                                    <TableRow key={slip._id.toString()} className="border-clay-border">
                                        <TableCell className="text-[13px] font-medium text-clay-ink">
                                            Employee ID: {slip.employeeId.toString().slice(-4)}
                                        </TableCell>
                                        <TableCell className="text-right text-[13px] text-clay-ink">₹{slip.grossSalary.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-[13px] text-clay-ink">₹{slip.tds.toLocaleString()}</TableCell>
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
