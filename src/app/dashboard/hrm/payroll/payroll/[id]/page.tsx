import { Button, Card, Table, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
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
import type { CrmPayrollRunStatus } from '@/app/actions/crm-payroll-runs.actions';

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

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

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
        (rustRun.totals ? (rustRun.totals.gross - rustRun.totals.net) : undefined) ??
        payslips.reduce(
            (s: number, p: PayslipRow) =>
                s +
                (p.deductions ?? []).reduce(
                    (a, d) => a + (Number(d.amount) || 0),
                    0,
                ),
            0,
        );

    async function handleRecompute() {
        'use server';
        try {
            const { crmPayrollRunsApi } = await import('@/lib/rust-client/crm-payroll-runs');
            await crmPayrollRunsApi.compute(runId);
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
                    <div className="text-[14px] font-medium text-zoru-ink">Summary</div>
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3">
                    <div>
                        <div className="text-zoru-ink-muted">Period</div>
                        <div className="text-zoru-ink">{periodLabel}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Run date</div>
                        <div className="text-zoru-ink">{fmtDate(run.run_date)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Run by</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {run.run_by ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Employees</div>
                        <div className="font-mono text-zoru-ink">
                            {run.total_employees ?? 0}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Total gross</div>
                        <div className="font-mono text-zoru-ink">
                            {inr.format(run.total_gross ?? 0)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Total deductions</div>
                        <div className="font-mono text-zoru-ink">
                            {inr.format(totalDeductions)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Total net</div>
                        <div className="font-mono text-zoru-ink">
                            {inr.format(run.total_net ?? 0)}
                        </div>
                    </div>
                    {run.notes ? (
                        <div className="sm:col-span-3">
                            <div className="text-zoru-ink-muted">Notes</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {run.notes}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            {/* Payslips */}
            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                    Payslips · {payslips.length}
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Employee ID</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Gross</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Net</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted w-12"></ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {payslips.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={5} className="h-24 text-center text-zoru-ink-muted">
                                        No payslips for this period.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                payslips.map((p, i) => (
                                    <ZoruTableRow
                                        key={p._id ?? `${p.employeeId}-${i}`}
                                        className="border-zoru-line"
                                    >
                                        <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                            {p.employeeId ?? '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                            {inr.format(p.grossSalary ?? 0)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                            {inr.format(p.netPay ?? 0)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="capitalize text-zoru-ink">
                                            {(p.status ?? '—').replace(/_/g, ' ')}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {status === 'draft' && (
                                                <form action={handleRecompute}>
                                                    <Button variant="ghost" size="sm" type="submit" title="Re-calculate payslip">
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                </form>
                                            )}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>
            </Card>
        </EntityDetailShell>
    );
}
