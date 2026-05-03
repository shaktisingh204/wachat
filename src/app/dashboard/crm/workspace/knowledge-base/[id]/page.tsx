import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, Pin, CheckSquare } from 'lucide-react';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getKnowledgeBaseById,
  getKnowledgeBaseCategories,
} from '@/app/actions/worksuite/knowledge.actions';

export default async function KnowledgeBaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [article, categories] = await Promise.all([
    getKnowledgeBaseById(id),
    getKnowledgeBaseCategories(),
  ]);

  if (!article) notFound();

  const category = categories.find((c) => String(c._id) === String(article.category_id));

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={article.title}
        subtitle={category ? `in ${category.name}` : 'Uncategorized'}
        icon={BookOpen}
        actions={
          <Link href="/dashboard/crm/workspace/knowledge-base">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}>
              Back
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ClayBadge tone="neutral" className="capitalize">{article.type}</ClayBadge>
          {article.pinned ? (
            <ClayBadge tone="amber">
              <Pin className="h-3 w-3" /> Pinned
            </ClayBadge>
          ) : null}
          {article.to_do === 'yes' ? (
            <ClayBadge tone="blue">
              <CheckSquare className="h-3 w-3" /> To-do
            </ClayBadge>
          ) : null}
        </div>
        <div
          className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap text-[14px] leading-relaxed"
        >
          {article.description || 'No content.'}
        </div>
      </ClayCard>
    </div>
  );
}
