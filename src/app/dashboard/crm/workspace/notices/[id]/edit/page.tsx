/**
 * Edit notice — §1D.3 bar.
 */

import { notFound } from 'next/navigation';

import { getNoticeById } from '@/app/actions/worksuite/knowledge.actions';
import { NoticesForm } from '../../_components/notices-form';

export const dynamic = 'force-dynamic';

export default async function EditNoticePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const notice = await getNoticeById(id);
    if (!notice) notFound();
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <NoticesForm mode="edit" notice={notice as any} />
        </div>
    );
}
