

export const dynamic = 'force-dynamic';

import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { MonthPicker } from '@/components/crm/month-picker';

export default async function TdsPage({ searchParams }: { searchParams: { month?: string, year?: string } }) {

    let currentPeriod = startOfMonth(new Date());
    if (searchParams.month && searchParams.year) {
        currentPeriod = new Date(parseInt(searchParams.year), parseInt(searchParams.month) - 1, 1);
    }

    const payslips = await getPayslips(currentPeriod);

    // Calculate Totals
    let totalTDS = 0;

    const complianceData = payslips.map(slip => {
        const tds = slip.deductions.find(d => d.name.includes('Tax') || d.name.includes('TDS'))?.amount || 0;
        totalTDS += tds;

        return {
            ...slip,
            tds
        };
    }).filter(item => item.tds > 0); // Only show relevant employees

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        <FileText className="h-8 w-8 text-primary" />
                        TDS Management
                    </h1>
                    <p className="text-muted-foreground">Tax Deducted at Source tracking for {format(currentPeriod, 'MMMM yyyy')}.</p>
                </div>
                <MonthPicker />
            </div>

            <div className="grid gap-4 md:grid-cols-1">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total TDS Collected</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{totalTDS.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Deduction Details</CardTitle>
                    <CardDescription>Breakdown by employee.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead className="text-right">Gross Salary</TableHead>
                                    <TableHead className="text-right">Tax Deduction (TDS)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {complianceData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            No tax deductions found for this month.
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
                                                ₹{slip.tds.toLocaleString()}
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
