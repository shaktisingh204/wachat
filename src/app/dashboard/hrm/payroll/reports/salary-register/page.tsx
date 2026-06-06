'use client';

import { Button, Card, Label, Popover, ZoruPopoverContent, ZoruPopoverTrigger, useZoruToast } from '@/components/sabcrm/20ui/compat';
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
import { generateSalaryRegisterData } from '@/app/actions/crm-hr-reports.actions';
import Papa from 'papaparse';

import { EntityListShell } from '@/components/crm/entity-list-shell';

type SalaryRow = {
    employeeId: string;
    employeeName: string;
    department: string;
    basic: number;
    hra: number;
    specialAllowance: number;
    otherEarnings: number;
    totalGross: number;
    pf: number;
    esi: number;
    tds: number;
    totalDeductions: number;
    netPay: number;
    ytdGross: number;
    ytdBasic: number;
    ytdPf: number;
    ytdTds: number;
    ytdDeductions: number;
    ytdNetPay: number;
};

type Summary = { totalGross: number; totalDeductions: number; totalNetPay: number; totalEmployees: number };

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const StatCard = ({ title, value, icon: Icon, sub }: { title: string; value: string; icon: React.ElementType; sub?: string }) => (
    <Card className="flex flex-col gap-1 p-6">
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">{title}</p>
            <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
        </div>
        <p className="mt-1 text-2xl text-[var(--st-text)]">{value}</p>
        {sub ? <p className="text-[11.5px] text-[var(--st-text-secondary)]">{sub}</p> : null}
    </Card>
);

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

export default function SalaryRegisterPage() {
    const [reportData, setReportData] = useState<SalaryRow[]>([]);
    const [summary, setSummary] = useState<Summary>({ totalGross: 0, totalDeductions: 0, totalNetPay: 0, totalEmployees: 0 });
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateSalaryRegisterData({
                month: selectedMonth,
                year: selectedYear,
            });
            if (result.error) {
                toast({ title: 'Error generating report', description: result.error, variant: 'destructive' });
            } else {
                setReportData(result.data ?? []);
                setSummary(result.summary ?? { totalGross: 0, totalDeductions: 0, totalNetPay: 0, totalEmployees: 0 });
            }
        });
    }, [selectedMonth, selectedYear, toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDownload = () => {
        if (reportData.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to download.' });
            return;
        }
        const csv = Papa.unparse(reportData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salary_register_${MONTHS[selectedMonth - 1]}_${selectedYear}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <EntityListShell
            title="Salary Register"
            subtitle="Detailed salary component breakdown — earnings and deductions for every employee."
            primaryAction={
                <>
                    <Popover>
                        <ZoruPopoverTrigger asChild>
                            <Button variant="outline">
                                <SlidersHorizontal className="h-4 w-4" />
                                Period
                            </Button>
                        </ZoruPopoverTrigger>
                            <ZoruPopoverContent className="w-64 space-y-4 p-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Month</Label>
                                    <select
                                        value={selectedMonth}
                                        onChange={e => setSelectedMonth(Number(e.target.value))}
                                        className="w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[13px] text-[var(--st-text)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Year</Label>
                                    <select
                                        value={selectedYear}
                                        onChange={e => setSelectedYear(Number(e.target.value))}
                                        className="w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[13px] text-[var(--st-text)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <Button onClick={fetchData} disabled={isLoading} className="w-full">
                                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Apply
                                </Button>
                            </ZoruPopoverContent>
                        </Popover>
                        <Button
                            variant="outline"
                            onClick={handleDownload}
                            disabled={isLoading || reportData.length === 0}
                        >
                            <Download className="h-4 w-4" />
                            Download CSV
                        </Button>
                    </>
                }
        >

            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Employees" value={summary.totalEmployees.toLocaleString()} icon={Users} />
                <StatCard title="Total Gross" value={fmt(summary.totalGross)} icon={IndianRupee} sub={`${MONTHS[selectedMonth - 1]} ${selectedYear}`} />
                <StatCard title="Total Deductions" value={fmt(summary.totalDeductions)} icon={TrendingDown} />
                <StatCard title="Total Net Pay" value={fmt(summary.totalNetPay)} icon={Wallet} />
            </div>

            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] text-[var(--st-text)]">Register Details</h2>
                        <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                            {MONTHS[selectedMonth - 1]} {selectedYear}
                        </p>
                    </div>
                    {reportData.length > 0 && (
                        <span className="text-[12.5px] text-[var(--st-text-secondary)]">{reportData.length} employee{reportData.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                <th className="sticky left-0 z-20 bg-[var(--st-bg-muted)] w-[180px] min-w-[180px] px-4 py-3 font-medium text-[var(--st-text-secondary)]">Employee</th>
                                <th className="sticky left-[180px] z-20 bg-[var(--st-bg-muted)] border-r border-[var(--st-border)] w-[140px] min-w-[140px] px-4 py-3 font-medium text-[var(--st-text-secondary)] shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">Department</th>
                                {/* Earnings */}
                                <th className="border-l border-[var(--st-border)] px-4 py-3 text-right font-medium text-[var(--st-text)]">Basic</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]">HRA</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]">Spl. Allow.</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]">Other</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]">Total Gross</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]/80">YTD Gross</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]/80">YTD Basic</th>
                                {/* Deductions */}
                                <th className="border-l border-[var(--st-border)] px-4 py-3 text-right font-medium text-[var(--st-text)]">PF</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]/80">YTD PF</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]">ESI</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]">TDS</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]/80">YTD TDS</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]">Total Deductions</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]/80">YTD Deductions</th>
                                {/* Net */}
                                <th className="border-l border-[var(--st-border)] px-4 py-3 text-right font-medium text-[var(--st-text)]">Net Pay</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text-secondary)]">YTD Net Pay</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={15} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
                                    </td>
                                </tr>
                            ) : reportData.length > 0 ? (
                                <>
                                    {reportData.map(row => (
                                        <tr key={row.employeeId} className="group border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)]/50 transition-colors">
                                            <td className="sticky left-0 z-10 w-[180px] min-w-[180px] bg-[var(--st-bg)] group-hover:bg-[var(--st-bg-muted)] px-4 py-3 font-medium text-[var(--st-text)] transition-colors">{row.employeeName}</td>
                                            <td className="sticky left-[180px] z-10 w-[140px] min-w-[140px] bg-[var(--st-bg)] group-hover:bg-[var(--st-bg-muted)] border-r border-[var(--st-border)] px-4 py-3 text-[var(--st-text-secondary)] transition-colors shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">{row.department}</td>
                                            {/* Earnings */}
                                            <td className="border-l border-[var(--st-border)] px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(row.basic)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(row.hra)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(row.specialAllowance)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(row.otherEarnings)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--st-text)]">{fmt(row.totalGross)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]/80">{fmt(row.ytdGross)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]/80">{fmt(row.ytdBasic)}</td>
                                            {/* Deductions */}
                                            <td className="border-l border-[var(--st-border)] px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(row.pf)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]/80">{fmt(row.ytdPf)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(row.esi)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(row.tds)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]/80">{fmt(row.ytdTds)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--st-text)]">{fmt(row.totalDeductions)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]/80">{fmt(row.ytdDeductions)}</td>
                                            {/* Net */}
                                            <td className="border-l border-[var(--st-border)] px-4 py-3 text-right font-mono font-bold text-[var(--st-text)]">{fmt(row.netPay)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-medium text-[var(--st-text-secondary)]">{fmt(row.ytdNetPay)}</td>
                                        </tr>
                                    ))}
                                    {/* Totals row */}
                                    <tr className="border-t-2 border-[var(--st-border)] bg-[var(--st-bg-muted)] font-semibold">
                                        <td className="sticky left-0 z-10 w-[180px] min-w-[180px] bg-[var(--st-bg-muted)] px-4 py-3 text-[var(--st-text)]" colSpan={1}>Totals</td>
                                        <td className="sticky left-[180px] z-10 w-[140px] min-w-[140px] bg-[var(--st-bg-muted)] border-r border-[var(--st-border)] px-4 py-3 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]"></td>
                                        <td className="border-l border-[var(--st-border)] px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {fmt(reportData.reduce((s, r) => s + r.basic, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {fmt(reportData.reduce((s, r) => s + r.hra, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {fmt(reportData.reduce((s, r) => s + r.specialAllowance, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {fmt(reportData.reduce((s, r) => s + r.otherEarnings, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {fmt(summary.totalGross)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]/80">
                                            {fmt(reportData.reduce((s, r) => s + r.ytdGross, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]/80">
                                            {fmt(reportData.reduce((s, r) => s + r.ytdBasic, 0))}
                                        </td>
                                        <td className="border-l border-[var(--st-border)] px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {fmt(reportData.reduce((s, r) => s + r.pf, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]/80">
                                            {fmt(reportData.reduce((s, r) => s + r.ytdPf, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {fmt(reportData.reduce((s, r) => s + r.esi, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {fmt(reportData.reduce((s, r) => s + r.tds, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]/80">
                                            {fmt(reportData.reduce((s, r) => s + r.ytdTds, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {fmt(summary.totalDeductions)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]/80">
                                            {fmt(reportData.reduce((s, r) => s + r.ytdDeductions, 0))}
                                        </td>
                                        <td className="border-l border-[var(--st-border)] px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {fmt(summary.totalNetPay)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text-secondary)]">
                                            {fmt(reportData.reduce((s, r) => s + r.ytdNetPay, 0))}
                                        </td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td colSpan={15} className="h-24 text-center text-[var(--st-text-secondary)]">
                                        No salary data found for the selected period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </EntityListShell>
    );
}
