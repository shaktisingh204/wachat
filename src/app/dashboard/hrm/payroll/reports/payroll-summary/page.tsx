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

const DeltaBadge = ({ current, previous, invertColor }: { current: number, previous: number, invertColor?: boolean }) => {
    if (!previous || previous === 0) return null;
    if (current === previous) return <span className="text-[11px] text-[var(--st-text-secondary)] ml-2">No change</span>;
    
    const delta = ((current - previous) / previous) * 100;
    const isUp = delta > 0;
    const isGood = invertColor ? !isUp : isUp;

    return (
        <span className={`text-[11px] font-medium ml-2 px-1.5 py-0.5 rounded-full ${isGood ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' : 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'}`}>
            {isUp ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
        </span>
    );
};

const StatCard = ({ title, value, icon: Icon, sub, current, previous, invertColor }: { title: string; value: string; icon: React.ElementType; sub?: string; current?: number; previous?: number; invertColor?: boolean }) => (
    <Card className="flex flex-col gap-1 p-6">
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">{title}</p>
            <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
        </div>
        <div className="mt-1 flex items-end">
            <p className="text-2xl text-[var(--st-text)]">{value}</p>
            {current !== undefined && previous !== undefined && (
                <DeltaBadge current={current} previous={previous} invertColor={invertColor} />
            )}
        </div>
        {sub ? <p className="text-[11.5px] text-[var(--st-text-secondary)]">{sub}</p> : null}
    </Card>
);

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

export default function PayrollSummaryPage() {
    const [rows, setRows] = useState<PayrollRow[]>([]);
    const [prevRows, setPrevRows] = useState<PayrollRow[]>([]);
    const [totals, setTotals] = useState<Totals>({ grossSalary: 0, pf: 0, esi: 0, tds: 0, professionalTax: 0, totalDeductions: 0, netPay: 0 });
    const [previousTotals, setPreviousTotals] = useState<Totals | null>(null);
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
                setPrevRows(result.data.prevRows || []);
                setTotals(result.data.totals);
                setPreviousTotals(result.data.previousTotals || null);
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

    const handleTallyExport = () => {
        if (rows.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to export.' });
            return;
        }

        const dateStr = `${selectedYear}${String(selectedMonth).padStart(2, '0')}01`; // Or end of month
        const xml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>SabNode</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${dateStr}</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <NARRATION>Payroll for ${MONTHS[selectedMonth - 1]} ${selectedYear}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Salary Expense</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${totals.grossSalary}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>PF Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${totals.pf}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>ESI Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${totals.esi}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>TDS Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${totals.tds}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Professional Tax Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${totals.professionalTax}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Salary Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${totals.netPay}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

        const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tally_payroll_${MONTHS[selectedMonth - 1]}_${selectedYear}.xml`;
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
                    <Popover>
                        <ZoruPopoverTrigger asChild>
                            <Button variant="outline">
                                <SlidersHorizontal className="h-4 w-4" />
                                Filters
                            </Button>
                        </ZoruPopoverTrigger>
                            <ZoruPopoverContent className="w-72 space-y-4 p-4">
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
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Department</Label>
                                    <select
                                        value={selectedDept}
                                        onChange={e => setSelectedDept(e.target.value)}
                                        className="w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[13px] text-[var(--st-text)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">All Departments</option>
                                        {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <Button onClick={fetchData} disabled={isLoading} className="w-full">
                                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Apply Filters
                                </Button>
                            </ZoruPopoverContent>
                        </Popover>
                        <Button
                            variant="outline"
                            onClick={handleDownload}
                            disabled={isLoading || rows.length === 0}
                        >
                            <Download className="h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleTallyExport}
                            disabled={isLoading || rows.length === 0}
                        >
                            <Download className="h-4 w-4" />
                            Tally XML
                        </Button>
                    </>
                }
        >

            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Employees" value={totalEmployees.toLocaleString()} icon={Users} />
                <StatCard 
                    title="Total Gross Payroll" 
                    value={fmt(totals.grossSalary)} 
                    icon={IndianRupee} 
                    sub={`${MONTHS[selectedMonth - 1]} ${selectedYear}`}
                    current={totals.grossSalary}
                    previous={previousTotals?.grossSalary}
                />
                <StatCard 
                    title="Total Deductions" 
                    value={fmt(totals.totalDeductions)} 
                    icon={TrendingDown} 
                    current={totals.totalDeductions}
                    previous={previousTotals?.totalDeductions}
                    invertColor
                />
                <StatCard 
                    title="Total Net Pay" 
                    value={fmt(totals.netPay)} 
                    icon={Wallet} 
                    current={totals.netPay}
                    previous={previousTotals?.netPay}
                />
            </div>

            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] text-[var(--st-text)]">Payroll Breakdown</h2>
                        <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                            {MONTHS[selectedMonth - 1]} {selectedYear}
                        </p>
                    </div>
                    {rows.length > 0 && (
                        <span className="text-[12.5px] text-[var(--st-text-secondary)]">{rows.length} employee{rows.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                <th className="px-4 py-3 font-medium text-[var(--st-text-secondary)]">Employee</th>
                                <th className="px-4 py-3 font-medium text-[var(--st-text-secondary)]">Department</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text-secondary)]">Gross Salary</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text-secondary)]">PF</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text-secondary)]">ESI</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text-secondary)]">TDS</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text-secondary)]">Prof. Tax</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]">Total Deductions</th>
                                <th className="px-4 py-3 text-right font-medium text-[var(--st-text)]">Net Pay</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
                                    </td>
                                </tr>
                            ) : rows.length > 0 ? (
                                <>
                                    {rows.map(row => {
                                        const prevRow = prevRows.find(pr => pr.employeeId === row.employeeId);
                                        return (
                                        <tr key={row.employeeId} className="border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)]/50">
                                            <td className="px-4 py-3 font-medium text-[var(--st-text)]">{row.employeeName}</td>
                                            <td className="px-4 py-3 text-[var(--st-text-secondary)]">{row.department}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                                {fmt(row.grossSalary)}
                                                {prevRow && <><br/><DeltaBadge current={row.grossSalary} previous={prevRow.grossSalary} /></>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(row.pf)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(row.esi)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(row.tds)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(row.professionalTax)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--st-text)]">
                                                {fmt(row.totalDeductions)}
                                                {prevRow && <><br/><DeltaBadge current={row.totalDeductions} previous={prevRow.totalDeductions} invertColor /></>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-[var(--st-text)]">
                                                {fmt(row.netPay)}
                                                {prevRow && <><br/><DeltaBadge current={row.netPay} previous={prevRow.netPay} /></>}
                                            </td>
                                        </tr>
                                    )})}
                                    {/* Totals row */}
                                    <tr className="border-t-2 border-[var(--st-border)] bg-[var(--st-bg-muted)] font-semibold">
                                        <td className="px-4 py-3 text-[var(--st-text)]">Totals</td>
                                        <td className="px-4 py-3" />
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(totals.grossSalary)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(totals.pf)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(totals.esi)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(totals.tds)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(totals.professionalTax)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(totals.totalDeductions)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmt(totals.netPay)}</td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td colSpan={9} className="h-24 text-center text-[var(--st-text-secondary)]">
                                        No payroll data found for the selected period.
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
