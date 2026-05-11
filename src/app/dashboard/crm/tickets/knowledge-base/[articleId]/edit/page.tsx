import { redirect } from 'next/navigation';
import { BookOpen } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getKbArticleById } from '@/app/actions/crm-knowledge-base.actions';
import KbArticleEditForm from './kb-article-edit-form';

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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Edit Article"
        subtitle="Update this knowledge base article."
        icon={BookOpen}
      />
      <KbArticleEditForm article={article} articleId={articleId} />
    </div>
  );
}
