import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Megaphone } from 'lucide-react';

/**
 * HR Announcements — new announcement page.
 *
 * Server component that renders the shared <AnnouncementForm /> with no
 * `initialData`, putting it in "create" mode. The form action redirects
 * to the detail page on success.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { AnnouncementForm } from '../_components/announcement-form';

export const dynamic = 'force-dynamic';

export default async function NewAnnouncementPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HRM', href: '/dashboard/hrm' },
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    {
                        label: 'Announcements',
                        href: '/dashboard/hrm/hr/announcements',
                    },
                    { label: 'New' },
                ]}
                title="New Announcement"
                subtitle="Draft a company-wide update or pinned message."
                icon={Megaphone}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/hr/announcements">
                            <ArrowLeft className="mr-1.5 h-4 w-4" />
                            Back
                        </Link>
                    </ZoruButton>
                }
            />

            <AnnouncementForm />
        </div>
    );
}
