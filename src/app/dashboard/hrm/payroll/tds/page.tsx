'use client';

import { ZoruBadge, ZoruCard, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition,
  useCallback } from 'react';
import { FileMinus,
  LoaderCircle } from 'lucide-react';
import { startOfMonth,
  format } from 'date-fns';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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

function regimeBadge(regime: string) {
    if (regime === 'new') return <ZoruBadge variant="info">New Regime</ZoruBadge>;
    return <ZoruBadge variant="warning">Old Regime</ZoruBadge>;
}

export default function TdsPage() {
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

            const enriched = payslipsData
                .map(slip => {
                    const emp = employeeMap.get(slip.employeeId.toString());
                    const tds = slip.deductions.find((d: any) => d.name?.includes('Tax') || d.name?.includes('TDS'))?.amount ?? 0;
                    return {
                        ...slip,
                        employee: emp,
                        tds,
                        pan: (emp as any)?.pan ?? '—',
                        taxRegime: (emp as any)?.taxRegime ?? 'old',
                        deductionDate: format(period, 'dd MMM yyyy'),
                    };
                });

            setRows(enriched);
        });
    }, [month, year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const totalTDS = rows.reduce((s, r) => s + r.tds, 0);
    const monthLabel = months.find(m => m.value === month)?.label ?? '';
    const periodLabel = `${monthLabel} ${year}`;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="TDS Management"
                subtitle={`Tax Deducted at Source tracking for ${periodLabel}.`}
                icon={FileMinus}
                actions={
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
            />

            <div className="grid gap-4 md:grid-cols-3">
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total TDS Collected</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalTDS.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{periodLabel}</p>
                </ZoruCard>
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Employees with TDS</p>
                    <div className="mt-2 text-2xl text-zoru-ink">{rows.filter(r => r.tds > 0).length}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">out of {rows.length} employees</p>
                </ZoruCard>
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Avg. TDS per Employee</p>
                    <div className="mt-2 text-2xl text-zoru-ink">
                        ₹{rows.length > 0 ? Math.round(totalTDS / rows.filter(r => r.tds > 0).length || 0).toLocaleString('en-IN') : 0}
                    </div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">among applicable employees</p>
                </ZoruCard>
            </div>

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">TDS Deduction Details</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">Per-employee breakdown with PAN, tax regime, and deduction date.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Employee</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">PAN Number</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Tax Regime</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Gross Salary</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">TDS Amount</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Month</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Deduction Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="h-48 text-center">
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
                                        <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink">{row.pan}</td>
                                        <td className="px-4 py-3">{regimeBadge(row.taxRegime)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">₹{(row.grossSalary ?? 0).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                                            {row.tds > 0 ? `₹${row.tds.toLocaleString('en-IN')}` : <ZoruBadge variant="secondary">Nil</ZoruBadge>}
                                        </td>
                                        <td className="px-4 py-3 text-zoru-ink">{periodLabel}</td>
                                        <td className="px-4 py-3 text-zoru-ink-muted">{row.deductionDate}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No TDS data for {periodLabel}.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-zoru-line bg-zoru-surface-2">
                                    <td colSpan={4} className="px-4 py-3 text-[12.5px] text-zoru-ink">Total TDS</td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">₹{totalTDS.toLocaleString('en-IN')}</td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </ZoruCard>
        </div>
    );
}
