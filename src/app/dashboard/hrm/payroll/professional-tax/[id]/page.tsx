import { Button, Card } from '@/components/sabcrm/20ui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil, FileText, ExternalLink, Info } from 'lucide-react';

/**
 * Professional Tax record detail page — server component.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getPayslipsList } from '@/app/actions/crm-payslips.actions';
import {
    getProfessionalTaxRecordById,
    type CrmProfessionalTaxStatus,
} from '@/app/actions/crm-professional-tax.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/professional-tax';

const STATUS_TONE: Record<CrmProfessionalTaxStatus, StatusTone> = {
    pending: 'amber',
    deposited: 'blue',
    filed: 'green',
    archived: 'neutral',
};



function inr(n: unknown): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return `₹${n.toLocaleString('en-IN')}`;
}

export default async function ProfessionalTaxDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const row = await getProfessionalTaxRecordById(id);
    if (!row) notFound();

    const status =
        (row.status as CrmProfessionalTaxStatus | undefined) ?? 'pending';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const employeeName = (row.employeeName as string | undefined) ?? '—';
    const month = (row.month as string | undefined) ?? '—';
    const state = (row.state as string | undefined) ?? '—';

    let payslipId: string | undefined;
    if (row.employeeId && row.month) {
        const payslips = await getPayslipsList({
            employeeId: row.employeeId as string,
            payPeriod: row.month as string,
            limit: 1,
        });
        if (payslips.items.length > 0) {
            payslipId = payslips.items[0]._id;
        }
    }

    return (
        <EntityDetailShell
            eyebrow="PROFESSIONAL TAX"
            title={employeeName}
            back={{ href: BASE, label: 'Professional Tax' }}
            actions={
                <div className="flex items-center gap-2">
                    {payslipId && (
                        <Button variant="secondary" asChild>
                            <Link href={`/dashboard/hrm/payroll/payslips/${payslipId}`}>
                                <FileText className="mr-2 h-4 w-4" />
                                View Payslip
                                <ExternalLink className="ml-2 h-3 w-3 opacity-50" />
                            </Link>
                        </Button>
                    )}
                    <Button asChild>
                        <Link href={`${BASE}/${id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Link>
                    </Button>
                </div>
            }
        >

            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">
                        Overview
                    </div>
                    <StatusPill label={status} tone={tone} />
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Employee</div>
                        <div className="text-[var(--st-text)]">{employeeName}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Employee ID</div>
                        <div className="font-mono text-[12px] text-[var(--st-text)]">
                            {(row.employeeId as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">State</div>
                        <div className="text-[var(--st-text)]">{state}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Month</div>
                        <div className="font-mono text-[var(--st-text)]">{month}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Gross salary</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {inr(row.grossSalary)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">PT amount</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {inr(row.ptAmount)}
                        </div>
                    </div>
                    <div className="sm:col-span-2 rounded-md bg-[var(--st-bg-muted)] p-3 border border-[var(--st-border)] flex gap-3 items-start">
                        <Info className="h-4 w-4 text-[var(--st-text-secondary)] mt-0.5 shrink-0" />
                        <div>
                            <div className="text-[var(--st-text-secondary)] mb-1 text-[12px] font-medium uppercase tracking-wider">
                                Exact Slab Applied at Calculation Time
                            </div>
                            <div className="font-mono text-[13px] text-[var(--st-text)] bg-[var(--st-bg)] px-2 py-1 rounded inline-block border border-[var(--st-border-light)]">
                                {(row.slabApplied as string | undefined) ?? '—'}
                            </div>
                            <div className="text-[12px] text-[var(--st-text-secondary)] mt-1.5">
                                This value is stamped on the record permanently, ensuring the history remains accurate even if the state&apos;s PT slabs change in later years.
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Challan number</div>
                        <div className="font-mono text-[12px] text-[var(--st-text)]">
                            {(row.challanNumber as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Deposit date</div>
                        <div className="text-[var(--st-text)]">{fmtDate(row.depositDate)}</div>
                    </div>
                    {row.notes ? (
                        <div className="sm:col-span-2">
                            <div className="text-[var(--st-text-secondary)]">Notes</div>
                            <div className="whitespace-pre-wrap text-[var(--st-text)]">
                                {row.notes as string}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>
        </EntityDetailShell>
    );
}
