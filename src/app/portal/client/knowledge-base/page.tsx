import React from "react";
/**
 * /portal/client/knowledge-base — Read-only article list with search +
 * category sidebar. Search is server-driven via the `q` and `category`
 * search params.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { getClientKnowledgeBase } from '@/app/actions/client-portal.actions';
import {
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui/card';
import { EmptyState } from '@/components/zoruui/empty-state';
import { KbSearch } from '@/components/client-portal/kb-search';
import { cn } from '@/components/zoruui/lib/cn';

function fmtDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString();
}

async function ClientKnowledgeBasePageContent({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; category?: string }>;
}) {
    const sp = await searchParams;
    const articles = await getClientKnowledgeBase({
        search: sp.q,
        category: sp.category,
    });

    // Build the category list from all-articles (unfiltered by category).
    const all = sp.category ? await getClientKnowledgeBase({ search: sp.q }) : articles;
    const categories = Array.from(
        new Set(all.map((a) => a.category).filter((c): c is string => !!c)),
    ).sort();

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-semibold text-zoru-ink">Knowledge Base</h1>
                <p className="text-sm text-zoru-ink-muted">
                    Browse help articles and guides.
                </p>
            </div>

            <KbSearch />

            <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                <aside className="flex flex-col gap-1">
                    <Link
                        href="/portal/client/knowledge-base"
                        className={cn(
                            'rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors',
                            !sp.category
                                ? 'bg-zoru-surface-2 text-zoru-ink'
                                : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
                        )}
                    >
                        All categories
                    </Link>
                    {categories.map((c) => (
                        <Link
                            key={c}
                            href={`/portal/client/knowledge-base?category=${encodeURIComponent(c)}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`}
                            className={cn(
                                'rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors',
                                sp.category === c
                                    ? 'bg-zoru-surface-2 text-zoru-ink'
                                    : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
                            )}
                        >
                            {c}
                        </Link>
                    ))}
                </aside>

                <div className="flex flex-col gap-3">
                    {articles.length === 0 ? (
                        <EmptyState
                            title="No articles found"
                            description={sp.q ? `Nothing matches “${sp.q}”.` : 'No published articles in this category.'}
                        />
                    ) : (
                        articles.map((a) => (
                            <Link key={a._id} href={`/portal/client/knowledge-base/${a._id}`}>
                                <Card className="transition-colors hover:bg-zoru-surface-2">
                                    <ZoruCardHeader>
                                        <ZoruCardTitle>{a.title}</ZoruCardTitle>
                                    </ZoruCardHeader>
                                    <ZoruCardContent>
                                        {a.excerpt ? (
                                            <p className="line-clamp-2 text-sm text-zoru-ink-muted">{a.excerpt}</p>
                                        ) : null}
                                        <div className="mt-2 text-xs text-zoru-ink-muted">
                                            {a.category ? `${a.category} · ` : ''}
                                            Updated {fmtDate(a.updatedAt)}
                                        </div>
                                    </ZoruCardContent>
                                </Card>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}


export default function ClientKnowledgeBasePage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; category?: string }>;
}) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ClientKnowledgeBasePageContent searchParams={searchParams} />
    </React.Suspense>
  );
}
