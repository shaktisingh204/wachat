import { ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Professional Tax record detail page — server component.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
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

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

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

    return (
        <EntityDetailShell
            eyebrow="PROFESSIONAL TAX"
            title={employeeName}
            back={{ href: BASE, label: 'Professional Tax' }}
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
                        <div className="text-zoru-ink">{employeeName}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Employee ID</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {(row.employeeId as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">State</div>
                        <div className="text-zoru-ink">{state}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Month</div>
                        <div className="font-mono text-zoru-ink">{month}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Gross salary</div>
                        <div className="font-mono text-zoru-ink">
                            {inr(row.grossSalary)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">PT amount</div>
                        <div className="font-mono text-zoru-ink">
                            {inr(row.ptAmount)}
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <div className="text-zoru-ink-muted">Slab applied</div>
                        <div className="font-mono text-[12.5px] text-zoru-ink">
                            {(row.slabApplied as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Challan number</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {(row.challanNumber as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Deposit date</div>
                        <div className="text-zoru-ink">{fmtDate(row.depositDate)}</div>
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
        </EntityDetailShell>
    );
}
