import { Button, Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil, RefreshCw } from 'lucide-react';

/**
 * Payroll run detail page — summary card + per-employee payslip list.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import type { EntityStatusTone } from '@/components/crm/entity-detail-shell';

import { getSession } from '@/app/actions/user.actions';
import {
    getPayrollRunById,
    getPayrollRunPayslips,
} from '@/app/actions/crm-payroll-runs.actions';
import { fmtDate, fmtINR } from '@/lib/utils';
import type { CrmPayrollRunStatus } from '@/app/actions/crm-payroll-runs.actions.types';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/payroll';

const STATUS_TONE: Record<CrmPayrollRunStatus, EntityStatusTone> = {
    draft: 'amber',
    in_progress: 'blue',
    processed: 'green',
    paid: 'green',
    archived: 'neutral',
};

const MONTH_LABELS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
] as const;


interface PayslipRow {
    _id?: string;
    employeeId?: string;
    grossSalary?: number;
    netPay?: number;
    status?: string;
    earnings?: { name: string; amount: number }[];
    deductions?: { name: string; amount: number }[];
}

export default async function PayrollRunDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: runId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const run = await getPayrollRunById(runId);
    if (!run) notFound();

    const status = (run.status ?? 'draft') as CrmPayrollRunStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';
    const periodLabel = `${MONTH_LABELS[(run.period_month ?? 1) - 1]} ${run.period_year}`;

    const rustRun = run as any;
    const payslips: PayslipRow[] = rustRun.employees 
        ? rustRun.employees.map((e: any) => ({
            _id: e.employeeId,
            employeeId: e.employeeId,
            grossSalary: e.gross,
            netPay: e.net,
            status: run.status,
            earnings: e.earnings,
            deductions: e.deductions
          }))
        : (await getPayrollRunPayslips(runId)) as PayslipRow[];

    const totalDeductions =
        run.total_deductions ??
        (rustRun.totals ? (rustRun.totals.gross - rustRun.totals.net) : 0);

    async function handleRecompute(employeeId?: string | FormData) {
        'use server';
        try {
            const { rustFetch } = await import('@/lib/rust-client/fetcher');
            let url = `/v1/hrm/payroll-runs/${runId}/compute`;
            
            // If called from a form without .bind, employeeId will be a FormData object
            if (typeof employeeId === 'string' && employeeId) {
                url += `?employeeId=${encodeURIComponent(employeeId)}`;
            }
            
            await rustFetch(url, { method: 'POST' });
            
            const { revalidatePath } = await import('next/cache');
            revalidatePath(`/dashboard/hrm/payroll/payroll/${runId}`);
        } catch (e) {
            console.error('Failed to recompute payroll run:', e);
        }
    }

    return (
        <EntityDetailShell
            eyebrow="PAYROLL RUN"
            title={`Run · ${periodLabel}`}
            status={{ label: status.replace(/_/g, ' '), tone }}
            back={{ href: BASE, label: 'Payroll runs' }}
            actions={
                <Button asChild>
                    <Link href={`${BASE}/${runId}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit / finalize
                    </Link>
                </Button>
            }
        >
            {/* Summary card */}
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">Summary</div>
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Period</div>
                        <div className="text-[var(--st-text)]">{periodLabel}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Run date</div>
                        <div className="text-[var(--st-text)]">{fmtDate(run.run_date, 'MMM d, yyyy')}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Run by</div>
                        <div className="font-mono text-[12px] text-[var(--st-text)]">
                            {run.run_by ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Employees</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {run.total_employees ?? 0}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Total gross</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {fmtINR(run.total_gross ?? 0)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Total deductions</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {fmtINR(totalDeductions)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Total net</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {fmtINR(run.total_net ?? 0)}
                        </div>
                    </div>
                    {run.notes ? (
                        <div className="sm:col-span-3">
                            <div className="text-[var(--st-text-secondary)]">Notes</div>
                            <div className="whitespace-pre-wrap text-[var(--st-text)]">
                                {run.notes}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            {/* Payslips */}
            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
                    Payslips · {payslips.length}
                </div>
                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <Table>
                        <THead>
                            <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                <Th className="text-[var(--st-text-secondary)]">Employee ID</Th>
                                <Th className="text-[var(--st-text-secondary)] text-right">Gross</Th>
                                <Th className="text-[var(--st-text-secondary)] text-right">Net</Th>
                                <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                <Th className="text-[var(--st-text-secondary)] w-12"></Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {payslips.length === 0 ? (
                                <Tr className="border-[var(--st-border)]">
                                    <Td colSpan={5} className="h-24 text-center text-[var(--st-text-secondary)]">
                                        No payslips for this period.
                                    </Td>
                                </Tr>
                            ) : (
                                payslips.map((p, i) => (
                                    <Tr
                                        key={p._id ?? `${p.employeeId}-${i}`}
                                        className="border-[var(--st-border)]"
                                    >
                                        <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                            {p.employeeId ?? '—'}
                                        </Td>
                                        <Td className="text-right font-mono text-[var(--st-text)]">
                                            {fmtINR(p.grossSalary ?? 0)}
                                        </Td>
                                        <Td className="text-right font-mono text-[var(--st-text)]">
                                            {fmtINR(p.netPay ?? 0)}
                                        </Td>
                                        <Td className="capitalize text-[var(--st-text)]">
                                            {(p.status ?? '—').replace(/_/g, ' ')}
                                        </Td>
                                        <Td>
                                            {status === 'draft' && (
                                                <form action={handleRecompute.bind(null, p.employeeId)}>
                                                    <Button variant="ghost" size="sm" type="submit" title="Re-calculate payslip">
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                </form>
                                            )}
                                        </Td>
                                    </Tr>
                                ))
                            )}
                        </TBody>
                    </Table>
                </div>
            </Card>
        </EntityDetailShell>
    );
}
