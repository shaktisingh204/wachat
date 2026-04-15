'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { DollarSign, LoaderCircle, Play, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { startOfMonth } from 'date-fns';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmEmployee } from '@/lib/definitions';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
    { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
    { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
    { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' },
];

function statusBadge(status: string) {
    if (status === 'paid') return <ClayBadge tone="green" dot>Paid</ClayBadge>;
    if (status === 'pending') return <ClayBadge tone="amber" dot>Pending</ClayBadge>;
    if (status === 'processing') return <ClayBadge tone="blue" dot>Processing</ClayBadge>;
    return <ClayBadge tone="neutral">{status}</ClayBadge>;
}

export default function PayrollRunPage() {
    const [payslips, setPayslips] = useState<any[]>([]);
    const [, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(currentYear);
    const [isLoading, startTransition] = useTransition();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const period = startOfMonth(new Date(year, month));
            const [payslipsData, employeesData] = await Promise.all([
                getPayslips(period),
                getCrmEmployees(),
            ]);
            const employeeMap = new Map(employeesData.map(e => [e._id.toString(), e]));
            const populated = payslipsData.map(p => ({
                ...p,
                employee: employeeMap.get(p.employeeId.toString()),
            }));
            setPayslips(populated);
            setEmployees(employeesData);
        });
    }, [month, year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const totalGross = payslips.reduce((s, p) => s + (p.grossSalary ?? 0), 0);
    const totalNet = payslips.reduce((s, p) => s + (p.netPay ?? 0), 0);
    const totalDeductions = payslips.reduce((s, p) => s + (p.totalDeductions ?? 0), 0);
    const periodLabel = `${months.find(m => m.value === month)?.label} ${year}`;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Payroll Run"
                subtitle={`Manage and disburse salaries for ${periodLabel}.`}
                icon={DollarSign}
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
                        <ClayButton variant="obsidian" leading={<Play className="h-4 w-4" />} disabled={isLoading}>
                            Run Payroll
                        </ClayButton>
                    </>
                }
            />

            <div className="grid gap-4 md:grid-cols-3">
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Total Gross Salary</p>
                    <div className="mt-2 text-2xl font-bold text-clay-ink">₹{totalGross.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-clay-ink-muted">{payslips.length} employees</p>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Total Deductions</p>
                    <div className="mt-2 text-2xl font-bold text-clay-ink">₹{totalDeductions.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-clay-ink-muted">PF + ESI + TDS + PT</p>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Total Net Pay</p>
                    <div className="mt-2 text-2xl font-bold text-clay-ink">₹{totalNet.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-clay-ink-muted">Amount to be disbursed</p>
                </ClayCard>
            </div>

            <ClayCard>
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] font-semibold text-clay-ink">Payroll Register — {periodLabel}</h2>
                        <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Review each employee's salary breakdown before disbursement.</p>
                    </div>
                    <ClayButton variant="pill" size="sm" leading={<CheckCircle className="h-3.5 w-3.5" />} disabled>
                        Mark All Paid
                    </ClayButton>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-clay-border bg-clay-surface-2">
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Employee</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Designation</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Basic Salary</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Allowances</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Deductions</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Net Pay</th>
                                <th className="px-4 py-3 text-center text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-clay-ink-muted" />
                                    </td>
                                </tr>
                            ) : payslips.length > 0 ? (
                                payslips.map((p, idx) => {
                                    const basic = p.earnings?.find((e: any) => e.name?.toLowerCase().includes('basic'))?.amount ?? 0;
                                    const allowances = (p.grossSalary ?? 0) - basic;
                                    return (
                                        <tr key={p._id?.toString() ?? idx} className="border-b border-clay-border last:border-0 hover:bg-clay-surface-2/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-clay-ink">
                                                    {p.employee?.firstName} {p.employee?.lastName}
                                                </div>
                                                <div className="text-[11.5px] text-clay-ink-muted">{p.employee?.employeeId ?? '—'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-clay-ink">{p.employee?.designationName ?? '—'}</td>
                                            <td className="px-4 py-3 text-right font-mono text-clay-ink">₹{basic.toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right font-mono text-clay-ink">₹{allowances.toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right font-mono text-clay-red">₹{(p.totalDeductions ?? 0).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-clay-ink">₹{(p.netPay ?? 0).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-center">{statusBadge(p.status)}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="h-24 text-center text-clay-ink-muted">
                                        No payroll data for {periodLabel}. Click &ldquo;Run Payroll&rdquo; to generate.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {payslips.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-clay-border bg-clay-surface-2">
                                    <td colSpan={2} className="px-4 py-3 text-[12.5px] font-semibold text-clay-ink">Totals</td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] font-semibold text-clay-ink">
                                        ₹{payslips.reduce((s, p) => s + (p.earnings?.find((e: any) => e.name?.toLowerCase().includes('basic'))?.amount ?? 0), 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] font-semibold text-clay-ink">
                                        ₹{payslips.reduce((s, p) => { const basic = p.earnings?.find((e: any) => e.name?.toLowerCase().includes('basic'))?.amount ?? 0; return s + ((p.grossSalary ?? 0) - basic); }, 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] font-semibold text-clay-red">₹{totalDeductions.toLocaleString('en-IN')}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] font-bold text-clay-ink">₹{totalNet.toLocaleString('en-IN')}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </ClayCard>
        </div>
    );
}
