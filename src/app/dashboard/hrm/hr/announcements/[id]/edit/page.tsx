import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Megaphone } from 'lucide-react';

/**
 * HR Announcement — edit page.
 *
 * Server component that loads the existing announcement via
 * `getAnnouncementById` and renders <AnnouncementForm initialData={...} />
 * in edit mode. The form action redirects back to the detail page.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HRM', href: '/dashboard/hrm' },
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Announcements', href: BASE },
                    {
                        label: announcement.title,
                        href: `${BASE}/${announcement._id}`,
                    },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${announcement.title}`}
                subtitle="Update the contents, audience, or schedule of this announcement."
                icon={Megaphone}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${announcement._id}`}>
                            <ArrowLeft className="mr-1.5 h-4 w-4" />
                            Back
                        </Link>
                    </ZoruButton>
                }
            />

            <AnnouncementForm initialData={announcement} />
        </div>
    );
}
