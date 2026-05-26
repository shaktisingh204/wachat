'use client';

import { Badge, Card, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition,
  useCallback } from 'react';
import { LoaderCircle } from 'lucide-react';
import { startOfMonth } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { Button } from '@/components/zoruui';
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
                        <ZoruSelectTrigger className="w-36 h-9 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {months.map(m => <ZoruSelectItem key={m.value} value={String(m.value)}>{m.label}</ZoruSelectItem>)}
                        </ZoruSelectContent>
                    </Select>
                    <Select value={String(year)} onValueChange={val => setYear(Number(val))}>
                        <ZoruSelectTrigger className="w-28 h-9 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {years.map(y => <ZoruSelectItem key={y} value={String(y)}>{y}</ZoruSelectItem>)}
                        </ZoruSelectContent>
                    </Select>
                </>
            }
        >

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total PF Liability</p>
                    <div className="mt-2 text-2xl text-zoru-ink">{fmtINR(totalPF)}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">Employee share @ {PF_RATE}% of basic</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total ESI Liability</p>
                    <div className="mt-2 text-2xl text-zoru-ink">{fmtINR(totalESI)}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">Employee share @ {ESI_RATE}% (ceiling {fmtINR(ESI_WAGE_CEILING)})</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total Combined</p>
                    <div className="mt-2 text-2xl text-zoru-ink">{fmtINR(totalPF + totalESI)}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{rows.length} employees this period</p>
                </Card>
            </div>

            <Card className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">Employee PF & ESI Breakdown</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">Contribution details, registration numbers, and UAN per employee.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Employee</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Gross Salary</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">PF Rate (%)</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">PF Amount</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">ESI Rate (%)</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">ESI Amount</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">PF Number</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">ESI Number</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">UAN</th>
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
                                rows.map((row, idx) => (
                                    <tr key={row._id?.toString() ?? idx} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-zoru-ink">
                                                {row.employee?.firstName} {row.employee?.lastName}
                                            </div>
                                            <div className="text-[11.5px] text-zoru-ink-muted">{row.employee?.designationName ?? '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmtINR(row.grossSalary ?? 0)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">{row.pfRate}%</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">{fmtINR(row.pf)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                                            {row.esiApplicable ? `${row.esiRate}%` : <Badge variant="secondary">N/A</Badge>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                                            {row.esiApplicable ? fmtINR(row.esi) : '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink-muted">{row.pfNumber}</td>
                                        <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink-muted">{row.esiNumber}</td>
                                        <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink-muted">{row.uan}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No payroll data for {periodLabel}. Generate payroll first.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-zoru-line bg-zoru-surface-2">
                                    <td colSpan={3} className="px-4 py-3 text-[12.5px] text-zoru-ink">Totals</td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">{fmtINR(totalPF)}</td>
                                    <td />
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">{fmtINR(totalESI)}</td>
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
