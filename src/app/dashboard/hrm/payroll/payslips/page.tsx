'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoaderCircle, Receipt, Download, Printer } from "lucide-react";
import { useState, useEffect, useCallback, useTransition } from "react";
import { getPayslips } from "@/app/actions/crm-payroll.actions";
import { getCrmEmployees } from "@/app/actions/crm-employees.actions";
import type { WithId, CrmEmployee } from "@/lib/definitions";
import { startOfMonth } from 'date-fns';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

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
    const [, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Payslips"
                subtitle="View and manage generated payslips for your employees."
                icon={Receipt}
                actions={
                    <>
                        <Select value={String(month)} onValueChange={val => setMonth(Number(val))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent></Select>
                        <Select value={String(year)} onValueChange={val => setYear(Number(val))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                        <ClayButton variant="pill" disabled leading={<Printer className="h-4 w-4"/>}>Print All</ClayButton>
                    </>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Payslips for {months.find(m => m.value === month)?.label}, {year}</h2>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                                <TableHead className="text-clay-ink-muted">Designation</TableHead>
                                <TableHead className="text-clay-ink-muted">Status</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Net Pay</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-clay-border"><TableCell colSpan={5} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-clay-ink-muted"/></TableCell></TableRow>
                            ) : payslips.length > 0 ? (
                                payslips.map(p => (
                                    <TableRow key={p._id.toString()} className="border-clay-border">
                                        <TableCell className="text-[13px] font-medium text-clay-ink">{p.employee?.firstName} {p.employee?.lastName}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{p.employee?.designationName || 'N/A'}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{p.status}</TableCell>
                                        <TableCell className="text-right font-mono text-[13px] font-semibold text-clay-ink">₹{p.netPay.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4"/>Download</Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-clay-border"><TableCell colSpan={5} className="h-24 text-center text-[13px] text-clay-ink-muted">No payslips generated for this period.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
