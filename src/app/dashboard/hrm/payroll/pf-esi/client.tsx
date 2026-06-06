'use client';

import { Badge, Card, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useEffect,
  useTransition,
  useCallback } from 'react';
import { LoaderCircle } from 'lucide-react';
import { startOfMonth } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Download } from 'lucide-react';
import { getComplianceData } from './actions';
import { fmtINR } from '@/lib/utils';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
    { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
    { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
    { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' },
];

const PF_RATE = 12;
const ESI_RATE = 0.75;
const ESI_WAGE_CEILING = 21000;

export default function PfEsiClient({
    initialRows,
    initialMonth,
    initialYear,
}: {
    initialRows: any[];
    initialMonth: number;
    initialYear: number;
}) {
    const [rows, setRows] = useState<any[]>(initialRows);
    const [isLoading, startTransition] = useTransition();
    const [month, setMonth] = useState(initialMonth);
    const [year, setYear] = useState(initialYear);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getComplianceData(month, year);
            setRows(data);
        });
    }, [month, year]);

    useEffect(() => {
        if (isInitialLoad) {
            setIsInitialLoad(false);
            return;
        }
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, year]);

    const handleExportECR = () => {
        // ECR format: UAN#~#Member Name#~#Gross Wages#~#EPF Wages#~#EPS Wages#~#EDLI Wages#~#EE Share Remitted#~#EPS Share Remitted#~#ER Share Remitted#~#NCP Days#~#Refund of Advances
        if (rows.length === 0) return;
        let content = '';
        rows.forEach(row => {
            const uan = row.uan || '';
            const name = (row.employee?.firstName + ' ' + row.employee?.lastName) || '';
            const gross = Math.round(row.grossSalary || 0);
            const epfWages = Math.min(gross, 15000);
            const eeShare = Math.round(row.pf);
            const epsShare = Math.round(epfWages * 0.0833);
            const erShare = Math.round(epfWages * 0.0367);
            const ncpDays = 0; // Assuming 0 for now
            const refund = 0;
            content += `${uan}#~#${name}#~#${gross}#~#${epfWages}#~#${epfWages}#~#${epfWages}#~#${eeShare}#~#${epsShare}#~#${erShare}#~#${ncpDays}#~#${refund}\n`;
        });
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ECR_${months.find(m => m.value === month)?.label}_${year}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const totalPF = rows.reduce((s, r) => s + r.pf, 0);
    const totalESI = rows.reduce((s, r) => s + r.esi, 0);
    const periodLabel = `${months.find(m => m.value === month)?.label} ${year}`;

    return (
        <EntityListShell
            title="PF & ESI Compliance"
            subtitle={`Provident Fund and Employee State Insurance contributions for ${periodLabel}.`}
            primaryAction={
                <>
                    <Button variant="outline" size="sm" onClick={handleExportECR} disabled={rows.length === 0} className="h-9 gap-2">
                        <Download className="w-4 h-4" /> Export ECR
                    </Button>
                    <Select value={String(month)} onValueChange={val => setMonth(Number(val))}>
                        <SelectTrigger className="w-36 h-9 rounded-full border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={String(year)} onValueChange={val => setYear(Number(val))}>
                        <SelectTrigger className="w-28 h-9 rounded-full border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </>
            }
        >

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">Total PF Liability</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)]">{fmtINR(totalPF)}</div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">Employee share @ {PF_RATE}% of basic</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">Total ESI Liability</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)]">{fmtINR(totalESI)}</div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">Employee share @ {ESI_RATE}% (ceiling {fmtINR(ESI_WAGE_CEILING)})</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">Total Combined</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)]">{fmtINR(totalPF + totalESI)}</div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">{rows.length} employees this period</p>
                </Card>
            </div>

            <Card className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-[var(--st-text)]">Employee PF & ESI Breakdown</h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">Contribution details, registration numbers, and UAN per employee.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">Employee</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">Gross Salary</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">PF Rate (%)</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">PF Amount</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">ESI Rate (%)</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">ESI Amount</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">PF Number</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">ESI Number</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">UAN</th>
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
                                rows.map((row, idx) => (
                                    <tr key={row._id?.toString() ?? idx} className="border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)]/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-[var(--st-text)]">
                                                {row.employee?.firstName} {row.employee?.lastName}
                                            </div>
                                            <div className="text-[11.5px] text-[var(--st-text-secondary)]">{row.employee?.designationName ?? '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmtINR(row.grossSalary ?? 0)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{row.pfRate}%</td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmtINR(row.pf)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {row.esiApplicable ? `${row.esiRate}%` : <Badge variant="secondary">N/A</Badge>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {row.esiApplicable ? fmtINR(row.esi) : '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--st-text-secondary)]">{row.pfNumber}</td>
                                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--st-text-secondary)]">{row.esiNumber}</td>
                                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--st-text-secondary)]">{row.uan}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]">
                                        No payroll data for {periodLabel}. Generate payroll first.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                    <td colSpan={3} className="px-4 py-3 text-[12.5px] text-[var(--st-text)]">Totals</td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-[var(--st-text)]">{fmtINR(totalPF)}</td>
                                    <td />
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-[var(--st-text)]">{fmtINR(totalESI)}</td>
                                    <td colSpan={3} />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </Card>
        </EntityListShell>
    );
}
