'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Receipt, LoaderCircle, Download, Printer } from 'lucide-react';
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

export default function PayslipsPage() {
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

    const monthLabel = months.find(m => m.value === month)?.label ?? '';

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Payslips"
                subtitle="View and manage generated payslips for your employees."
                icon={Receipt}
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
                        <ClayButton variant="pill" disabled leading={<Printer className="h-4 w-4" />}>
                            Print All
                        </ClayButton>
                    </>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">
                        Payslips for {monthLabel}, {year}
                    </h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">{payslips.length} payslips generated for this period.</p>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-clay-border bg-clay-surface-2">
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Employee</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Month / Year</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Gross</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Deductions</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Net Pay</th>
                                <th className="px-4 py-3 text-center text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Status</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Download</th>
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
                                payslips.map((p, idx) => (
                                    <tr key={p._id?.toString() ?? idx} className="border-b border-clay-border last:border-0 hover:bg-clay-surface-2/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-clay-ink">
                                                {p.employee?.firstName} {p.employee?.lastName}
                                            </div>
                                            <div className="text-[11.5px] text-clay-ink-muted">{p.employee?.designationName ?? '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-clay-ink">{monthLabel}, {year}</td>
                                        <td className="px-4 py-3 text-right font-mono text-clay-ink">₹{(p.grossSalary ?? 0).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-right font-mono text-clay-red">₹{(p.totalDeductions ?? 0).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-right font-mono font-semibold text-clay-ink">₹{(p.netPay ?? 0).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-center">{statusBadge(p.status)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <ClayButton variant="pill" size="sm" leading={<Download className="h-3.5 w-3.5" />} disabled>
                                                PDF
                                            </ClayButton>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No payslips generated for this period.
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
