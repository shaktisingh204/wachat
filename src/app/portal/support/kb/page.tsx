/**
 * /portal/support/kb — public knowledge base browser for portal users.
 *
 * Shows only `visibility = 'public'` or `'portal'` and `status =
 * 'published'`. Internal articles are filtered out server-side.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { BookOpen, Search } from 'lucide-react';

import { Badge, Card, CardBody } from '@/components/sabcrm/20ui';
import { EmptyState } from '@/components/sabcrm/20ui';
import { listKbArticles } from '@/app/actions/crm-knowledge-base.actions';

export default async function PortalSupportKbPage() {
  const { articles, error } = await listKbArticles(200);

  const visible = (articles ?? []).filter((a) => {
    const v = a.visibility;
    const s = a.status;
    if (s && s !== 'published') return false;
    return v === 'public' || v === 'portal' || !v;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-[18px] font-semibold text-[var(--st-text)]">
          <BookOpen className="h-4 w-4" />
          Knowledge Base
        </h1>
        <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
          Self-serve guides and answers. Can't find what you need?{' '}
          <Link href="/portal/support/new" className="underline">
            Open a request
          </Link>
          .
        </p>
      </div>

      {error ? (
        <Card>
          <CardBody className="p-4 text-[13px] text-[var(--st-danger)]">{error}</CardBody>
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No published articles yet"
          description="The team is working on it. In the meantime, open a request and we'll help directly."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((a) => (
            <Card key={a._id}>
              <CardBody className="space-y-2 p-4">
                <Link
                  href={`/portal/support/kb/${a._id}`}
                  className="block text-[14px] font-medium text-[var(--st-text)] hover:underline"
                >
                  {a.title ?? 'Untitled'}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--st-text-secondary)]">
                  {a.category ? <Badge variant="ghost">{a.category}</Badge> : null}
                  <Badge variant={a.visibility === 'public' ? 'success' : 'info'}>
                    {a.visibility ?? 'portal'}
                  </Badge>
                  {a.updatedAt ? <span>Updated {new Date(a.updatedAt).toLocaleDateString()}</span> : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <p className="text-[11px] text-[var(--st-text-secondary)]">
        <Search className="mr-1 inline h-3 w-3" />
        Search and category filtering coming soon — for now, articles are sorted by recency.
      </p>
    </div>
  );
}
