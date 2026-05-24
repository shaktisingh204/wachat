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
  Progress,
} from '@/components/zoruui';
import { useZoruToast } from '@/components/zoruui/use-zoru-toast';
import {
  useState,
  useEffect,
  useTransition,
  useCallback } from 'react';
import { LoaderCircle,
  Play,
  CheckCircle,
  Mail } from 'lucide-react';
import { startOfMonth } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPayslips, generatePayrollData, processPayroll, markPayrollPaid, sendPayslipsEmail } from '@/app/actions/crm-payroll.actions';
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
        if (status === 'paid') return <Badge variant="success">{t('hrm.payroll.run.status.paid')}</Badge>;
        if (status === 'pending') return <Badge variant="warning">{t('hrm.payroll.run.status.pending')}</Badge>;
        if (status === 'processing') return <Badge variant="info">{t('hrm.payroll.run.status.processing')}</Badge>;
        return <Badge variant="secondary">{status}</Badge>;
    }

    const [payslips, setPayslips] = useState<any[]>([]);
    const [, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(currentYear);
    const [isLoading, startTransition] = useTransition();
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressValue, setProgressValue] = useState(0);
    const { toast } = useZoruToast();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            try {
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
            } catch (error: any) {
                toast({ title: 'Error', description: error.message || 'Failed to fetch payroll data', variant: 'destructive' });
            }
        });
    }, [month, year, toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRunPayroll = async () => {
        setIsProcessing(true);
        setProgressValue(10);
        try {
            setProgressValue(40);
            const { payrollData, error: genError } = await generatePayrollData(month + 1, year);
            if (genError) throw new Error(genError);
            
            setProgressValue(70);
            if (payrollData && payrollData.length > 0) {
                const { success, error: procError } = await processPayroll(payrollData, month + 1, year);
                if (!success) throw new Error(procError || 'Failed to process payroll');
            }
            
            setProgressValue(100);
            toast({ title: 'Success', description: 'Payroll processed successfully.' });
            fetchData();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
                setProgressValue(0);
            }, 1000);
        }
    };

    const handleMarkAllPaid = async () => {
        startTransition(async () => {
            try {
                const { success, error } = await markPayrollPaid(month + 1, year);
                if (!success) throw new Error(error || 'Failed to mark as paid');
                toast({ title: 'Success', description: 'All payslips marked as paid.' });
                fetchData();
            } catch (err: any) {
                toast({ title: 'Error', description: err.message, variant: 'destructive' });
            }
        });
    };

    const handleSendEmails = async () => {
        startTransition(async () => {
            try {
                const { success, error } = await sendPayslipsEmail(month + 1, year);
                if (!success) throw new Error(error || 'Failed to send emails');
                toast({ title: 'Success', description: 'Payslips have been sent via email.' });
                fetchData();
            } catch (err: any) {
                toast({ title: 'Error', description: err.message, variant: 'destructive' });
            }
        });
    };

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
                    <Button disabled={isLoading || isProcessing} onClick={handleRunPayroll}>
                        <Play className="h-4 w-4" />
                        {t('hrm.payroll.run.action.run')}
                    </Button>
                </>
            }
        >
            {isProcessing && (
                <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between text-[13px] text-zoru-ink-muted">
                        <span>Processing payroll...</span>
                        <span>{progressValue}%</span>
                    </div>
                    <Progress value={progressValue} className="h-2 w-full" />
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">{t('hrm.payroll.run.stat.gross')}</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalGross.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{t('hrm.payroll.run.stat.employees', { count: payslips.length })}</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">{t('hrm.payroll.run.stat.deductions')}</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalDeductions.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{t('hrm.payroll.run.stat.deductionsSummary')}</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">{t('hrm.payroll.run.stat.netPay')}</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalNet.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{t('hrm.payroll.run.stat.netPaySummary')}</p>
                </Card>
            </div>

            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">{t('hrm.payroll.run.register.title', { period: periodLabel })}</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">{t('hrm.payroll.run.register.subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {payslips.length > 0 && payslips.every(p => p.status === 'paid') ? (
                            <Button variant="outline" size="sm" onClick={handleSendEmails} disabled={isLoading || isProcessing}>
                                <Mail className="h-3.5 w-3.5" />
                                Send all payslips via email
                            </Button>
                        ) : (
                            <Button variant="outline" size="sm" onClick={handleMarkAllPaid} disabled={isLoading || isProcessing || payslips.length === 0}>
                                <CheckCircle className="h-3.5 w-3.5" />
                                {t('hrm.payroll.run.action.markAllPaid')}
                            </Button>
                        )}
                    </div>
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
            </Card>
        </EntityListShell>
    );
}
