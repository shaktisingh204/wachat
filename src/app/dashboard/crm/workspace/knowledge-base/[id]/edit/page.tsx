import { notFound } from 'next/navigation';

import { getKnowledgeBaseById } from '@/app/actions/worksuite/knowledge.actions';
import { KbInternalForm } from '../../_components/kb-internal-form';

export const dynamic = 'force-dynamic';

export default async function EditKbInternalPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const article = await getKnowledgeBaseById(id);
    if (!article) notFound();
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <KbInternalForm mode="edit" article={article as any} />
        </div>
    );
}
