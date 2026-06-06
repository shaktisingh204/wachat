import { Button, Card } from '@/components/sabcrm/20ui';
import {
  notFound,
  redirect } from 'next/navigation';
import {
  Download,
  Paperclip,
  Pencil,
  } from 'lucide-react';

/**
 * Form 16 detail page — server component.
 *
 * Loads the record by id via `getForm16ById` and renders a summary card.
 * The attached document (if present) is shown as a SabFile download link.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import {
    getForm16ById,
    type CrmForm16Status,
} from '@/app/actions/crm-form-16.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/form-16';

const STATUS_TONE: Record<CrmForm16Status, StatusTone> = {
    draft: 'amber',
    generated: 'blue',
    issued: 'green',
    archived: 'neutral',
};



function inr(n: unknown): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return `₹${n.toLocaleString('en-IN')}`;
}

export default async function Form16DetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const row = await getForm16ById(id);
    if (!row) notFound();

    const status = (row.status as CrmForm16Status | undefined) ?? 'draft';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const documentUrl = row.documentUrl as string | undefined;
    const employeeName = (row.employeeName as string | undefined) ?? '—';
    const financialYear = (row.financialYear as string | undefined) ?? '—';

    return (
        <EntityDetailShell
            eyebrow="FORM 16"
            title={`${employeeName}`}
            back={{ href: BASE, label: 'Form 16' }}
            actions={
                <div className="flex items-center gap-2">
                    {documentUrl ? (
                        <Button variant="outline" asChild>
                            <a
                                href={documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </a>
                        </Button>
                    ) : null}
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
                    <div className="text-[14px] font-medium text-[var(--st-text)]">Overview</div>
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
                        <div className="text-[var(--st-text-secondary)]">Financial year</div>
                        <div className="font-mono text-[var(--st-text)]">{financialYear}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">PAN</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {(row.pan as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">TAN of employer</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {(row.tanOfEmployer as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Generated at</div>
                        <div className="text-[var(--st-text)]">{fmtDate(row.generatedAt)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Total income</div>
                        <div className="font-mono text-[var(--st-text)]">{inr(row.totalIncome)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Tax deducted</div>
                        <div className="font-mono text-[var(--st-text)]">{inr(row.taxDeducted)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Generated by</div>
                        <div className="font-mono text-[12px] text-[var(--st-text)]">
                            {(row.generatedBy as string | undefined) ?? '—'}
                        </div>
                    </div>
                </div>
            </Card>

            {documentUrl ? (
                <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-2 text-[13px] text-[var(--st-text)]">
                        <Paperclip className="h-4 w-4 text-[var(--st-text-secondary)]" />
                        Attached document
                    </div>
                    <a
                        href={documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-full truncate text-[12.5px] text-[var(--st-text)] underline-offset-2 hover:underline"
                    >
                        {documentUrl}
                    </a>
                </Card>
            ) : null}
        </EntityDetailShell>
    );
}
