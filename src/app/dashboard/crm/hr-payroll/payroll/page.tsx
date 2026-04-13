'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IndianRupee, Printer, Mail, LoaderCircle, Check, Wallet } from "lucide-react";
import { useState, useEffect, useCallback, useTransition } from "react";
import { generatePayrollData, processPayroll } from "@/app/actions/crm-payroll.actions";
import { useToast } from "@/hooks/use-toast";

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

export default function GeneratePayrollPage() {
    const [payrollData, setPayrollData] = useState<any[]>([]);
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(currentYear);
    const [isLoading, startLoading] = useTransition();
    const [isProcessing, startProcessing] = useTransition();
    const [isProcessed, setIsProcessed] = useState(false);
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        setIsProcessed(false);
        startLoading(async () => {
            const result = await generatePayrollData(month + 1, year);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                setPayrollData([]);
            } else {
                setPayrollData(result.payrollData || []);
            }
        });
    }, [month, year, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRunPayroll = () => {
        startProcessing(async () => {
            const result = await processPayroll(payrollData, month + 1, year);
            if (result.success) {
                toast({ title: 'Success', description: 'Payroll has been processed successfully.' });
                setIsProcessed(true);
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    const totalNetSalary = payrollData.reduce((sum, item) => sum + item.netSalary, 0);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Generate Payroll"
                subtitle="Calculate and process monthly salaries for your employees."
                icon={Wallet}
                actions={
                    <>
                        <Select value={String(month)} onValueChange={val => setMonth(Number(val))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value - 1)}>{m.label}</SelectItem>)}</SelectContent></Select>
                        <Select value={String(year)} onValueChange={val => setYear(Number(val))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                        <ClayButton variant="obsidian" onClick={fetchData} disabled={isLoading}>Refresh</ClayButton>
                    </>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Payroll for {months[month].label}, {year}</h2>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                                <TableHead className="text-clay-ink-muted">Paid Days</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Gross Salary</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Deductions</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Net Salary</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? <TableRow className="border-clay-border"><TableCell colSpan={5} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-clay-ink-muted"/></TableCell></TableRow>
                            : payrollData.length > 0 ? payrollData.map(item => (
                                <TableRow key={item.employeeId} className="border-clay-border">
                                    <TableCell className="text-[13px] font-medium text-clay-ink">{item.employeeName}</TableCell>
                                    <TableCell className="text-[13px] text-clay-ink">{item.presentDays} / {item.totalDays}</TableCell>
                                    <TableCell className="text-right font-mono text-[13px] text-clay-ink">₹{item.grossSalary.toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-mono text-[13px] text-destructive">- ₹{item.deductions.reduce((s:number, i:any) => s+i.amount, 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-mono text-[13px] font-bold text-clay-ink">₹{item.netSalary.toLocaleString()}</TableCell>
                                </TableRow>
                            ))
                            : <TableRow className="border-clay-border"><TableCell colSpan={5} className="h-24 text-center text-[13px] text-clay-ink-muted">No active employees with salary details found.</TableCell></TableRow>}
                        </TableBody>
                        {payrollData.length > 0 && (
                            <TableFooter className="bg-clay-surface-2">
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={4} className="text-right font-semibold text-[13px] text-clay-ink">Total Net Payout</TableCell>
                                    <TableCell className="text-right font-mono text-xl text-clay-ink">₹{totalNetSalary.toLocaleString()}</TableCell>
                                </TableRow>
                            </TableFooter>
                        )}
                    </Table>
                </div>
            </ClayCard>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Actions</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                    <ClayButton
                        variant="obsidian"
                        onClick={handleRunPayroll}
                        disabled={isLoading || isProcessing || isProcessed || payrollData.length === 0}
                        leading={isProcessing ? <LoaderCircle className="h-4 w-4 animate-spin"/> : (isProcessed ? <Check className="h-4 w-4"/> : <IndianRupee className="h-4 w-4"/>)}
                    >
                        {isProcessed ? 'Payroll Processed' : 'Run Payroll'}
                    </ClayButton>
                    <ClayButton variant="pill" disabled leading={<Printer className="h-4 w-4"/>}>Print All Payslips</ClayButton>
                    <ClayButton variant="pill" disabled leading={<Mail className="h-4 w-4"/>}>Email All Payslips</ClayButton>
                </div>
                <p className="mt-4 text-[11.5px] text-clay-ink-muted">Running payroll will lock these calculations and generate payslips for employees.</p>
            </ClayCard>
        </div>
    );
}
