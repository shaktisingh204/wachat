export const dynamic = 'force-dynamic';

import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { MonthPicker } from '@/components/crm/month-picker';

import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

export default async function PfEsiPage(props: { searchParams: Promise<{ month?: string, year?: string }> }) {
    const searchParams = await props.searchParams;
    let currentPeriod = startOfMonth(new Date());
    if (searchParams.month && searchParams.year) {
        currentPeriod = new Date(parseInt(searchParams.year), parseInt(searchParams.month) - 1, 1);
    }

    const payslips = await getPayslips(currentPeriod);

    let totalPF = 0;
    let totalESI = 0;

    const complianceData = payslips.map(slip => {
        const pf = slip.deductions.find(d => d.name.includes('PF') || d.name.includes('Provident'))?.amount || 0;
        const esi = slip.deductions.find(d => d.name.includes('ESI'))?.amount || 0;
        totalPF += pf;
        totalESI += esi;

        return {
            ...slip,
            pf,
            esi
        };
    });

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="PF & ESI Compliance"
                subtitle={`Statutory Provident Fund and ESI deductions for ${format(currentPeriod, 'MMMM yyyy')}.`}
                icon={ShieldCheck}
                actions={<MonthPicker />}
            />

            <div className="grid gap-4 md:grid-cols-2">
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Total PF Liability</p>
                    <div className="mt-2 text-2xl font-bold text-clay-ink">₹{totalPF.toLocaleString()}</div>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Total ESI Liability</p>
                    <div className="mt-2 text-2xl font-bold text-clay-ink">₹{totalESI.toLocaleString()}</div>
                </ClayCard>
            </div>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Employee Contributions</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Breakdown by employee.</p>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Gross Salary</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">PF Deduction</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">ESI Deduction</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {complianceData.length === 0 ? (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={4} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No payroll data found for this month. Please generate payroll first.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                complianceData.map((slip) => (
                                    <TableRow key={slip._id.toString()} className="border-clay-border">
                                        <TableCell className="text-[13px] font-medium text-clay-ink">
                                            Employee ID: {slip.employeeId.toString().slice(-4)}
                                        </TableCell>
                                        <TableCell className="text-right text-[13px] text-clay-ink">₹{slip.grossSalary.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-[13px] text-clay-ink">₹{slip.pf.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-[13px] text-clay-ink">₹{slip.esi.toLocaleString()}</TableCell>
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
