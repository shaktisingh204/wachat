

export const dynamic = 'force-dynamic';

import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { MonthPicker } from '@/components/crm/month-picker';

export default async function PfEsiPage({ searchParams }: { searchParams: { month?: string, year?: string } }) {
    // Default to current month or last processed month. 
    // Ideally we would have a month picker that passes params. 
    // For MVP, let's fetch for the current month.
    let currentPeriod = startOfMonth(new Date());
    if (searchParams.month && searchParams.year) {
        currentPeriod = new Date(parseInt(searchParams.year), parseInt(searchParams.month) - 1, 1);
    }

    const payslips = await getPayslips(currentPeriod);

    // Calculate Totals
    let totalPF = 0;
    let totalESI = 0; // Assuming we have ESI in deductions

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
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        <FileText className="h-8 w-8 text-primary" />
                        PF & ESI Compliance
                    </h1>
                    <p className="text-muted-foreground">Statutory Provident Fund and ESI deductions for {format(currentPeriod, 'MMMM yyyy')}.</p>
                </div>
                <MonthPicker />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total PF Liability</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{totalPF.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total ESI Liability</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{totalESI.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Employee Contributions</CardTitle>
                    <CardDescription>Breakdown by employee.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead className="text-right">Gross Salary</TableHead>
                                    <TableHead className="text-right">PF Deduction</TableHead>
                                    <TableHead className="text-right">ESI Deduction</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {complianceData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No payroll data found for this month. Please generate payroll first.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    complianceData.map((slip) => (
                                        <TableRow key={slip._id.toString()}>
                                            <TableCell className="font-medium">
                                                Employee ID: {slip.employeeId.toString().slice(-4)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                ₹{slip.grossSalary.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                ₹{slip.pf.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                ₹{slip.esi.toLocaleString()}
                                            </TableCell>
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
