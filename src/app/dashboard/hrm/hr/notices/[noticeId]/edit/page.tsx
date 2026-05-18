import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Bell } from 'lucide-react';

/**
 * HR Notice — edit page.
 *
 * Server component that loads the existing notice via `getNoticeById`
 * and renders <NoticeForm initialData={notice} /> in edit mode. On
 * redirect-from-form the user is taken back to the detail page.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getNoticeById } from '@/app/actions/crm-notices.actions';
import { getSession } from '@/app/actions/user.actions';
import { NoticeForm } from '../../_components/notice-form';

export const dynamic = 'force-dynamic';

export default async function EditNoticePage({
    params,
}: {
    params: Promise<{ noticeId: string }>;
}) {
    const { noticeId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/dashboard/hrm/hr/notices');

    const notice = await getNoticeById(noticeId);
    if (!notice) redirect('/dashboard/hrm/hr/notices');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HRM', href: '/dashboard/hrm' },
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    {
                        label: 'Notices',
                        href: '/dashboard/hrm/hr/notices',
                    },
                    {
                        label: notice.noticeNumber || notice._id.slice(-8),
                        href: `/dashboard/hrm/hr/notices/${notice._id}`,
                    },
                    { label: 'Edit' },
                ]}
                title={`Edit: ${notice.title}`}
                subtitle="Update the contents, recipients, or status of this notice."
                icon={Bell}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link
                            href={`/dashboard/hrm/hr/notices/${notice._id}`}
                        >
                            <ArrowLeft className="mr-1.5 h-4 w-4" />
                            Back
                        </Link>
                    </ZoruButton>
                }
            />

            <NoticeForm initialData={notice} />
        </div>
    );
}
