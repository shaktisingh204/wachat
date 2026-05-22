import { Button, Card } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * TDS record detail page — server component.
 * Also fetches the employee+FY scoped TDS view (`getTdsRecordsByEmployeeFY`)
 * so quarterly totals appear inline.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import {
    getTdsRecordById,
    getTdsRecordsByEmployeeFY,
    type CrmTdsStatus,
} from '@/app/actions/crm-tds.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/tds';

const STATUS_TONE: Record<CrmTdsStatus, StatusTone> = {
    pending: 'amber',
    deposited: 'blue',
    filed: 'green',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function inr(n: unknown): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return `₹${n.toLocaleString('en-IN')}`;
}

export default async function TdsDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const row = await getTdsRecordById(id);
    if (!row) notFound();

    const status = (row.status as CrmTdsStatus | undefined) ?? 'pending';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const employeeName = (row.employeeName as string | undefined) ?? '—';
    const financialYear = (row.financialYear as string | undefined) ?? '—';
    const quarter = (row.quarter as string | undefined) ?? '—';
    const employeeId = (row.employeeId as string | undefined) ?? '';

    const fyView = employeeId
        ? await getTdsRecordsByEmployeeFY(employeeId, financialYear)
        : [];
    const fyTotal = fyView.reduce(
        (s, r) => s + (typeof r.tdsAmount === 'number' ? (r.tdsAmount as number) : 0),
        0,
    );

    return (
        <EntityDetailShell
            eyebrow="TDS"
            title={employeeName}
            back={{ href: BASE, label: 'TDS' }}
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
                    <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
                    <StatusPill label={status} tone={tone} />
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Gross amount</div>
                        <div className="font-mono text-zoru-ink">{inr(row.grossAmount)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">TDS amount</div>
                        <div className="font-mono text-zoru-ink">{inr(row.tdsAmount)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Certificate number</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {(row.certificateNumber as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Deposit challan</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {(row.depositChallanNumber as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Deposit date</div>
                        <div className="text-zoru-ink">{fmtDate(row.depositDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Employee ID</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {employeeId || '—'}
                        </div>
                    </div>
                    {row.notes ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Notes</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {row.notes as string}
                            </div>
                        </div>
                    ) : null}
                </div>
            </ZoruCard>

            {fyView.length > 0 ? (
                <ZoruCard className="p-6">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-[14px] font-medium text-zoru-ink">
                            Quarterly view — {employeeName} · FY {financialYear}
                        </div>
                        <div className="text-[12.5px] text-zoru-ink-muted">
                            FY total:{' '}
                            <span className="font-mono text-zoru-ink">{inr(fyTotal)}</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <table className="w-full text-left text-[13px]">
                            <thead>
                                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                    <th className="px-4 py-2 text-[12px] uppercase text-zoru-ink-muted">
                                        Quarter
                                    </th>
                                    <th className="px-4 py-2 text-right text-[12px] uppercase text-zoru-ink-muted">
                                        Gross
                                    </th>
                                    <th className="px-4 py-2 text-right text-[12px] uppercase text-zoru-ink-muted">
                                        TDS
                                    </th>
                                    <th className="px-4 py-2 text-[12px] uppercase text-zoru-ink-muted">
                                        Status
                                    </th>
                                    <th className="px-4 py-2 text-[12px] uppercase text-zoru-ink-muted">
                                        Deposited
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {fyView.map((q) => (
                                    <tr
                                        key={String(q._id)}
                                        className="border-b border-zoru-line last:border-0"
                                    >
                                        <td className="px-4 py-2 font-mono text-zoru-ink">
                                            {(q.quarter as string | undefined) ?? '—'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-zoru-ink">
                                            {inr(q.grossAmount)}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-zoru-ink">
                                            {inr(q.tdsAmount)}
                                        </td>
                                        <td className="px-4 py-2">
                                            <StatusPill
                                                label={(q.status as string | undefined) ?? '—'}
                                                tone={
                                                    STATUS_TONE[
                                                        ((q.status as CrmTdsStatus) ?? 'pending')
                                                    ] ?? 'neutral'
                                                }
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-zoru-ink-muted">
                                            {fmtDate(q.depositDate)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ZoruCard>
            ) : null}
        </EntityDetailShell>
    );
}
