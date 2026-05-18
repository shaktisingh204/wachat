import { redirect } from 'next/navigation';

/**
 * HR Notice — edit page.
 *
 * Server component that loads the existing notice via `getNoticeById`
 * and renders <NoticeForm initialData={notice} /> in edit mode. On
 * redirect-from-form the user is taken back to the detail page.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
        <EntityListShell
            title={`Edit: ${notice.title}`}
            subtitle="Update the contents, recipients, or status of this notice."
        >
            <NoticeForm initialData={notice} />
        </EntityListShell>
    );
}
