import { Card } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import {
  BookOpen,
  Eye,
  ThumbsDown,
  ThumbsUp } from 'lucide-react';
import { ObjectId } from 'mongodb';

/**
 * KB article activity — minimal audit timeline.
 *
 * The article doc holds `createdAt`, `updatedAt`, `viewCount`, and
 * helpful counters but no per-event log yet. This page renders those
 * as a single timeline; richer audit will be added when the actions
 * layer starts emitting events.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

function fmt(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default async function KbArticleActivityPage({
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

    const rows: { label: string; value: React.ReactNode; ts?: string }[] = [
        { label: 'Created', value: fmt(article.createdAt), ts: article.createdAt },
        { label: 'Last updated', value: fmt(article.updatedAt), ts: article.updatedAt },
        {
            label: 'Views',
            value: (
                <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {article.viewCount ?? 0}
                </span>
            ),
        },
        {
            label: 'Helpful (yes)',
            value: (
                <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {article.helpfulYes ?? 0}
                </span>
            ),
        },
        {
            label: 'Helpful (no)',
            value: (
                <span className="inline-flex items-center gap-1">
                    <ThumbsDown className="h-3.5 w-3.5" />
                    {article.helpfulNo ?? 0}
                </span>
            ),
        },
    ];

    return (
        <EntityDetailShell
            eyebrow="KNOWLEDGE BASE"
            title={`Activity — ${article.title || 'Article'}`}
            back={{ href: `/dashboard/crm/tickets/knowledge-base/${articleId}`, label: 'Back to article' }}
        >

            <ZoruCard className="p-4">
                <ul className="flex flex-col gap-3">
                    {rows.map((r) => (
                        <li
                            key={r.label}
                            className="flex items-center justify-between rounded-md border border-zoru-line bg-zoru-surface-2/40 p-3"
                        >
                            <span className="inline-flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
                                <BookOpen className="h-3.5 w-3.5" />
                                {r.label}
                            </span>
                            <span className="text-[13px] text-zoru-ink">{r.value}</span>
                        </li>
                    ))}
                </ul>
            </ZoruCard>
        </EntityDetailShell>
    );
}
