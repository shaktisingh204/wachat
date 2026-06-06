import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getAnnouncementById } from '@/app/actions/crm-announcements.actions';
import { Skeleton } from '@/components/sabcrm/20ui';
import { AnnouncementForm } from '../../_components/announcement-form';
import { AnnouncementPresence } from '../../_components/announcement-presence';
import { AnnouncementAnalytics } from '../../_components/announcement-analytics';

export const dynamic = 'force-dynamic';

async function EditAnnouncementFormLoader({ id }: { id: string }) {
    const announcement = await getAnnouncementById(id);
    if (!announcement) notFound();
    return <AnnouncementForm mode="edit" announcement={announcement} />;
}

export default async function EditAnnouncementPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    return (
        <EntityDetailShell
            eyebrow="ANNOUNCEMENT"
            title="Edit announcement"
            back={{
                href: `/dashboard/sabconnect/announcements/${id}`,
                label: 'Back to announcement',
            }}
            rightRail={
                <div className="flex flex-col gap-4">
                    <AnnouncementPresence entityId={id} />
                    <AnnouncementAnalytics entityId={id} />
                    <Suspense
                        fallback={
                            <Skeleton
                                height={160}
                                radius="var(--st-radius)"
                                className="w-full"
                            />
                        }
                    >
                        <EntityAuditTimeline
                            entityKind="announcement"
                            entityId={String(id)}
                            title="Activity"
                            limit={25}
                        />
                    </Suspense>
                </div>
            }
        >
            <Suspense
                fallback={
                    <Skeleton
                        height={400}
                        radius="var(--st-radius)"
                        className="w-full"
                    />
                }
            >
                <EditAnnouncementFormLoader id={id} />
            </Suspense>
        </EntityDetailShell>
    );
}
