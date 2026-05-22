import { Badge, Button, Card } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import {
  Paperclip,
  Pencil,
  ShieldAlert,
  } from 'lucide-react';

/**
 * Document detail page — server component.
 *
 * Fetches the document by id via the Rust-backed `getDocumentById` server
 * action and renders a summary card + linked entity + attached file link.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getDocumentById } from '@/app/actions/crm-documents.actions';
import type { CrmDocumentStatus } from '@/lib/rust-client/crm-documents';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/documents';

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

export default async function DocumentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: documentId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const doc = await getDocumentById(documentId);
    if (!doc) notFound();

    const status = (doc.status ?? 'pending') as CrmDocumentStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';
    const tags = Array.isArray(doc.tags) ? doc.tags : [];

    return (
        <EntityListShell
            title={doc.name}
            subtitle={doc.description || 'Document detail'}
            primaryAction={
                <ZoruButton asChild>
                    <Link href={`${BASE}/${documentId}/edit`}>
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
                    <StatusPill label={pretty(status)} tone={tone} />
                    {doc.isConfidential ? (
                        <ZoruBadge variant="ghost">
                            <ShieldAlert className="mr-1 h-3 w-3" />
                            Confidential
                        </ZoruBadge>
                    ) : null}
                    {tags.map((t) => (
                        <ZoruBadge key={t} variant="ghost">
                            {t}
                        </ZoruBadge>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Category</div>
                        <div className="capitalize text-zoru-ink">
                            {pretty(doc.category as string | undefined)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Document number</div>
                        <div className="font-mono text-zoru-ink">
                            {doc.documentNumber || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Entity</div>
                        <div className="text-zoru-ink">
                            {pretty(doc.entityKind)}{doc.entityId ? ` · ${doc.entityId}` : ''}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Employee</div>
                        <div className="text-zoru-ink">
                            {doc.employeeName ?? doc.employeeId ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Issue date</div>
                        <div className="text-zoru-ink">{fmtDate(doc.issueDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Expiry date</div>
                        <div className="text-zoru-ink">{fmtDate(doc.expiryDate)}</div>
                    </div>
                    {doc.description ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Description</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {doc.description}
                            </div>
                        </div>
                    ) : null}
                    {doc.notes ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Notes</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {doc.notes}
                            </div>
                        </div>
                    ) : null}
                </div>
            </ZoruCard>

            {doc.fileUrl ? (
                <ZoruCard className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-2 text-[13px] text-zoru-ink">
                        <Paperclip className="h-4 w-4 text-zoru-ink-muted" />
                        Attached file
                    </div>
                    <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-full truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                    >
                        {doc.fileUrl}
                    </a>
                </ZoruCard>
            ) : null}
        </EntityListShell>
    );
}
