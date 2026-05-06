'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { DollarSign, LoaderCircle, Play, CheckCircle } from 'lucide-react';
import { startOfMonth } from 'date-fns';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
} from '@/components/zoruui';
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
    if (status === 'paid') return <ZoruBadge variant="success">Paid</ZoruBadge>;
    if (status === 'pending') return <ZoruBadge variant="warning">Pending</ZoruBadge>;
    if (status === 'processing') return <ZoruBadge variant="info">Processing</ZoruBadge>;
    return <ZoruBadge variant="secondary">{status}</ZoruBadge>;
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
                        <ZoruButton disabled={isLoading}>
                            <Play className="h-4 w-4" />
                            Run Payroll
                        </ZoruButton>
                    </>
                }
            />

            <div className="grid gap-4 md:grid-cols-3">
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total Gross Salary</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalGross.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{payslips.length} employees</p>
                </ZoruCard>
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total Deductions</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalDeductions.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">PF + ESI + TDS + PT</p>
                </ZoruCard>
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total Net Pay</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalNet.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">Amount to be disbursed</p>
                </ZoruCard>
            </div>

            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">Payroll Register — {periodLabel}</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">Review each employee&apos;s salary breakdown before disbursement.</p>
                    </div>
                    <ZoruButton variant="outline" size="sm" disabled>
                        <CheckCircle className="h-3.5 w-3.5" />
                        Mark All Paid
                    </ZoruButton>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Employee</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Designation</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Basic Salary</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Allowances</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Deductions</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Net Pay</th>
                                <th className="px-4 py-3 text-center text-[12px] uppercase text-zoru-ink-muted">Status</th>
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
                                payslips.map((p, idx) => {
                                    const basic = p.earnings?.find((e: any) => e.name?.toLowerCase().includes('basic'))?.amount ?? 0;
                                    const allowances = (p.grossSalary ?? 0) - basic;
                                    return (
                                        <tr key={p._id?.toString() ?? idx} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-zoru-ink">
                                                    {p.employee?.firstName} {p.employee?.lastName}
                                                </div>
                                                <div className="text-[11.5px] text-zoru-ink-muted">{p.employee?.employeeId ?? '—'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-zoru-ink">{p.employee?.designationName ?? '—'}</td>
                                            <td className="px-4 py-3 text-right font-mono text-zoru-ink">₹{basic.toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right font-mono text-zoru-ink">₹{allowances.toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right font-mono text-zoru-danger-ink">₹{(p.totalDeductions ?? 0).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right font-mono text-zoru-ink">₹{(p.netPay ?? 0).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-center">{statusBadge(p.status)}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="h-24 text-center text-zoru-ink-muted">
                                        No payroll data for {periodLabel}. Click &ldquo;Run Payroll&rdquo; to generate.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {payslips.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-zoru-line bg-zoru-surface-2">
                                    <td colSpan={2} className="px-4 py-3 text-[12.5px] text-zoru-ink">Totals</td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">
                                        ₹{payslips.reduce((s, p) => s + (p.earnings?.find((e: any) => e.name?.toLowerCase().includes('basic'))?.amount ?? 0), 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">
                                        ₹{payslips.reduce((s, p) => { const basic = p.earnings?.find((e: any) => e.name?.toLowerCase().includes('basic'))?.amount ?? 0; return s + ((p.grossSalary ?? 0) - basic); }, 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-danger-ink">₹{totalDeductions.toLocaleString('en-IN')}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">₹{totalNet.toLocaleString('en-IN')}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </ZoruCard>
        </div>
    );
}
