
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IndianRupee, Printer, Mail, LoaderCircle, Check } from "lucide-react";
import { useState, useEffect, useCallback, useTransition } from "react";
import { generatePayrollData, processPayroll } from "@/app/actions/crm-payroll.actions";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Generate Payroll</h1>
                    <p className="text-muted-foreground">Calculate and process monthly salaries for your employees.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={String(month)} onValueChange={val => setMonth(Number(val))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value - 1)}>{m.label}</SelectItem>)}</SelectContent></Select>
                    <Select value={String(year)} onValueChange={val => setYear(Number(val))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                    <Button onClick={fetchData} disabled={isLoading}>Refresh</Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Payroll for {months[month].label}, {year}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Paid Days</TableHead>
                                    <TableHead className="text-right">Gross Salary</TableHead>
                                    <TableHead className="text-right">Deductions</TableHead>
                                    <TableHead className="text-right">Net Salary</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={5} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin"/></TableCell></TableRow>
                                : payrollData.length > 0 ? payrollData.map(item => (
                                    <TableRow key={item.employeeId}>
                                        <TableCell className="font-medium">{item.employeeName}</TableCell>
                                        <TableCell>{item.presentDays} / {item.totalDays}</TableCell>
                                        <TableCell className="text-right font-mono">₹{item.grossSalary.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono text-destructive">- ₹{item.deductions.reduce((s:number, i:any) => s+i.amount, 0).toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-bold font-mono">₹{item.netSalary.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                                : <TableRow><TableCell colSpan={5} className="h-24 text-center">No active employees with salary details found.</TableCell></TableRow>}
                            </TableBody>
                             {payrollData.length > 0 && (
                                <CardFooter className="bg-muted font-bold">
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-right">Total Net Payout</TableCell>
                                        <TableCell className="text-right font-mono text-xl">₹{totalNetSalary.toLocaleString()}</TableCell>
                                    </TableRow>
                                </CardFooter>
                            )}
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Actions</CardTitle>
                </CardHeader>
                 <CardContent className="flex flex-wrap gap-4">
                     <Button onClick={handleRunPayroll} disabled={isLoading || isProcessing || isProcessed || payrollData.length === 0}>
                        {isProcessing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : (isProcessed ? <Check className="mr-2 h-4 w-4"/> : <IndianRupee className="mr-2 h-4 w-4"/>)}
                        {isProcessed ? 'Payroll Processed' : 'Run Payroll'}
                    </Button>
                    <Button variant="outline" disabled><Printer className="mr-2 h-4 w-4"/>Print All Payslips</Button>
                    <Button variant="outline" disabled><Mail className="mr-2 h-4 w-4"/>Email All Payslips</Button>
                </CardContent>
                 <CardFooter>
                    <p className="text-xs text-muted-foreground">Running payroll will lock these calculations and generate payslips for employees.</p>
                </CardFooter>
            </Card>
        </div>
    );
}
