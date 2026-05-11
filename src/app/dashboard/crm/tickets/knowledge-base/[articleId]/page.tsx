import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { ObjectId } from 'mongodb';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function getVisibilityVariant(
  v?: string,
): 'success' | 'warning' | 'ghost' {
  const s = (v || '').toLowerCase();
  if (s === 'public') return 'success';
  if (s === 'portal') return 'warning';
  return 'ghost';
}

function getStatusVariant(
  s?: string,
): 'success' | 'ghost' | 'danger' {
  const lower = (s || '').toLowerCase();
  if (lower === 'published') return 'success';
  if (lower === 'archived') return 'danger';
  return 'ghost';
}

export default async function KbArticleDetailPage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;

  if (!ObjectId.isValid(articleId)) {
    redirect('/dashboard/crm/tickets/knowledge-base');
  }

  const session = await getSession();
  if (!session?.user?._id) {
    redirect('/dashboard/crm/tickets/knowledge-base');
  }

  const { db } = await connectToDatabase();
  const doc = await db.collection('crm_kb_articles').findOne({
    _id: new ObjectId(articleId),
    userId: new ObjectId(session.user._id),
  } as any);

  if (!doc) {
    redirect('/dashboard/crm/tickets/knowledge-base');
  }

  const article = JSON.parse(JSON.stringify(doc)) as Record<string, any>;
  const title: string = article.title || 'Untitled article';
  const tags: string = Array.isArray(article.tags) && article.tags.length > 0
    ? article.tags.join(', ')
    : '—';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={title}
        subtitle="Knowledge base article"
        icon={BookOpen}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/crm/tickets/knowledge-base">
              <ZoruButton variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back
              </ZoruButton>
            </Link>
            <Link href={`/dashboard/crm/tickets/knowledge-base/${article._id}/edit`}>
              <ZoruButton variant="outline">Edit</ZoruButton>
            </Link>
          </div>
        }
      />

      <ZoruCard className="p-6">
        <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">
          Article Details
        </h2>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 text-[13px] sm:grid-cols-2">
          <div>
            <div className="text-zoru-ink-muted">Title</div>
            <div className="text-zoru-ink">{article.title || '—'}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Slug</div>
            <div className="font-mono text-zoru-ink">{article.slug || '—'}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Category</div>
            <div className="text-zoru-ink">{article.category || '—'}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Tags</div>
            <div className="text-zoru-ink">{tags}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Visibility</div>
            <div className="mt-0.5">
              {article.visibility ? (
                <ZoruBadge variant={getVisibilityVariant(article.visibility)}>
                  {article.visibility}
                </ZoruBadge>
              ) : (
                <span className="text-zoru-ink-muted">—</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Status</div>
            <div className="mt-0.5">
              {article.status ? (
                <ZoruBadge variant={getStatusVariant(article.status)}>
                  {article.status}
                </ZoruBadge>
              ) : (
                <span className="text-zoru-ink-muted">—</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Helpful count</div>
            <div className="text-zoru-ink">
              {typeof article.helpfulCount === 'number' ? article.helpfulCount : '—'}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">View count</div>
            <div className="text-zoru-ink">
              {typeof article.viewCount === 'number' ? article.viewCount : '—'}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Created</div>
            <div className="text-zoru-ink">{fmtDate(article.createdAt)}</div>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">Content</h2>
        {article.body ? (
          <div className="whitespace-pre-wrap rounded-lg bg-zoru-surface-2 p-4 text-sm text-zoru-ink">
            {article.body}
          </div>
        ) : (
          <div className="rounded-lg bg-zoru-surface-2 p-4 text-sm text-zoru-ink-muted">
            No content yet.
          </div>
        )}
      </ZoruCard>
    </div>
  );
}
