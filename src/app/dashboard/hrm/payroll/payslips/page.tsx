'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Receipt, LoaderCircle, Download, Printer } from 'lucide-react';
import { startOfMonth } from 'date-fns';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
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
    if (status === 'paid') return <ZoruBadge variant="success">Paid</ZoruBadge>;
    if (status === 'pending') return <ZoruBadge variant="warning">Pending</ZoruBadge>;
    if (status === 'processing') return <ZoruBadge variant="info">Processing</ZoruBadge>;
    return <ZoruBadge variant="ghost">{status}</ZoruBadge>;
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
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                        <Receipt className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <ZoruPageHeader>
                        <ZoruPageHeading>
                            <ZoruPageTitle>Payslips</ZoruPageTitle>
                            <ZoruPageDescription>
                                View and manage generated payslips for your employees.
                            </ZoruPageDescription>
                        </ZoruPageHeading>
                    </ZoruPageHeader>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <ZoruSelect value={String(month)} onValueChange={val => setMonth(Number(val))}>
                        <ZoruSelectTrigger className="w-36"><ZoruSelectValue /></ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {months.map(m => <ZoruSelectItem key={m.value} value={String(m.value)}>{m.label}</ZoruSelectItem>)}
                        </ZoruSelectContent>
                    </ZoruSelect>
                    <ZoruSelect value={String(year)} onValueChange={val => setYear(Number(val))}>
                        <ZoruSelectTrigger className="w-28"><ZoruSelectValue /></ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {years.map(y => <ZoruSelectItem key={y} value={String(y)}>{y}</ZoruSelectItem>)}
                        </ZoruSelectContent>
                    </ZoruSelect>
                    <ZoruButton variant="outline" disabled>
                        <Printer className="h-4 w-4" />
                        Print All
                    </ZoruButton>
                </div>
            </div>

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">
                        Payslips for {monthLabel}, {year}
                    </h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">{payslips.length} payslips generated for this period.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 text-[12px] uppercase tracking-wide text-zoru-ink-muted">Employee</th>
                                <th className="px-4 py-3 text-[12px] uppercase tracking-wide text-zoru-ink-muted">Month / Year</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase tracking-wide text-zoru-ink-muted">Gross</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase tracking-wide text-zoru-ink-muted">Deductions</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase tracking-wide text-zoru-ink-muted">Net Pay</th>
                                <th className="px-4 py-3 text-center text-[12px] uppercase tracking-wide text-zoru-ink-muted">Status</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase tracking-wide text-zoru-ink-muted">Download</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-zoru-ink-muted" />
                                    </td>
                                </tr>
                            ) : payslips.length > 0 ? (
                                payslips.map((p, idx) => (
                                    <tr key={p._id?.toString() ?? idx} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="text-zoru-ink">
                                                {p.employee?.firstName} {p.employee?.lastName}
                                            </div>
                                            <div className="text-[11.5px] text-zoru-ink-muted">{p.employee?.designationName ?? '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-zoru-ink">{monthLabel}, {year}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">₹{(p.grossSalary ?? 0).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-danger-ink">₹{(p.totalDeductions ?? 0).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">₹{(p.netPay ?? 0).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-center">{statusBadge(p.status)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <ZoruButton variant="outline" size="sm" disabled>
                                                <Download className="h-3.5 w-3.5" />
                                                PDF
                                            </ZoruButton>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No payslips generated for this period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ZoruCard>
        </div>
    );
}
