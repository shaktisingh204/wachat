/**
 * Policy detail page (§1D.2).
 *
 * Loads a single document from `hr_policies` and renders an overview
 * card + policy body. Actions: Edit · Publish · Archive · Print (stubs).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
    ShieldCheck,
    Pencil,
    Send,
    Archive,
    Printer,
    ArrowLeft,
} from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { statusToTone } from '@/components/crm/status-pill';
import {
    getHrEntityById,
    fmtDate,
    fmtText,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import { publishPolicy, archivePolicy } from '@/app/actions/hr-status.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/policies';

export default async function PolicyDetailPage({ params }: PageProps) {
    const { id } = await params;
    const doc = await getHrEntityById('hr_policies', id);
    if (!doc) notFound();

    const p = doc as Record<string, unknown>;
    const title = (p.title as string) || 'Untitled policy';
    const status = String(p.status || 'draft');
    const body = (p.body as string) || (p.content as string) || '';
    const attachment = (p.attachmentUrl as string) || '';

    return (
        <EntityDetailShell
            title={title}
            eyebrow="HR · POLICY"
            back={{ href: BASE, label: 'All policies' }}
            status={{ label: status, tone: statusToTone(status) }}
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
                    <a href={`${BASE}/${id}?print=1`} target="_blank" rel="noopener noreferrer">
                        <ZoruButton variant="outline" size="sm">
                            <Printer className="h-4 w-4" /> Print
                        </ZoruButton>
                    </a>
                    <HrActionButtons
                        actions={[
                            {
                                key: 'publish',
                                kind: 'action',
                                label: 'Publish',
                                icon: <Send className="h-4 w-4" />,
                                onRun: () => publishPolicy(id),
                            },
                            {
                                key: 'archive',
                                kind: 'confirm',
                                label: 'Archive',
                                icon: <Archive className="h-4 w-4" />,
                                variant: 'destructive',
                                confirmTitle: 'Archive this policy?',
                                confirmDescription:
                                    'Archived policies are hidden from the active policy list.',
                                confirmLabel: 'Archive',
                                onRun: () => archivePolicy(id),
                            },
                        ]}
                    />
                </>
            }
            audit={{ entityKind: 'policy', entityId: id }}
        >
            <HrDetailGrid title="Overview">
                <HrDetailRow label="Title">{title}</HrDetailRow>
                <HrDetailRow label="Category">{fmtText(p.category)}</HrDetailRow>
                <HrDetailRow label="Version">{fmtText(p.version)}</HrDetailRow>
                <HrDetailRow label="Applies to">{fmtText(p.appliesTo)}</HrDetailRow>
                <HrDetailRow label="Status">
                    <ZoruBadge variant={status === 'active' ? 'success' : 'ghost'}>
                        {status}
                    </ZoruBadge>
                </HrDetailRow>
                <HrDetailRow label="Effective date">{fmtDate(p.effectiveDate)}</HrDetailRow>
                <HrDetailRow label="Review date">{fmtDate(p.reviewDate)}</HrDetailRow>
                <HrDetailRow label="Owner">{fmtText(p.ownerId || p.ownerName)}</HrDetailRow>
                {attachment ? (
                    <HrDetailRow label="Document URL" fullWidth>
                        <a
                            href={attachment}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-zoru-ink underline-offset-2 hover:underline"
                        >
                            {attachment}
                        </a>
                    </HrDetailRow>
                ) : null}
            </HrDetailGrid>

            <ZoruCard className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">Body</div>
                <div className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 text-[13px] text-zoru-ink">
                    {body || (
                        <span className="text-zoru-ink-muted">No body content.</span>
                    )}
                </div>
            </ZoruCard>

            <ShieldCheck className="hidden" />
        </EntityDetailShell>
    );
}
