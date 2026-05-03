'use client';

import { Download, SlidersHorizontal, FileSpreadsheet, LoaderCircle, IndianRupee, Users, TrendingDown, Wallet } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generatePayrollSummaryData, getReportDepartments } from '@/app/actions/crm-hr-reports.actions';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

type PayrollRow = {
    employeeId: string;
    employeeName: string;
    department: string;
    grossSalary: number;
    pf: number;
    esi: number;
    tds: number;
    professionalTax: number;
    totalDeductions: number;
    netPay: number;
};

type Totals = {
    grossSalary: number; pf: number; esi: number; tds: number;
    professionalTax: number; totalDeductions: number; netPay: number;
};

type SelectItem = { _id: string; name: string };

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const StatCard = ({ title, value, icon: Icon, sub }: { title: string; value: string; icon: React.ElementType; sub?: string }) => (
    <ClayCard className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-muted-foreground">{title}</p>
            <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        {sub ? <p className="text-[11.5px] text-muted-foreground">{sub}</p> : null}
    </ClayCard>
);

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

export default function PayrollSummaryPage() {
    const [rows, setRows] = useState<PayrollRow[]>([]);
    const [totals, setTotals] = useState<Totals>({ grossSalary: 0, pf: 0, esi: 0, tds: 0, professionalTax: 0, totalDeductions: 0, netPay: 0 });
    const [totalEmployees, setTotalEmployees] = useState(0);
    const [departments, setDepartments] = useState<SelectItem[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedDept, setSelectedDept] = useState('');

    useEffect(() => {
        getReportDepartments().then(r => { if (r.data) setDepartments(r.data); });
    }, []);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generatePayrollSummaryData({
                month: selectedMonth,
                year: selectedYear,
                departmentId: selectedDept || undefined,
            });
            if (result.error) {
                toast({ title: 'Error generating report', description: result.error, variant: 'destructive' });
            } else if (result.data) {
                setRows(result.data.rows);
                setTotals(result.data.totals);
                setTotalEmployees(result.data.totalEmployees);
            }
        });
    }, [selectedMonth, selectedYear, selectedDept, toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDownload = () => {
        if (rows.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to download.' });
            return;
        }
        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll_summary_${MONTHS[selectedMonth - 1]}_${selectedYear}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Payroll Summary"
                subtitle="Monthly payroll breakdown with all deduction components per employee."
                icon={FileSpreadsheet}
                actions={
                    <>
                        <Popover>
                            <PopoverTrigger asChild>
                                <ClayButton variant="pill" leading={<SlidersHorizontal className="h-4 w-4" />}>
                                    Filters
                                </ClayButton>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 space-y-4 p-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Month</Label>
                                    <select
                                        value={selectedMonth}
                                        onChange={e => setSelectedMonth(Number(e.target.value))}
                                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Year</Label>
                                    <select
                                        value={selectedYear}
                                        onChange={e => setSelectedYear(Number(e.target.value))}
                                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Department</Label>
                                    <select
                                        value={selectedDept}
                                        onChange={e => setSelectedDept(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">All Departments</option>
                                        {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <ClayButton variant="obsidian" onClick={fetchData} disabled={isLoading} className="w-full">
                                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Apply Filters
                                </ClayButton>
                            </PopoverContent>
                        </Popover>
                        <ClayButton
                            variant="pill"
                            onClick={handleDownload}
                            disabled={isLoading || rows.length === 0}
                            leading={<Download className="h-4 w-4" />}
                        >
                            Export CSV
                        </ClayButton>
                    </>
                }
            />

            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Employees" value={totalEmployees.toLocaleString()} icon={Users} />
                <StatCard title="Total Gross Payroll" value={fmt(totals.grossSalary)} icon={IndianRupee} sub={`${MONTHS[selectedMonth - 1]} ${selectedYear}`} />
                <StatCard title="Total Deductions" value={fmt(totals.totalDeductions)} icon={TrendingDown} />
                <StatCard title="Total Net Pay" value={fmt(totals.netPay)} icon={Wallet} />
            </div>

            <ClayCard>
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] font-semibold text-foreground">Payroll Breakdown</h2>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                            {MONTHS[selectedMonth - 1]} {selectedYear}
                        </p>
                    </div>
                    {rows.length > 0 && (
                        <span className="text-[12.5px] text-muted-foreground">{rows.length} employee{rows.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-border bg-secondary">
                                <th className="px-4 py-3 font-medium text-muted-foreground">Employee</th>
                                <th className="px-4 py-3 font-medium text-muted-foreground">Department</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gross Salary</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">PF</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">ESI</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">TDS</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Prof. Tax</th>
                                <th className="px-4 py-3 text-right font-medium text-red-600">Total Deductions</th>
                                <th className="px-4 py-3 text-right font-medium text-green-600">Net Pay</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                                    </td>
                                </tr>
                            ) : rows.length > 0 ? (
                                <>
                                    {rows.map(row => (
                                        <tr key={row.employeeId} className="border-b border-border last:border-0 hover:bg-secondary/50">
                                            <td className="px-4 py-3 font-medium text-foreground">{row.employeeName}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{row.department}</td>
                                            <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(row.grossSalary)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(row.pf)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(row.esi)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(row.tds)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(row.professionalTax)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">{fmt(row.totalDeductions)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-green-600">{fmt(row.netPay)}</td>
                                        </tr>
                                    ))}
                                    {/* Totals row */}
                                    <tr className="border-t-2 border-border bg-secondary font-semibold">
                                        <td className="px-4 py-3 text-foreground">Totals</td>
                                        <td className="px-4 py-3" />
                                        <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(totals.grossSalary)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(totals.pf)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(totals.esi)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(totals.tds)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(totals.professionalTax)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">{fmt(totals.totalDeductions)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-green-600">{fmt(totals.netPay)}</td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td colSpan={9} className="h-24 text-center text-muted-foreground">
                                        No payroll data found for the selected period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ClayCard>
        </div>
    );
}
