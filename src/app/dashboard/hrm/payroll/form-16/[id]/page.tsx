import { ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import {
    ArrowLeft,
  Download,
  FileText,
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

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'Form 16', href: BASE },
                    { label: `${employeeName} · FY ${financialYear}` },
                ]}
                title={`${employeeName}`}
                subtitle={`Form 16 — FY ${financialYear}`}
                icon={FileText}
                actions={
                    <div className="flex items-center gap-2">
                        <ZoruButton variant="outline" asChild>
                            <Link href={BASE}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Link>
                        </ZoruButton>
                        {documentUrl ? (
                            <ZoruButton variant="outline" asChild>
                                <a
                                    href={documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download PDF
                                </a>
                            </ZoruButton>
                        ) : null}
                        <ZoruButton asChild>
                            <Link href={`${BASE}/${id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </Link>
                        </ZoruButton>
                    </div>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
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
                        <div className="text-zoru-ink-muted">Financial year</div>
                        <div className="font-mono text-zoru-ink">{financialYear}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">PAN</div>
                        <div className="font-mono text-zoru-ink">
                            {(row.pan as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">TAN of employer</div>
                        <div className="font-mono text-zoru-ink">
                            {(row.tanOfEmployer as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Generated at</div>
                        <div className="text-zoru-ink">{fmtDate(row.generatedAt)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Total income</div>
                        <div className="font-mono text-zoru-ink">{inr(row.totalIncome)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Tax deducted</div>
                        <div className="font-mono text-zoru-ink">{inr(row.taxDeducted)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Generated by</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {(row.generatedBy as string | undefined) ?? '—'}
                        </div>
                    </div>
                </div>
            </ZoruCard>

            {documentUrl ? (
                <ZoruCard className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-2 text-[13px] text-zoru-ink">
                        <Paperclip className="h-4 w-4 text-zoru-ink-muted" />
                        Attached document
                    </div>
                    <a
                        href={documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-full truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                    >
                        {documentUrl}
                    </a>
                </ZoruCard>
            ) : null}
        </div>
    );
}
