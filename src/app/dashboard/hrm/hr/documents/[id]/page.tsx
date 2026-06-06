import { Badge, Button, Card } from '@/components/sabcrm/20ui';
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
import { fmtDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/documents';

const STATUS_TONE: Record<CrmDocumentStatus, StatusTone> = {
    pending: 'amber',
    verified: 'green',
    expired: 'red',
    rejected: 'red',
    archived: 'neutral',
};


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
                <Button asChild>
                    <Link href={`${BASE}/${documentId}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >

            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">
                        Overview
                    </div>
                    <StatusPill label={pretty(status)} tone={tone} />
                    {doc.isConfidential ? (
                        <Badge variant="ghost">
                            <ShieldAlert className="mr-1 h-3 w-3" />
                            Confidential
                        </Badge>
                    ) : null}
                    {tags.map((t) => (
                        <Badge key={t} variant="ghost">
                            {t}
                        </Badge>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Category</div>
                        <div className="capitalize text-[var(--st-text)]">
                            {pretty(doc.category as string | undefined)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Document number</div>
                        <div className="font-mono text-[var(--st-text)]">
                            {doc.documentNumber || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Entity</div>
                        <div className="text-[var(--st-text)]">
                            {pretty(doc.entityKind)}{doc.entityId ? ` · ${doc.entityId}` : ''}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Employee</div>
                        <div className="text-[var(--st-text)]">
                            {doc.employeeName ?? doc.employeeId ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Issue date</div>
                        <div className="text-[var(--st-text)]">{fmtDate(doc.issueDate)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Expiry date</div>
                        <div className="text-[var(--st-text)]">{fmtDate(doc.expiryDate)}</div>
                    </div>
                    {doc.description ? (
                        <div className="sm:col-span-2">
                            <div className="text-[var(--st-text-secondary)]">Description</div>
                            <div className="whitespace-pre-wrap text-[var(--st-text)]">
                                {doc.description}
                            </div>
                        </div>
                    ) : null}
                    {doc.notes ? (
                        <div className="sm:col-span-2">
                            <div className="text-[var(--st-text-secondary)]">Notes</div>
                            <div className="whitespace-pre-wrap text-[var(--st-text)]">
                                {doc.notes}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            {doc.fileUrl ? (
                <Card className="flex flex-col gap-4 p-4 mt-6">
                    <div className="flex items-center gap-2 text-[13px] text-[var(--st-text)]">
                        <Paperclip className="h-4 w-4 text-[var(--st-text-secondary)]" />
                        <span>Attached file: </span>
                        <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="max-w-full truncate text-[12.5px] text-[var(--st-text)] underline-offset-2 hover:underline"
                        >
                            {doc.fileUrl}
                        </a>
                    </div>
                    <div className="w-full rounded-md border border-[var(--st-border)] overflow-hidden" style={{ height: '600px' }}>
                        <iframe
                            src={doc.fileUrl}
                            title="Document Preview"
                            className="w-full h-full border-none"
                            loading="lazy"
                        />
                    </div>
                </Card>
            ) : null}
        </EntityListShell>
    );
}
