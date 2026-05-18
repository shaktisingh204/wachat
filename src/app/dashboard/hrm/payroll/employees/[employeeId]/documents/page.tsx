import { ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import {
  ExternalLink,
  FileText,
  Plus,
  } from 'lucide-react';

/**
 * Employee documents sub-tab —
 *   `/dashboard/hrm/payroll/employees/[employeeId]/documents`.
 *
 * Lists `crm_documents` filtered by `entityKind=employee&entityId=<id>`
 * via `crmDocumentsApi.list`. Card per document with name, category,
 * expiry-date, status and SabFile link. Upload action navigates to the
 * existing new-document form with `employeeId` prefilled.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getEmployee } from '@/app/actions/crm/employees.actions';
import { getDocuments } from '@/app/actions/crm-documents.actions';
import { requirePermission } from '@/lib/rbac-server';
import type {
    CrmDocumentDoc,
    CrmDocumentStatus,
} from '@/lib/rust-client/crm-documents';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<CrmDocumentStatus, StatusTone> = {
    pending: 'amber',
    verified: 'green',
    expired: 'red',
    rejected: 'red',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function pretty(s?: string): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

function expiryWarning(expiry?: string): {
    label?: string;
    tone?: StatusTone;
} {
    if (!expiry) return {};
    const d = new Date(expiry);
    if (Number.isNaN(d.getTime())) return {};
    const diffDays = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0)
        return { label: 'Expired', tone: 'red' };
    if (diffDays < 30)
        return { label: `${Math.ceil(diffDays)}d left`, tone: 'amber' };
    return {};
}

export default async function EmployeeDocumentsSubPage({
    params,
}: {
    params: Promise<{ employeeId: string }>;
}) {
    const { employeeId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const guard = await requirePermission('crm_document', 'view');
    if (!guard.ok) {
        return (
            <p className="p-6 text-[13px] text-zoru-ink-muted">{guard.error}</p>
        );
    }

    const [{ employee }, list] = await Promise.all([
        getEmployee(employeeId),
        getDocuments({
            entityKind: 'employee',
            entityId: employeeId,
            limit: 100,
        }),
    ]);
    if (!employee) notFound();

    const items: CrmDocumentDoc[] = list.items;

    const fullName =
        employee.displayName ||
        [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
        employee.workEmail ||
        'Employee';

    const BASE = `/dashboard/hrm/payroll/employees/${employeeId}`;
    const NEW_DOC_HREF = `/dashboard/hrm/hr/documents/new?employeeId=${employeeId}&entityKind=employee&entityId=${employeeId}`;

    return (
        <EntityListShell
            title={`Documents · ${fullName}`}
            subtitle="HR documents linked to this employee."
            primaryAction={
                <ZoruButton asChild>
                    <Link href={NEW_DOC_HREF}>
                        <Plus className="mr-2 h-4 w-4" />
                        Upload
                    </Link>
                </ZoruButton>
            }
        >

            <div className="flex flex-wrap gap-1 border-b border-zoru-line">
                {[
                    { href: BASE, label: 'Overview' },
                    { href: `${BASE}/profile`, label: 'Profile' },
                    {
                        href: `${BASE}/documents`,
                        label: 'Documents',
                        active: true,
                    },
                    {
                        href: `${BASE}/emergency-contacts`,
                        label: 'Emergency contacts',
                    },
                    { href: `${BASE}/leave-quotas`, label: 'Leave quotas' },
                    { href: `${BASE}/visa-details`, label: 'Visa details' },
                ].map((tab) => (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] transition-colors ${
                            tab.active
                                ? 'border-zoru-ink text-zoru-ink'
                                : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink'
                        }`}
                    >
                        {tab.label}
                    </Link>
                ))}
            </div>

            {items.length === 0 ? (
                <ZoruCard className="flex flex-col items-start gap-3 p-8">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2">
                        <FileText
                            className="h-5 w-5 text-zoru-ink-muted"
                            strokeWidth={1.75}
                        />
                    </div>
                    <div>
                        <h3 className="text-[15px] text-zoru-ink">
                            No documents yet
                        </h3>
                        <p className="mt-1 text-[13px] text-zoru-ink-muted">
                            Upload identity proofs, contracts, qualifications and
                            other HR documents for {fullName}.
                        </p>
                    </div>
                    <ZoruButton asChild>
                        <Link href={NEW_DOC_HREF}>
                            <Plus className="mr-2 h-4 w-4" />
                            Upload document
                        </Link>
                    </ZoruButton>
                </ZoruCard>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((doc) => {
                        const tone =
                            STATUS_TONE[doc.status] ?? ('neutral' as StatusTone);
                        const warn = expiryWarning(doc.expiryDate);
                        return (
                            <ZoruCard key={doc._id} className="flex flex-col gap-3 p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={`/dashboard/hrm/hr/documents/${doc._id}`}
                                            className="block text-[14px] font-medium text-zoru-ink hover:underline"
                                        >
                                            {doc.name}
                                        </Link>
                                        <div className="mt-0.5 text-[12px] capitalize text-zoru-ink-muted">
                                            {pretty(doc.category)}
                                        </div>
                                    </div>
                                    <StatusPill
                                        label={pretty(doc.status)}
                                        tone={tone}
                                    />
                                </div>

                                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                                    <div>
                                        <dt className="text-zoru-ink-muted">Issued</dt>
                                        <dd className="text-zoru-ink">
                                            {fmtDate(doc.issueDate)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-zoru-ink-muted">Expires</dt>
                                        <dd className="flex items-center gap-1 text-zoru-ink">
                                            {fmtDate(doc.expiryDate)}
                                            {warn.label && warn.tone ? (
                                                <StatusPill
                                                    label={warn.label}
                                                    tone={warn.tone}
                                                />
                                            ) : null}
                                        </dd>
                                    </div>
                                    {doc.documentNumber ? (
                                        <div className="col-span-2">
                                            <dt className="text-zoru-ink-muted">
                                                Number
                                            </dt>
                                            <dd className="font-mono text-[11.5px] text-zoru-ink">
                                                {doc.documentNumber}
                                            </dd>
                                        </div>
                                    ) : null}
                                </dl>

                                <div className="mt-auto flex items-center justify-between gap-2 border-t border-zoru-line pt-2">
                                    {doc.fileUrl ? (
                                        <a
                                            href={doc.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[12px] text-zoru-ink hover:underline"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            Open file
                                        </a>
                                    ) : (
                                        <span className="text-[12px] text-zoru-ink-muted">
                                            No file
                                        </span>
                                    )}
                                    <Link
                                        href={`/dashboard/hrm/hr/documents/${doc._id}/edit`}
                                        className="text-[12px] text-zoru-ink-muted hover:text-zoru-ink"
                                    >
                                        Edit
                                    </Link>
                                </div>
                            </ZoruCard>
                        );
                    })}
                </div>
            )}
        </EntityListShell>
    );
}

