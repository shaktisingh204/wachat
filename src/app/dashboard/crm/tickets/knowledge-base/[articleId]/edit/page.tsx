/**
 * Edit KB article — `/dashboard/crm/tickets/knowledge-base/[articleId]/edit`.
 */

import { redirect } from 'next/navigation';
import { BookOpen } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getKbArticleById } from '@/app/actions/crm-knowledge-base.actions';
import { KbArticleForm } from '../../_components/kb-article-form';

export const dynamic = 'force-dynamic';

export default async function EditKbArticlePage({
    params,
}: {
    params: Promise<{ articleId: string }>;
}) {
    const { articleId } = await params;
    const article = await getKbArticleById(articleId);
    if (!article) {
        redirect('/dashboard/crm/tickets/knowledge-base');
    }

    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <CrmPageHeader
                title="Edit article"
                subtitle="Update this knowledge base article."
                icon={BookOpen}
            />
            <KbArticleForm mode="edit" articleId={articleId} initial={article} />
        </div>
    );
}
