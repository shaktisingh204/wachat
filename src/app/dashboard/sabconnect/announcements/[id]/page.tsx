import { Badge, Card, CardTitle, cn } from '@/components/sabcrm/20ui';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Announcement detail. §1B W7.
 */

import Link from 'next/link';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getAnnouncementById } from '@/app/actions/crm-announcements.actions';

import { AnnouncementBadges, AnnouncementStats } from './_components/announcement-mapping';
import { AnnouncementPresence } from './_components/announcement-presence';

export const dynamic = 'force-dynamic';

export default async function AnnouncementDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const announcement = await getAnnouncementById(id);
    if (!announcement) notFound();

    return (
        <div className="p-4 md:p-6">
            <EntityDetailShell
                title={announcement.title}
                eyebrow="ANNOUNCEMENT"
                back={{
                    href: '/dashboard/sabconnect/announcements',
                    label: 'Back to announcements',
                }}
                actions={
                    <div className="flex items-center gap-2">
                        <AnnouncementPresence announcementId={announcement._id} />
                        <Link
                            href="/dashboard/sabconnect/announcements"
                            className={cn('u-btn', 'u-btn--ghost', 'u-btn--md')}
                        >
                            <ArrowLeft size={14} aria-hidden="true" />
                            <span className="u-btn__label">Back</span>
                        </Link>
                        <Link
                            href={`/dashboard/sabconnect/announcements/${announcement._id}/edit`}
                            className={cn('u-btn', 'u-btn--primary', 'u-btn--md')}
                        >
                            <Pencil size={14} aria-hidden="true" />
                            <span className="u-btn__label">Edit</span>
                        </Link>
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
                        <CardTitle className="mb-3">Reach</CardTitle>
                        <AnnouncementStats
                            viewCount={announcement.viewCount}
                            acknowledgementCount={announcement.acknowledgementCount}
                            createdAt={announcement.createdAt}
                            updatedAt={announcement.updatedAt}
                        />
                    </Card>
                }
            >
                <Card>
                    <AnnouncementBadges
                        status={announcement.status}
                        audience={announcement.audience}
                        category={announcement.category}
                        priority={announcement.priority}
                        pinned={announcement.pinned}
                        publishAt={announcement.publishAt}
                        expiresAt={announcement.expiresAt}
                    />
                    {announcement.bannerUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={announcement.bannerUrl}
                            alt={announcement.title}
                            className="mb-4 max-h-64 w-full rounded-[var(--st-radius)] object-cover"
                        />
                    ) : null}
                    <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--st-text)]">
                        {announcement.body}
                    </div>
                    {announcement.tags && announcement.tags.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                            {announcement.tags.map((t) => (
                                <Badge key={t} tone="neutral">
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
