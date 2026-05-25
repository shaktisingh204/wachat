import { Card } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Payslip detail page — per-employee breakdown card.
 */

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { PayslipDownloadButton } from './download-button';

import { getSession } from '@/app/actions/user.actions';
import { getPayslipDoc } from '@/app/actions/crm-payslips.actions';
import type { CrmPayslipStatus } from '@/lib/rust-client/crm-payslips';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/payslips';

const STATUS_TONE: Record<CrmPayslipStatus, EntityStatusTone> = {
    draft: 'amber',
    issued: 'blue',
    paid: 'green',
    archived: 'neutral',
};

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});



function fmtPeriod(p: string | undefined): string {
    if (!p) return '—';
    const m = /^(\d{4})-(\d{2})/.exec(p);
    if (!m) return p;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function FormattedAmount({ amount }: { amount: number | null | undefined }) {
    if (amount === null || amount === undefined) {
        return <span className="text-red-500 font-medium">N/A</span>;
    }
    return <>{inr.format(amount)}</>;
}

export default async function PayslipDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const payslip = await getPayslipDoc(id);
    if (!payslip) notFound();

    const status = (payslip.status ?? 'draft') as CrmPayslipStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';

    const hasMissingDeductions = [payslip.pf, payslip.esi, payslip.tax, payslip.deductions].some(v => v == null);
    const totalDeductions = hasMissingDeductions 
        ? null 
        : (payslip.pf || 0) + (payslip.esi || 0) + (payslip.tax || 0) + (payslip.deductions || 0);

    return (
        <EntityDetailShell
            eyebrow="PAYSLIP"
            title={`Payslip · ${payslip.employeeName ?? payslip.employeeId}`}
            status={{ label: status, tone }}
            back={{ href: BASE, label: 'Payslips' }}
            actions={
                <PayslipDownloadButton payslip={payslip} />
            }
        >
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">
                        Breakdown
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Employee</div>
                        <div className="text-zoru-ink">
                            {payslip.employeeName ?? '—'}
                        </div>
                        <div className="font-mono text-[11.5px] text-zoru-ink-muted">
                            {payslip.employeeId}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Pay period</div>
                        <div className="text-zoru-ink">
                            {fmtPeriod(payslip.payPeriod)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Issued at</div>
                        <div className="text-zoru-ink">
                            {fmtDate(payslip.issuedAt)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Created at</div>
                        <div className="text-zoru-ink">
                            {fmtDate(payslip.createdAt)}
                        </div>
                    </div>
                </div>

                {/* Earnings + Deductions */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4">
                        <div className="mb-2 text-[13px] font-medium text-zoru-ink">
                            Earnings
                        </div>
                        <dl className="space-y-1.5 text-[13px]">
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">Basic</dt>
                                <dd className="font-mono text-zoru-ink">
                                    <FormattedAmount amount={payslip.basic} />
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">HRA</dt>
                                <dd className="font-mono text-zoru-ink">
                                    <FormattedAmount amount={payslip.hra} />
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">Allowances</dt>
                                <dd className="font-mono text-zoru-ink">
                                    <FormattedAmount amount={payslip.allowances} />
                                </dd>
                            </div>
                            <div className="mt-2 flex items-center justify-between border-t border-zoru-line pt-2">
                                <dt className="font-medium text-zoru-ink">Gross</dt>
                                <dd className="font-mono font-medium text-zoru-ink">
                                    <FormattedAmount amount={payslip.gross} />
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4">
                        <div className="mb-2 text-[13px] font-medium text-zoru-ink">
                            Deductions
                        </div>
                        <dl className="space-y-1.5 text-[13px]">
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">PF</dt>
                                <dd className="font-mono text-zoru-ink">
                                    <FormattedAmount amount={payslip.pf} />
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">ESI</dt>
                                <dd className="font-mono text-zoru-ink">
                                    <FormattedAmount amount={payslip.esi} />
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">Tax</dt>
                                <dd className="font-mono text-zoru-ink">
                                    <FormattedAmount amount={payslip.tax} />
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">Other</dt>
                                <dd className="font-mono text-zoru-ink">
                                    <FormattedAmount amount={payslip.deductions} />
                                </dd>
                            </div>
                            <div className="mt-2 flex items-center justify-between border-t border-zoru-line pt-2">
                                <dt className="font-medium text-zoru-ink">Total deductions</dt>
                                <dd className="font-mono font-medium text-zoru-ink">
                                    <FormattedAmount amount={totalDeductions} />
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4">
                    <div className="text-[14px] font-medium text-zoru-ink">
                        Net pay
                    </div>
                    <div className="font-mono text-[18px] font-medium text-zoru-ink">
                        <FormattedAmount amount={payslip.net} />
                    </div>
                </div>
            </Card>
        </EntityDetailShell>
    );
}
