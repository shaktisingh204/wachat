import { Badge, Button, Card } from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Announcement detail — §1B W7.
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
                    href: '/dashboard/crm/workspace/announcements',
                    label: 'Back to announcements',
                }}
                actions={
                    <div className="flex items-center gap-2">
                        <AnnouncementPresence announcementId={announcement._id} />
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
