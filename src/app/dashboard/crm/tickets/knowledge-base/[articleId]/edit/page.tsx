/**
 * Edit KB article — `/dashboard/crm/tickets/knowledge-base/[articleId]/edit`.
 */

import { redirect } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="KNOWLEDGE BASE"
            title="Edit article"
            back={{ href: `/dashboard/crm/tickets/knowledge-base/${articleId}`, label: 'Back to article' }}
        >
            <KbArticleForm mode="edit" articleId={articleId} initial={article} />
        </EntityDetailShell>
    );
}
