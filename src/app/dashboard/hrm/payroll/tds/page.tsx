'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { FileMinus, LoaderCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { startOfMonth, format } from 'date-fns';

import { ClayCard, ClayBadge } from '@/components/clay';
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
    if (regime === 'new') return <ClayBadge tone="blue">New Regime</ClayBadge>;
    return <ClayBadge tone="amber">Old Regime</ClayBadge>;
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
                        <Select value={String(month)} onValueChange={val => setMonth(Number(val))}>
                            <SelectTrigger className="w-36 h-9 rounded-full border-clay-border bg-clay-surface text-[13px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={String(year)} onValueChange={val => setYear(Number(val))}>
                            <SelectTrigger className="w-28 h-9 rounded-full border-clay-border bg-clay-surface text-[13px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </>
                }
            />

            <div className="grid gap-4 md:grid-cols-3">
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Total TDS Collected</p>
                    <div className="mt-2 text-2xl font-bold text-clay-ink">₹{totalTDS.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-clay-ink-muted">{periodLabel}</p>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Employees with TDS</p>
                    <div className="mt-2 text-2xl font-bold text-clay-ink">{rows.filter(r => r.tds > 0).length}</div>
                    <p className="mt-1 text-[11.5px] text-clay-ink-muted">out of {rows.length} employees</p>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Avg. TDS per Employee</p>
                    <div className="mt-2 text-2xl font-bold text-clay-ink">
                        ₹{rows.length > 0 ? Math.round(totalTDS / rows.filter(r => r.tds > 0).length || 0).toLocaleString('en-IN') : 0}
                    </div>
                    <p className="mt-1 text-[11.5px] text-clay-ink-muted">among applicable employees</p>
                </ClayCard>
            </div>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">TDS Deduction Details</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Per-employee breakdown with PAN, tax regime, and deduction date.</p>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-clay-border bg-clay-surface-2">
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Employee</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">PAN Number</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Tax Regime</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Gross Salary</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">TDS Amount</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Month</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Deduction Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-clay-ink-muted" />
                                    </td>
                                </tr>
                            ) : rows.length > 0 ? (
                                rows.map((row, idx) => (
                                    <tr key={row._id?.toString() ?? idx} className="border-b border-clay-border last:border-0 hover:bg-clay-surface-2/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-clay-ink">
                                                {row.employee?.firstName} {row.employee?.lastName}
                                            </div>
                                            <div className="text-[11.5px] text-clay-ink-muted">{row.employee?.designationName ?? '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-[12px] text-clay-ink">{row.pan}</td>
                                        <td className="px-4 py-3">{regimeBadge(row.taxRegime)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-clay-ink">₹{(row.grossSalary ?? 0).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-right font-mono font-semibold text-clay-ink">
                                            {row.tds > 0 ? `₹${row.tds.toLocaleString('en-IN')}` : <ClayBadge tone="neutral">Nil</ClayBadge>}
                                        </td>
                                        <td className="px-4 py-3 text-clay-ink">{periodLabel}</td>
                                        <td className="px-4 py-3 text-clay-ink-muted">{row.deductionDate}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No TDS data for {periodLabel}.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-clay-border bg-clay-surface-2">
                                    <td colSpan={4} className="px-4 py-3 text-[12.5px] font-semibold text-clay-ink">Total TDS</td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] font-bold text-clay-ink">₹{totalTDS.toLocaleString('en-IN')}</td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </ClayCard>
        </div>
    );
}
