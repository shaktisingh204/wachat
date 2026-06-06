import { Button, Card } from '@/components/sabcrm/20ui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * PF/ESI record detail page — server component.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import {
    getPfEsiRecordById,
    getPfEsiRecords,
    type CrmPfEsiStatus,
} from '@/app/actions/crm-pf-esi.actions';

import { HistoricalContributionGraph } from '../_components/historical-graph';
import { ChallanUploader } from '../_components/challan-uploader';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/pf-esi';

const STATUS_TONE: Record<CrmPfEsiStatus, StatusTone> = {
    pending: 'amber',
    deposited: 'blue',
    filed: 'green',
    archived: 'neutral',
};



function inr(n: unknown): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return `₹${n.toLocaleString('en-IN')}`;
}

export default async function PfEsiDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const row = await getPfEsiRecordById(id);
    if (!row) notFound();

    const status = (row.status as CrmPfEsiStatus | undefined) ?? 'pending';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const employeeName = (row.employeeName as string | undefined) ?? '—';
    const month = (row.month as string | undefined) ?? '—';
    const employeeId = row.employeeId as string | undefined;

    let historyData: any[] = [];
    if (employeeId) {
        const { items } = await getPfEsiRecords({ employeeId, limit: 24 });
        historyData = items.map((item) => ({
            month: (item.month as string) || '—',
            pfEmployer: Number(item.pfEmployer) || 0,
            pfEmployee: Number(item.pfEmployee) || 0,
            esiEmployer: Number(item.esiEmployer) || 0,
            esiEmployee: Number(item.esiEmployee) || 0,
        }));
    }

    return (
        <EntityDetailShell
            eyebrow="PF & ESI"
            title={employeeName}
            back={{ href: BASE, label: 'PF / ESI' }}
            actions={
                <Button asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >

            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">Overview</div>
                    <StatusPill label={status} tone={tone} />
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">PF employer share</div>
                        <div className="font-mono text-[var(--st-text)]">{inr(row.pfEmployer)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">PF employee share</div>
                        <div className="font-mono text-[var(--st-text)]">{inr(row.pfEmployee)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">UAN</div>
                        <div className="font-mono text-[12px] text-[var(--st-text)]">
                            {(row.pfUan as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">ESI employer share</div>
                        <div className="font-mono text-[var(--st-text)]">{inr(row.esiEmployer)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">ESI employee share</div>
                        <div className="font-mono text-[var(--st-text)]">{inr(row.esiEmployee)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">ESI IC number</div>
                        <div className="font-mono text-[12px] text-[var(--st-text)]">
                            {(row.esiIcNumber as string | undefined) ?? '—'}
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
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Employee ID</div>
                        <div className="font-mono text-[12px] text-[var(--st-text)]">
                            {(row.employeeId as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div className="sm:col-span-3">
                        <div className="mb-2 text-[var(--st-text-secondary)]">Scanned Challan</div>
                        <div className="max-w-md">
                            <ChallanUploader
                                recordId={id}
                                initialUrl={row.documentUrl as string | null}
                            />
                        </div>
                    </div>
                    {row.notes ? (
                        <div className="sm:col-span-3">
                            <div className="text-[var(--st-text-secondary)]">Notes</div>
                            <div className="whitespace-pre-wrap text-[var(--st-text)]">
                                {row.notes as string}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            {employeeId && historyData.length > 0 && (
                <div className="mt-6">
                    <HistoricalContributionGraph data={historyData} />
                </div>
            )}
        </EntityDetailShell>
    );
}
