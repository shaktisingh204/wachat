import Link from 'next/link';
import { ObjectId } from 'mongodb';
import { BookOpen, Plus } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

type AnyArticle = {
  _id?: { toString(): string } | string;
  title?: string;
  category?: string;
  status?: string;
  visibility?: string;
  helpfulCount?: number;
  viewCount?: number;
  lastReviewedAt?: string | Date;
  createdAt?: string | Date;
};

function formatDateTime(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function getStatusVariant(
  status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'published' || s === 'approved') return 'success';
  if (s === 'draft' || s === 'pending') return 'ghost';
  if (s === 'archived' || s === 'disabled' || s === 'cancelled') return 'danger';
  return 'warning';
}

function getVisibilityVariant(
  visibility?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const v = (visibility || '').toLowerCase();
  if (v === 'public') return 'success';
  if (v === 'portal') return 'warning';
  if (v === 'internal') return 'ghost';
  return 'ghost';
}

export default async function KnowledgeBasePage() {
  let articles: AnyArticle[] = [];
  let loadError = false;

  const session = await getSession();
  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id);
      const docs = await db
        .collection('crm_kb_articles')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      articles = JSON.parse(JSON.stringify(docs)) as AnyArticle[];
    } catch (e) {
      console.error('Failed to load CRM KB articles:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Knowledge Base"
        subtitle="Publish help articles for customers and your support agents."
        icon={BookOpen}
        actions={
          <Link href="/dashboard/crm/tickets/knowledge-base/new">
            <ZoruButton variant="outline">
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New article
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All articles</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Help center articles, statuses and engagement metrics.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Visibility</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Helpful</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Views</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Last reviewed</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load articles. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : articles.length > 0 ? (
                articles.map((a, idx) => {
                  const id =
                    typeof a._id === 'string'
                      ? a._id
                      : a._id?.toString?.() ?? String(idx);
                  const helpful = (a as any).helpfulCount;
                  const views = (a as any).viewCount;
                  const visibility = (a as any).visibility as string | undefined;
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        <Link
                          href={`/dashboard/crm/tickets/knowledge-base/${id}`}
                          className="hover:underline"
                        >
                          {a.title || 'Untitled article'}
                        </Link>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {(a as any).category || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(a.status)}>
                          {a.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {visibility ? (
                          <ZoruBadge variant={getVisibilityVariant(visibility)}>
                            {visibility}
                          </ZoruBadge>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {typeof helpful === 'number' ? helpful : '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {typeof views === 'number' ? views : '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDateTime((a as any).lastReviewedAt)}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No articles yet. Author your first help article to deflect
                    common tickets.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
