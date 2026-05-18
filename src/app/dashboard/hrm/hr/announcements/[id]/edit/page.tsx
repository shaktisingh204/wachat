import {
  notFound,
  redirect } from 'next/navigation';

/**
 * HR Announcement — edit page.
 *
 * Server component that loads the existing announcement via
 * `getAnnouncementById` and renders <AnnouncementForm initialData={...} />
 * in edit mode. The form action redirects back to the detail page.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getAnnouncementById } from '@/app/actions/crm-announcements.actions';
import { getSession } from '@/app/actions/user.actions';

import { AnnouncementForm } from '../../_components/announcement-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/announcements';

export default async function EditAnnouncementPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const announcement = await getAnnouncementById(id);
    if (!announcement) notFound();

    return (
        <EntityListShell
            title={`Edit · ${announcement.title}`}
            subtitle="Update the contents, audience, or schedule of this announcement."
        >
            <AnnouncementForm initialData={announcement} />
        </EntityListShell>
    );
}
