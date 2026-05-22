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
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
    { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
    { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
    { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' },
];

// Standard PF rate (employee share): 12% of basic salary
// Standard ESI rate (employee share): 0.75% of gross (applicable if gross ≤ ₹21,000)
const PF_RATE = 12;
const ESI_RATE = 0.75;
const ESI_WAGE_CEILING = 21000;

export default function PfEsiPage() {
    const [rows, setRows] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(currentYear);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const period = startOfMonth(new Date(year, month));
            const [payslipsData, employeesData] = await Promise.all([
                getPayslips(period),
                getCrmEmployees(),
            ]);
            const employeeMap = new Map(employeesData.map(e => [e._id.toString(), e]));

            const enriched = payslipsData.map(slip => {
                const emp = employeeMap.get(slip.employeeId.toString());
                const pf = slip.deductions.find((d: any) => d.name?.includes('PF') || d.name?.includes('Provident'))?.amount ?? 0;
                const esi = slip.deductions.find((d: any) => d.name?.includes('ESI'))?.amount ?? 0;
                const basic = slip.earnings?.find((e: any) => e.name?.toLowerCase().includes('basic'))?.amount ?? 0;
                const pfRate = basic > 0 ? ((pf / basic) * 100).toFixed(2) : PF_RATE.toFixed(2);
                const esiRate = slip.grossSalary > 0 ? ((esi / slip.grossSalary) * 100).toFixed(2) : ESI_RATE.toFixed(2);
                const esiApplicable = slip.grossSalary <= ESI_WAGE_CEILING;
                return {
                    ...slip,
                    employee: emp,
                    pf,
                    esi,
                    pfRate,
                    esiRate,
                    esiApplicable,
                    pfNumber: (emp as any)?.pfNumber ?? '—',
                    esiNumber: (emp as any)?.esiNumber ?? '—',
                    uan: (emp as any)?.uan ?? '—',
                };
            });

            setRows(enriched);
        });
    }, [month, year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const totalPF = rows.reduce((s, r) => s + r.pf, 0);
    const totalESI = rows.reduce((s, r) => s + r.esi, 0);
    const periodLabel = `${months.find(m => m.value === month)?.label} ${year}`;

    return (
        <EntityListShell
            title="PF & ESI Compliance"
            subtitle={`Provident Fund and Employee State Insurance contributions for ${periodLabel}.`}
            primaryAction={
                <>
                    <ZoruSelect value={String(month)} onValueChange={val => setMonth(Number(val))}>
                        <ZoruSelectTrigger className="w-36 h-9 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {months.map(m => <ZoruSelectItem key={m.value} value={String(m.value)}>{m.label}</ZoruSelectItem>)}
                        </ZoruSelectContent>
                    </ZoruSelect>
                    <ZoruSelect value={String(year)} onValueChange={val => setYear(Number(val))}>
                        <ZoruSelectTrigger className="w-28 h-9 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {years.map(y => <ZoruSelectItem key={y} value={String(y)}>{y}</ZoruSelectItem>)}
                        </ZoruSelectContent>
                    </ZoruSelect>
                </>
            }
        >

            <div className="grid gap-4 md:grid-cols-3">
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total PF Liability</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalPF.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">Employee share @ {PF_RATE}% of basic</p>
                </ZoruCard>
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total ESI Liability</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalESI.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">Employee share @ {ESI_RATE}% (ceiling ₹{ESI_WAGE_CEILING.toLocaleString('en-IN')})</p>
                </ZoruCard>
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total Combined</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{(totalPF + totalESI).toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{rows.length} employees this period</p>
                </ZoruCard>
            </div>

            <ZoruCard className="p-6">
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
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">₹{(row.grossSalary ?? 0).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">{row.pfRate}%</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">₹{row.pf.toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                                            {row.esiApplicable ? `${row.esiRate}%` : <ZoruBadge variant="secondary">N/A</ZoruBadge>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                                            {row.esiApplicable ? `₹${row.esi.toLocaleString('en-IN')}` : '—'}
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
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">₹{totalPF.toLocaleString('en-IN')}</td>
                                    <td />
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">₹{totalESI.toLocaleString('en-IN')}</td>
                                    <td colSpan={3} />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
