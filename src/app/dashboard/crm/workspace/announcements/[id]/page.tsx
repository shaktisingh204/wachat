import { Badge, Button, Card } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { ArrowLeft,
  Pencil,
  Pin } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Announcement detail — §1B W7.
 */

import Link from 'next/link';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { getAnnouncementById } from '@/app/actions/crm-announcements.actions';
import type { CrmAnnouncementStatus } from '@/lib/rust-client/crm-announcements';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<CrmAnnouncementStatus, StatusTone> = {
    draft: 'neutral',
    scheduled: 'amber',
    published: 'green',
    archived: 'neutral',
};

function fmtDate(v: string | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default async function AnnouncementDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const announcement = await getAnnouncementById(id);
    if (!announcement) notFound();

    const tone =
        STATUS_TONE[announcement.status as CrmAnnouncementStatus] ?? 'neutral';

    return (
        <div className="p-4 md:p-6">
            <EntityDetailShell
                title={announcement.title}
                eyebrow="ANNOUNCEMENT"
                back={{
                    href: '/dashboard/crm/workspace/announcements',
                    label: 'Back to announcements',
                }}
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" asChild>
                            <Link href="/dashboard/crm/workspace/announcements">
                                <ArrowLeft className="h-4 w-4" /> Back
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link
                                href={`/dashboard/crm/workspace/announcements/${announcement._id}/edit`}
                            >
                                <Pencil className="h-4 w-4" /> Edit
                            </Link>
                        </Button>
                    </div>
                }
                audit={
                    <EntityAuditTimeline
                        entityKind="announcement"
                        entityId={announcement._id}
                    />
                }
                rightRail={
                    <Card>
                        <h3 className="mb-3 text-[13.5px] font-semibold text-zoru-ink">
                            Reach
                        </h3>
                        <dl className="grid gap-2 text-[12.5px]">
                            <div className="flex justify-between">
                                <dt className="text-zoru-ink-muted">Views</dt>
                                <dd className="text-zoru-ink">
                                    {announcement.viewCount ?? 0}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-zoru-ink-muted">Acknowledgements</dt>
                                <dd className="text-zoru-ink">
                                    {announcement.acknowledgementCount ?? 0}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-zoru-ink-muted">Created</dt>
                                <dd className="text-zoru-ink">
                                    {fmtDate(announcement.createdAt)}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-zoru-ink-muted">Updated</dt>
                                <dd className="text-zoru-ink">
                                    {fmtDate(announcement.updatedAt)}
                                </dd>
                            </div>
                        </dl>
                    </Card>
                }
            >
                <Card>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <StatusPill label={announcement.status} tone={tone} />
                        <Badge variant="ghost" className="capitalize">
                            Audience: {announcement.audience ?? 'all'}
                        </Badge>
                        {announcement.category ? (
                            <Badge variant="secondary" className="capitalize">
                                {String(announcement.category)}
                            </Badge>
                        ) : null}
                        {announcement.priority ? (
                            <Badge variant="ghost" className="capitalize">
                                Priority: {String(announcement.priority)}
                            </Badge>
                        ) : null}
                        {announcement.pinned ? (
                            <Badge variant="warning">
                                <Pin className="h-3 w-3" /> Pinned
                            </Badge>
                        ) : null}
                        <Badge variant="secondary">
                            Publish: {fmtDate(announcement.publishAt)}
                        </Badge>
                        {announcement.expiresAt ? (
                            <Badge variant="secondary">
                                Expires: {fmtDate(announcement.expiresAt)}
                            </Badge>
                        ) : null}
                    </div>
                    {announcement.bannerUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={announcement.bannerUrl}
                            alt={announcement.title}
                            className="mb-4 max-h-64 w-full rounded-md object-cover"
                        />
                    ) : null}
                    <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-zoru-ink">
                        {announcement.body}
                    </div>
                    {announcement.tags && announcement.tags.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                            {announcement.tags.map((t) => (
                                <Badge key={t} variant="ghost">
                                    {t}
                                </Badge>
                            ))}
                        </div>
                    ) : null}
                </Card>
            </EntityDetailShell>
        </div>
    );
}
