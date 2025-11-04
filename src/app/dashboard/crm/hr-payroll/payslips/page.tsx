
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoaderCircle, Receipt, Download, Printer } from "lucide-react";
import { useState, useEffect, useCallback, useTransition } from "react";
import { getPayslips } from "@/app/actions/crm-payroll.actions";
import { getCrmEmployees } from "@/app/actions/crm-employees.actions";
import type { WithId, CrmPayslip, CrmEmployee } from "@/lib/definitions";
import { format, startOfMonth } from 'date-fns';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
    { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
    { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, 'label': 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

export default function PayslipsPage() {
    const [payslips, setPayslips] = useState<any[]>([]);
    const [employees, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(currentYear);
    const [isLoading, startTransition] = useTransition();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const period = startOfMonth(new Date(year, month));
            const [payslipsData, employeesData] = await Promise.all([
                getPayslips(period),
                getCrmEmployees()
            ]);
            
            const employeeMap = new Map(employeesData.map(e => [e._id.toString(), e]));

            const populatedPayslips = payslipsData.map(p => ({
                ...p,
                employee: employeeMap.get(p.employeeId.toString()),
            }));
            setPayslips(populatedPayslips);
            setEmployees(employeesData);
        });
    }, [month, year]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Receipt className="h-8 w-8" />
                        Payslips
                    </h1>
                    <p className="text-muted-foreground">View and manage generated payslips for your employees.</p>
                </div>
                 <div className="flex items-center gap-2">
                    <Select value={String(month)} onValueChange={val => setMonth(Number(val))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent></Select>
                    <Select value={String(year)} onValueChange={val => setYear(Number(val))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                    <Button variant="outline" disabled>
                        <Printer className="mr-2 h-4 w-4" /> Print All
                    </Button>
                </div>
            </div>

            <Card>
                 <CardHeader>
                    <CardTitle>Payslips for {months.find(m => m.value === month)?.label}, {year}</CardTitle>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Net Pay</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                     <TableRow><TableCell colSpan={5} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin"/></TableCell></TableRow>
                                ) : payslips.length > 0 ? (
                                    payslips.map(p => (
                                        <TableRow key={p._id.toString()}>
                                            <TableCell className="font-medium">{p.employee?.firstName} {p.employee?.lastName}</TableCell>
                                            <TableCell>{p.employee?.designationName || 'N/A'}</TableCell>
                                            <TableCell>{p.status}</TableCell>
                                            <TableCell className="text-right font-mono font-semibold">₹{p.netPay.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4"/>Download</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No payslips generated for this period.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
