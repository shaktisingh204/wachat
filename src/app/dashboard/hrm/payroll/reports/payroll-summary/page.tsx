'use client';

import { ZoruButton, ZoruCard, ZoruLabel, ZoruPopover, ZoruPopoverContent, ZoruPopoverTrigger, useZoruToast } from '@/components/zoruui';
import {
  Download,
  SlidersHorizontal,
  LoaderCircle,
  IndianRupee,
  Users,
  TrendingDown,
  Wallet } from 'lucide-react';
import { useState,
  useEffect,
  useTransition,
  useCallback } from 'react';
import { generatePayrollSummaryData,
  getReportDepartments } from '@/app/actions/crm-hr-reports.actions';
import Papa from 'papaparse';

import { EntityListShell } from '@/components/crm/entity-list-shell';

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
    <ZoruCard className="flex flex-col gap-1 p-6">
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-zoru-ink-muted">{title}</p>
            <Icon className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
        </div>
        <p className="mt-1 text-2xl text-zoru-ink">{value}</p>
        {sub ? <p className="text-[11.5px] text-zoru-ink-muted">{sub}</p> : null}
    </ZoruCard>
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
    const { toast } = useZoruToast();

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
        <EntityListShell
            title="Payroll Summary"
            subtitle="Monthly payroll breakdown with all deduction components per employee."
            primaryAction={
                <>
                    <ZoruPopover>
                        <ZoruPopoverTrigger asChild>
                            <ZoruButton variant="outline">
                                <SlidersHorizontal className="h-4 w-4" />
                                Filters
                            </ZoruButton>
                        </ZoruPopoverTrigger>
                            <ZoruPopoverContent className="w-72 space-y-4 p-4">
                                <div className="space-y-1.5">
                                    <ZoruLabel className="text-[12.5px]">Month</ZoruLabel>
                                    <select
                                        value={selectedMonth}
                                        onChange={e => setSelectedMonth(Number(e.target.value))}
                                        className="w-full rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <ZoruLabel className="text-[12.5px]">Year</ZoruLabel>
                                    <select
                                        value={selectedYear}
                                        onChange={e => setSelectedYear(Number(e.target.value))}
                                        className="w-full rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <ZoruLabel className="text-[12.5px]">Department</ZoruLabel>
                                    <select
                                        value={selectedDept}
                                        onChange={e => setSelectedDept(e.target.value)}
                                        className="w-full rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">All Departments</option>
                                        {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <ZoruButton onClick={fetchData} disabled={isLoading} className="w-full">
                                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Apply Filters
                                </ZoruButton>
                            </ZoruPopoverContent>
                        </ZoruPopover>
                        <ZoruButton
                            variant="outline"
                            onClick={handleDownload}
                            disabled={isLoading || rows.length === 0}
                        >
                            <Download className="h-4 w-4" />
                            Export CSV
                        </ZoruButton>
                    </>
                }
        >

            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Employees" value={totalEmployees.toLocaleString()} icon={Users} />
                <StatCard title="Total Gross Payroll" value={fmt(totals.grossSalary)} icon={IndianRupee} sub={`${MONTHS[selectedMonth - 1]} ${selectedYear}`} />
                <StatCard title="Total Deductions" value={fmt(totals.totalDeductions)} icon={TrendingDown} />
                <StatCard title="Total Net Pay" value={fmt(totals.netPay)} icon={Wallet} />
            </div>

            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">Payroll Breakdown</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                            {MONTHS[selectedMonth - 1]} {selectedYear}
                        </p>
                    </div>
                    {rows.length > 0 && (
                        <span className="text-[12.5px] text-zoru-ink-muted">{rows.length} employee{rows.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 font-medium text-zoru-ink-muted">Employee</th>
                                <th className="px-4 py-3 font-medium text-zoru-ink-muted">Department</th>
                                <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">Gross Salary</th>
                                <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">PF</th>
                                <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">ESI</th>
                                <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">TDS</th>
                                <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">Prof. Tax</th>
                                <th className="px-4 py-3 text-right font-medium text-red-600">Total Deductions</th>
                                <th className="px-4 py-3 text-right font-medium text-green-600">Net Pay</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-zoru-ink-muted" />
                                    </td>
                                </tr>
                            ) : rows.length > 0 ? (
                                <>
                                    {rows.map(row => (
                                        <tr key={row.employeeId} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50">
                                            <td className="px-4 py-3 font-medium text-zoru-ink">{row.employeeName}</td>
                                            <td className="px-4 py-3 text-zoru-ink-muted">{row.department}</td>
                                            <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmt(row.grossSalary)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmt(row.pf)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmt(row.esi)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmt(row.tds)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmt(row.professionalTax)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">{fmt(row.totalDeductions)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-green-600">{fmt(row.netPay)}</td>
                                        </tr>
                                    ))}
                                    {/* Totals row */}
                                    <tr className="border-t-2 border-zoru-line bg-zoru-surface-2 font-semibold">
                                        <td className="px-4 py-3 text-zoru-ink">Totals</td>
                                        <td className="px-4 py-3" />
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmt(totals.grossSalary)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmt(totals.pf)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmt(totals.esi)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmt(totals.tds)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmt(totals.professionalTax)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">{fmt(totals.totalDeductions)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-green-600">{fmt(totals.netPay)}</td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td colSpan={9} className="h-24 text-center text-zoru-ink-muted">
                                        No payroll data found for the selected period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
