/**
 * /portal/client/knowledge-base/[id] — Read-only article detail.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getClientKnowledgeBaseArticle } from '@/app/actions/client-portal.actions';
import {
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui/card';

function fmtDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString();
}

export default async function ClientKbArticlePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const article = await getClientKnowledgeBaseArticle(id);
    if (!article) notFound();

    return (
        <div className="flex flex-col gap-4">
            <Link
                href="/portal/client/knowledge-base"
                className="self-start text-sm text-zoru-ink-muted hover:underline"
            >
                ← Back to articles
            </Link>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>{article.title}</ZoruCardTitle>
                    <p className="text-xs text-zoru-ink-muted">
                        {article.category ? `${article.category} · ` : ''}
                        Updated {fmtDate(article.updatedAt)}
                    </p>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {article.body ? (
                        <div
                            className="prose prose-zinc max-w-none text-sm text-zoru-ink"
                            // KB articles are authored in the admin and trusted; rendering
                            // as HTML preserves the editor's formatting (headings, lists,
                            // links). If the source content is plaintext, this still
                            // renders verbatim.
                            dangerouslySetInnerHTML={{ __html: article.body }}
                        />
                    ) : (
                        <p className="text-sm text-zoru-ink-muted">No content available.</p>
                    )}
                </ZoruCardContent>
            </Card>
        </div>
    );
}
