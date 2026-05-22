'use client';

import {
  Badge,
  Button,
  Card,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition,
  useCallback } from 'react';
import { LoaderCircle,
  Play,
  CheckCircle } from 'lucide-react';
import { startOfMonth } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { useT } from '@/lib/i18n/client';
import type { WithId, CrmEmployee } from '@/lib/definitions';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const monthKeys = [
    'hrm.payroll.month.jan', 'hrm.payroll.month.feb', 'hrm.payroll.month.mar',
    'hrm.payroll.month.apr', 'hrm.payroll.month.may', 'hrm.payroll.month.jun',
    'hrm.payroll.month.jul', 'hrm.payroll.month.aug', 'hrm.payroll.month.sep',
    'hrm.payroll.month.oct', 'hrm.payroll.month.nov', 'hrm.payroll.month.dec',
];

export default function PayrollRunPage() {
    const { t } = useT();
    const months = monthKeys.map((key, value) => ({ value, label: t(key) }));

    function statusBadge(status: string) {
        if (status === 'paid') return <ZoruBadge variant="success">{t('hrm.payroll.run.status.paid')}</ZoruBadge>;
        if (status === 'pending') return <ZoruBadge variant="warning">{t('hrm.payroll.run.status.pending')}</ZoruBadge>;
        if (status === 'processing') return <ZoruBadge variant="info">{t('hrm.payroll.run.status.processing')}</ZoruBadge>;
        return <ZoruBadge variant="secondary">{status}</ZoruBadge>;
    }

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
        <EntityListShell
            title={t('hrm.payroll.run.title')}
            subtitle={t('hrm.payroll.run.subtitle', { period: periodLabel })}
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
                    <ZoruButton disabled={isLoading}>
                        <Play className="h-4 w-4" />
                        {t('hrm.payroll.run.action.run')}
                    </ZoruButton>
                </>
            }
        >

            <div className="grid gap-4 md:grid-cols-3">
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">{t('hrm.payroll.run.stat.gross')}</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalGross.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{t('hrm.payroll.run.stat.employees', { count: payslips.length })}</p>
                </ZoruCard>
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">{t('hrm.payroll.run.stat.deductions')}</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalDeductions.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{t('hrm.payroll.run.stat.deductionsSummary')}</p>
                </ZoruCard>
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">{t('hrm.payroll.run.stat.netPay')}</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalNet.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{t('hrm.payroll.run.stat.netPaySummary')}</p>
                </ZoruCard>
            </div>

            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">{t('hrm.payroll.run.register.title', { period: periodLabel })}</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">{t('hrm.payroll.run.register.subtitle')}</p>
                    </div>
                    <ZoruButton variant="outline" size="sm" disabled>
                        <CheckCircle className="h-3.5 w-3.5" />
                        {t('hrm.payroll.run.action.markAllPaid')}
                    </ZoruButton>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">{t('hrm.payroll.run.col.employee')}</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">{t('hrm.payroll.run.col.designation')}</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">{t('hrm.payroll.run.col.basic')}</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">{t('hrm.payroll.run.col.allowances')}</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">{t('hrm.payroll.run.col.deductions')}</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">{t('hrm.payroll.run.col.net')}</th>
                                <th className="px-4 py-3 text-center text-[12px] uppercase text-zoru-ink-muted">{t('hrm.payroll.run.col.status')}</th>
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
                                        {t('hrm.payroll.run.empty', { period: periodLabel })}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {payslips.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-zoru-line bg-zoru-surface-2">
                                    <td colSpan={2} className="px-4 py-3 text-[12.5px] text-zoru-ink">{t('hrm.payroll.run.totals')}</td>
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
        </EntityListShell>
    );
}
