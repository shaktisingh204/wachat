import React from "react";
/**
 * /portal/client/knowledge-base/[id] — Read-only article detail.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getClientKnowledgeBaseArticle } from '@/app/actions/client-portal.actions';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';

function fmtDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString();
}

async function ClientKbArticlePageContent({
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
                className="self-start text-sm text-[var(--st-text-secondary)] hover:underline"
            >
                ← Back to articles
            </Link>

            <Card>
                <CardHeader>
                    <CardTitle>{article.title}</CardTitle>
                    <p className="text-xs text-[var(--st-text-secondary)]">
                        {article.category ? `${article.category} · ` : ''}
                        Updated {fmtDate(article.updatedAt)}
                    </p>
                </CardHeader>
                <CardBody>
                    {article.body ? (
                        <div
                            className="prose prose-zinc max-w-none text-sm text-[var(--st-text)]"
                            // KB articles are authored in the admin and trusted; rendering
                            // as HTML preserves the editor's formatting (headings, lists,
                            // links). If the source content is plaintext, this still
                            // renders verbatim.
                            dangerouslySetInnerHTML={{ __html: article.body }}
                        />
                    ) : (
                        <p className="text-sm text-[var(--st-text-secondary)]">No content available.</p>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}


export default function ClientKbArticlePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ClientKbArticlePageContent params={params} />
    </React.Suspense>
  );
}
