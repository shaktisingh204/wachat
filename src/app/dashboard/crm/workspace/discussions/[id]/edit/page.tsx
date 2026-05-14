import { notFound } from 'next/navigation';

import { getDiscussionById } from '@/app/actions/worksuite/knowledge.actions';
import { DiscussionsForm } from '../../_components/discussions-form';

export const dynamic = 'force-dynamic';

export default async function EditDiscussionPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const d = await getDiscussionById(id);
    if (!d) notFound();
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <DiscussionsForm mode="edit" discussion={d as any} />
        </div>
    );
}
