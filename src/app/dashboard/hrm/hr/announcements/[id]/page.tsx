/**
 * Announcement detail page (§1D.2).
 *
 * Loads a single document from `hr_announcements` and renders an
 * overview card + the announcement body. Actions: Edit · Send now ·
 * Pin / unpin · Archive (stubs).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
    Megaphone,
    Pencil,
    Send,
    Pin,
    Archive,
    ArrowLeft,
} from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { statusToTone } from '@/components/crm/status-pill';
import {
    getHrEntityById,
    fmtDate,
    fmtDateTime,
    fmtText,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    sendAnnouncementNow,
    toggleAnnouncementPin,
    archiveAnnouncement,
} from '@/app/actions/hr-status.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/announcements';

export default async function AnnouncementDetailPage({ params }: PageProps) {
    const { id } = await params;
    const doc = await getHrEntityById('hr_announcements', id);
    if (!doc) notFound();

    const a = doc as Record<string, unknown>;
    const title = (a.title as string) || 'Untitled announcement';
    const type = String(a.type || 'info');
    const priority = String(a.priority || 'normal');
    const pinned =
        a.pinned === true || a.pinned === 'yes' || a.pinned === 'true';
    const body = (a.body as string) || '';

    return (
        <EntityDetailShell
            title={title}
            eyebrow="HR · ANNOUNCEMENT"
            back={{ href: BASE, label: 'All announcements' }}
            status={{ label: type, tone: statusToTone(type === 'success' ? 'approved' : type) }}
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
                    <HrActionButtons
                        actions={[
                            {
                                key: 'send',
                                kind: 'action',
                                label: 'Send now',
                                icon: <Send className="h-4 w-4" />,
                                onRun: () => sendAnnouncementNow(id),
                            },
                            {
                                key: 'pin',
                                kind: 'action',
                                label: pinned ? 'Unpin' : 'Pin',
                                icon: <Pin className="h-4 w-4" />,
                                onRun: () => toggleAnnouncementPin(id, !pinned),
                            },
                            {
                                key: 'archive',
                                kind: 'confirm',
                                label: 'Archive',
                                icon: <Archive className="h-4 w-4" />,
                                variant: 'destructive',
                                confirmTitle: 'Archive this announcement?',
                                confirmDescription:
                                    'Archived announcements are hidden from the workspace feed.',
                                confirmLabel: 'Archive',
                                onRun: () => archiveAnnouncement(id),
                            },
                        ]}
                    />
                </>
            }
            audit={{ entityKind: 'announcement', entityId: id }}
        >
            <HrDetailGrid
                title="Overview"
                titleSlot={
                    <div className="flex items-center gap-1.5">
                        <ZoruBadge
                            variant={priority === 'urgent' ? 'danger' : 'ghost'}
                        >
                            {priority}
                        </ZoruBadge>
                        {pinned ? <ZoruBadge variant="warning">Pinned</ZoruBadge> : null}
                    </div>
                }
            >
                <HrDetailRow label="Title">{title}</HrDetailRow>
                <HrDetailRow label="Type">{type}</HrDetailRow>
                <HrDetailRow label="Category">{fmtText(a.category)}</HrDetailRow>
                <HrDetailRow label="Priority">{priority}</HrDetailRow>
                <HrDetailRow label="Audience">{fmtText(a.audience)}</HrDetailRow>
                <HrDetailRow label="Department">{fmtText(a.departmentId)}</HrDetailRow>
                <HrDetailRow label="Team">{fmtText(a.teamId)}</HrDetailRow>
                <HrDetailRow label="Target employees">
                    {fmtText(a.targetEmployeeIds)}
                </HrDetailRow>
                <HrDetailRow label="Publish at">{fmtDateTime(a.publishAt)}</HrDetailRow>
                <HrDetailRow label="Expires at">{fmtDate(a.expiresAt)}</HrDetailRow>
                <HrDetailRow label="Pinned">{pinned ? 'Yes' : 'No'}</HrDetailRow>
                <HrDetailRow label="Requires acknowledgment">
                    {a.requiresAcknowledgment === true ||
                    a.requiresAcknowledgment === 'yes'
                        ? 'Yes'
                        : 'No'}
                </HrDetailRow>
                {a.attachmentUrl ? (
                    <HrDetailRow label="Attachment" fullWidth>
                        <a
                            href={String(a.attachmentUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-zoru-ink underline-offset-2 hover:underline"
                        >
                            {String(a.attachmentUrl)}
                        </a>
                    </HrDetailRow>
                ) : null}
            </HrDetailGrid>

            <ZoruCard className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">Message</div>
                <div className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 text-[13px] text-zoru-ink">
                    {body || (
                        <span className="text-zoru-ink-muted">No message body.</span>
                    )}
                </div>
            </ZoruCard>

            <Megaphone className="hidden" />
        </EntityDetailShell>
    );
}
