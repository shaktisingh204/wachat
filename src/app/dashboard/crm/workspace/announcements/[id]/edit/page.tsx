/**
 * Edit announcement — §1B W7 (deepened §3.3.2).
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getAnnouncementById } from '@/app/actions/crm-announcements.actions';
import { AnnouncementForm } from '../../_components/announcement-form';

export const dynamic = 'force-dynamic';

export default async function EditAnnouncementPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const announcement = await getAnnouncementById(id);
    if (!announcement) notFound();
    return (
        <EntityDetailShell
            eyebrow="ANNOUNCEMENT"
            title="Edit announcement"
            back={{
                href: `/dashboard/crm/workspace/announcements/${id}`,
                label: 'Back to announcement',
            }}
            rightRail={
                <EntityAuditTimeline
                    entityKind="announcement"
                    entityId={String(id)}
                    title="Activity"
                    limit={25}
                />
            }
        >
            <AnnouncementForm mode="edit" announcement={announcement} />
        </EntityDetailShell>
    );
}
