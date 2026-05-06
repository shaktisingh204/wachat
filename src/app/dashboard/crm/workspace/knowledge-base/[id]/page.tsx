import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, Pin, CheckSquare } from 'lucide-react';

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
            <ZoruButton variant="outline">
              Back
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ZoruBadge variant="ghost" className="capitalize">{article.type}</ZoruBadge>
          {article.pinned ? (
            <ZoruBadge variant="warning">
              <Pin className="h-3 w-3" /> Pinned
            </ZoruBadge>
          ) : null}
          {article.to_do === 'yes' ? (
            <ZoruBadge variant="info">
              <CheckSquare className="h-3 w-3" /> To-do
            </ZoruBadge>
          ) : null}
        </div>
        <div
          className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap text-[14px] leading-relaxed"
        >
          {article.description || 'No content.'}
        </div>
      </ZoruCard>
    </div>
  );
}
