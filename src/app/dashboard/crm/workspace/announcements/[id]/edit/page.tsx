/**
 * Edit announcement — §1B W7.
 */

import { notFound } from 'next/navigation';

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
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <AnnouncementForm mode="edit" announcement={announcement} />
        </div>
    );
}
