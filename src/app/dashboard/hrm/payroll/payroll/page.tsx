'use client';

import { IndianRupee, Printer, Mail, LoaderCircle, Check, Wallet } from "lucide-react";
import { useState, useEffect, useCallback, useTransition } from "react";
import { generatePayrollData, processPayroll } from "@/app/actions/crm-payroll.actions";

import {
  ZoruButton,
  ZoruCard,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableFooter,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';

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
    const { toast } = useZoruToast();

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
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                        <Wallet className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <ZoruPageHeader>
                        <ZoruPageHeading>
                            <ZoruPageTitle>Generate Payroll</ZoruPageTitle>
                            <ZoruPageDescription>
                                Calculate and process monthly salaries for your employees.
                            </ZoruPageDescription>
                        </ZoruPageHeading>
                    </ZoruPageHeader>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <ZoruSelect value={String(month)} onValueChange={val => setMonth(Number(val))}>
                        <ZoruSelectTrigger className="w-36"><ZoruSelectValue /></ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {months.map(m => <ZoruSelectItem key={m.value} value={String(m.value - 1)}>{m.label}</ZoruSelectItem>)}
                        </ZoruSelectContent>
                    </ZoruSelect>
                    <ZoruSelect value={String(year)} onValueChange={val => setYear(Number(val))}>
                        <ZoruSelectTrigger className="w-28"><ZoruSelectValue /></ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {years.map(y => <ZoruSelectItem key={y} value={String(y)}>{y}</ZoruSelectItem>)}
                        </ZoruSelectContent>
                    </ZoruSelect>
                    <ZoruButton onClick={fetchData} disabled={isLoading}>Refresh</ZoruButton>
                </div>
            </div>

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">Payroll for {months[month].label}, {year}</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Paid Days</ZoruTableHead>
                                <ZoruTableHead className="text-right text-zoru-ink-muted">Gross Salary</ZoruTableHead>
                                <ZoruTableHead className="text-right text-zoru-ink-muted">Deductions</ZoruTableHead>
                                <ZoruTableHead className="text-right text-zoru-ink-muted">Net Salary</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? <ZoruTableRow className="border-zoru-line"><ZoruTableCell colSpan={5} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-zoru-ink-muted"/></ZoruTableCell></ZoruTableRow>
                            : payrollData.length > 0 ? payrollData.map(item => (
                                <ZoruTableRow key={item.employeeId} className="border-zoru-line">
                                    <ZoruTableCell className="text-[13px] text-zoru-ink">{item.employeeName}</ZoruTableCell>
                                    <ZoruTableCell className="text-[13px] text-zoru-ink">{item.presentDays} / {item.totalDays}</ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-[13px] text-zoru-ink">₹{item.grossSalary.toLocaleString()}</ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-[13px] text-zoru-danger-ink">- ₹{item.deductions.reduce((s:number, i:any) => s+i.amount, 0).toLocaleString()}</ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-[13px] text-zoru-ink">₹{item.netSalary.toLocaleString()}</ZoruTableCell>
                                </ZoruTableRow>
                            ))
                            : <ZoruTableRow className="border-zoru-line"><ZoruTableCell colSpan={5} className="h-24 text-center text-[13px] text-zoru-ink-muted">No active employees with salary details found.</ZoruTableCell></ZoruTableRow>}
                        </ZoruTableBody>
                        {payrollData.length > 0 && (
                            <ZoruTableFooter className="bg-zoru-surface-2">
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={4} className="text-right text-[13px] text-zoru-ink">Total Net Payout</ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-xl text-zoru-ink">₹{totalNetSalary.toLocaleString()}</ZoruTableCell>
                                </ZoruTableRow>
                            </ZoruTableFooter>
                        )}
                    </ZoruTable>
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">Actions</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                    <ZoruButton
                        onClick={handleRunPayroll}
                        disabled={isLoading || isProcessing || isProcessed || payrollData.length === 0}
                    >
                        {isProcessing ? <LoaderCircle className="h-4 w-4 animate-spin"/> : (isProcessed ? <Check className="h-4 w-4"/> : <IndianRupee className="h-4 w-4"/>)}
                        {isProcessed ? 'Payroll Processed' : 'Run Payroll'}
                    </ZoruButton>
                    <ZoruButton variant="outline" disabled>
                        <Printer className="h-4 w-4"/>
                        Print All Payslips
                    </ZoruButton>
                    <ZoruButton variant="outline" disabled>
                        <Mail className="h-4 w-4"/>
                        Email All Payslips
                    </ZoruButton>
                </div>
                <p className="mt-4 text-[11.5px] text-zoru-ink-muted">Running payroll will lock these calculations and generate payslips for employees.</p>
            </ZoruCard>
        </div>
    );
}
