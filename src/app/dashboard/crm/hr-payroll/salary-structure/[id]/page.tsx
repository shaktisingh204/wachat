import { ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Salary structure detail page (server component).
 *
 * Fetches a single structure by id via `getSalaryStructureDoc` and renders
 * a summary card with earnings / deductions / gross / net.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { getSession } from '@/app/actions/user.actions';
import { getSalaryStructureDoc } from '@/app/actions/crm-salary-structures.actions';
import type { CrmSalaryStructureStatus } from '@/lib/rust-client/crm-salary-structures';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr-payroll/salary-structure';

const STATUS_TONE: Record<CrmSalaryStructureStatus, StatusTone> = {
    active: 'green',
    archived: 'neutral',
};

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

export default async function SalaryStructureDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const doc = await getSalaryStructureDoc(id);
    if (!doc) notFound();

    const status = (doc.status ?? 'active') as CrmSalaryStructureStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';

    const computedGross =
        (doc.basic ?? 0) +
        (doc.hra ?? 0) +
        (doc.da ?? 0) +
        (doc.otherAllowances ?? 0);
    const computedDeductions =
        (doc.pfEmployee ?? 0) + (doc.esi ?? 0) + (doc.professionalTax ?? 0);
    const gross = doc.gross ?? computedGross;
    const net = doc.net ?? gross - computedDeductions;

    return (
        <EntityDetailShell
            title={`Structure · ${doc.employeeName ?? doc.employeeId}`}
            eyebrow="SALARY STRUCTURE"
            back={{ href: BASE, label: 'Salary structures' }}
            actions={
                <ZoruButton asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </ZoruButton>
            }
        >

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">
                        Overview
                    </div>
                    <StatusPill label={status} tone={tone} />
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Employee</div>
                        <div className="text-zoru-ink">
                            {doc.employeeName ?? '—'}
                        </div>
                        <div className="font-mono text-[11.5px] text-zoru-ink-muted">
                            {doc.employeeId}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Effective from</div>
                        <div className="text-zoru-ink">{fmtDate(doc.effectiveFrom)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Created at</div>
                        <div className="text-zoru-ink">{fmtDate(doc.createdAt)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Updated at</div>
                        <div className="text-zoru-ink">{fmtDate(doc.updatedAt)}</div>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4">
                        <div className="mb-2 text-[13px] font-medium text-zoru-ink">
                            Earnings
                        </div>
                        <dl className="space-y-1.5 text-[13px]">
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">Basic</dt>
                                <dd className="font-mono text-zoru-ink">
                                    {inr.format(doc.basic ?? 0)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">HRA</dt>
                                <dd className="font-mono text-zoru-ink">
                                    {inr.format(doc.hra ?? 0)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">DA</dt>
                                <dd className="font-mono text-zoru-ink">
                                    {inr.format(doc.da ?? 0)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">Other allowances</dt>
                                <dd className="font-mono text-zoru-ink">
                                    {inr.format(doc.otherAllowances ?? 0)}
                                </dd>
                            </div>
                            <div className="mt-2 flex items-center justify-between border-t border-zoru-line pt-2">
                                <dt className="font-medium text-zoru-ink">Gross</dt>
                                <dd className="font-mono font-medium text-zoru-ink">
                                    {inr.format(gross)}
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
                                <dt className="text-zoru-ink-muted">PF (employer)</dt>
                                <dd className="font-mono text-zoru-ink">
                                    {inr.format(doc.pfEmployer ?? 0)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">PF (employee)</dt>
                                <dd className="font-mono text-zoru-ink">
                                    {inr.format(doc.pfEmployee ?? 0)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">ESI</dt>
                                <dd className="font-mono text-zoru-ink">
                                    {inr.format(doc.esi ?? 0)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zoru-ink-muted">Professional tax</dt>
                                <dd className="font-mono text-zoru-ink">
                                    {inr.format(doc.professionalTax ?? 0)}
                                </dd>
                            </div>
                            <div className="mt-2 flex items-center justify-between border-t border-zoru-line pt-2">
                                <dt className="font-medium text-zoru-ink">
                                    Total deductions
                                </dt>
                                <dd className="font-mono font-medium text-zoru-ink">
                                    {inr.format(computedDeductions)}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4">
                    <div className="text-[14px] font-medium text-zoru-ink">
                        Net salary
                    </div>
                    <div className="font-mono text-[18px] font-medium text-zoru-ink">
                        {inr.format(net)}
                    </div>
                </div>
            </ZoruCard>
        </EntityDetailShell>
    );
}
