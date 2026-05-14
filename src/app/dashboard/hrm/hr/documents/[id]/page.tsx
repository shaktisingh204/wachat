/**
 * Document detail page (§1D.2).
 *
 * Loads a single document from `hr_documents` for the current tenant.
 * Actions: Edit · Open file · Mark verified · Renew (stubs).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
    FileText,
    Pencil,
    ExternalLink,
    CheckCircle2,
    RefreshCw,
    ArrowLeft,
} from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruBadge, ZoruButton } from '@/components/zoruui';
import { statusToTone } from '@/components/crm/status-pill';
import {
    getHrEntityById,
    fmtDate,
    fmtText,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    markDocumentVerified,
    renewDocument,
} from '@/app/actions/hr-status.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/documents';

export default async function DocumentDetailPage({ params }: PageProps) {
    const { id } = await params;
    const doc = await getHrEntityById('hr_documents', id);
    if (!doc) notFound();

    const d = doc as Record<string, unknown>;
    const name = (d.name as string) || 'Untitled document';
    const category = (d.category as string) || '—';
    const verified =
        d.verified === true || d.verified === 'yes' || d.isVerified === true;
    const confidential =
        d.isConfidential === true || d.isConfidential === 'yes';
    const url = (d.url as string) || '';
    const employeeRef = (d.employeeName as string) || (d.employeeId as string) || '—';

    // Compute expiry status
    let expiryTone: 'success' | 'warning' | 'danger' = 'success';
    let expiryLabel = 'Valid';
    if (d.expiresAt) {
        const exp = new Date(d.expiresAt as any);
        if (!isNaN(exp.getTime())) {
            const now = new Date();
            const daysLeft = Math.floor((exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            if (daysLeft < 0) {
                expiryTone = 'danger';
                expiryLabel = 'Expired';
            } else if (daysLeft <= 90) {
                expiryTone = 'warning';
                expiryLabel = `Expires in ${daysLeft}d`;
            }
        }
    }

    return (
        <EntityDetailShell
            title={name}
            eyebrow={`HR · ${category.toUpperCase()}`}
            back={{ href: BASE, label: 'All documents' }}
            status={{
                label: verified ? 'verified' : 'unverified',
                tone: statusToTone(verified ? 'verified' : 'pending'),
            }}
            actions={
                <>
                    <Link href={BASE}>
                        <ZoruButton variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </ZoruButton>
                    </Link>
                    <Link href={`${BASE}/${id}/edit`}>
                        <ZoruButton size="sm">
                            <Pencil className="h-4 w-4" /> Edit
                        </ZoruButton>
                    </Link>
                    {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer">
                            <ZoruButton variant="outline" size="sm">
                                <ExternalLink className="h-4 w-4" /> Open file
                            </ZoruButton>
                        </a>
                    ) : (
                        <ZoruButton variant="outline" size="sm" disabled>
                            <ExternalLink className="h-4 w-4" /> Open file
                        </ZoruButton>
                    )}
                    <HrActionButtons
                        actions={[
                            {
                                key: 'verify',
                                kind: 'action',
                                label: 'Mark verified',
                                icon: <CheckCircle2 className="h-4 w-4" />,
                                onRun: () => markDocumentVerified(id),
                                disabled: verified,
                            },
                            {
                                key: 'renew',
                                kind: 'prompt',
                                label: 'Renew',
                                icon: <RefreshCw className="h-4 w-4" />,
                                promptTitle: 'Renew document',
                                promptDescription:
                                    'Set the new expiry date for this document.',
                                submitLabel: 'Renew',
                                fields: [
                                    {
                                        name: 'newExpiry',
                                        label: 'New expiry date',
                                        type: 'date',
                                        required: true,
                                    },
                                ],
                                onRun: (v) => renewDocument(id, v.newExpiry ?? ''),
                            },
                        ]}
                    />
                </>
            }
            audit={{ entityKind: 'document', entityId: id }}
        >
            <HrDetailGrid
                title="Document details"
                titleSlot={
                    <div className="flex items-center gap-1.5">
                        <ZoruBadge variant={expiryTone}>{expiryLabel}</ZoruBadge>
                        {confidential ? (
                            <ZoruBadge variant="warning">Confidential</ZoruBadge>
                        ) : null}
                    </div>
                }
            >
                <HrDetailRow label="Name">{name}</HrDetailRow>
                <HrDetailRow label="Category">{category}</HrDetailRow>
                <HrDetailRow label="Document #">{fmtText(d.documentNumber)}</HrDetailRow>
                <HrDetailRow label="Employee">{fmtText(employeeRef)}</HrDetailRow>
                <HrDetailRow label="Issued by">{fmtText(d.issuedBy)}</HrDetailRow>
                <HrDetailRow label="Issued date">{fmtDate(d.issuedDate)}</HrDetailRow>
                <HrDetailRow label="Expires at">{fmtDate(d.expiresAt)}</HrDetailRow>
                <HrDetailRow label="Verified">{verified ? 'Yes' : 'No'}</HrDetailRow>
                <HrDetailRow label="Confidential">{confidential ? 'Yes' : 'No'}</HrDetailRow>
                <HrDetailRow label="Uploaded">{fmtDate(d.createdAt)}</HrDetailRow>
                {url ? (
                    <HrDetailRow label="File URL" fullWidth>
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-zoru-ink underline-offset-2 hover:underline"
                        >
                            {url}
                        </a>
                    </HrDetailRow>
                ) : null}
                {d.notes ? (
                    <HrDetailRow label="Notes" fullWidth>
                        {String(d.notes)}
                    </HrDetailRow>
                ) : null}
            </HrDetailGrid>

            <FileText className="hidden" />
        </EntityDetailShell>
    );
}
