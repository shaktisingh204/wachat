/**
 * SabShow deck list, the landing surface at `/dashboard/sabshow`.
 *
 * Server-rendered list of every deck the current user owns OR was
 * shared into. The "+ New deck" + "From template" affordances live in
 * the `_components` client island.
 */
import Link from 'next/link';
import { Clock3, Eye, FileText, History, Layers, Presentation, Send } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    EmptyState,
    PageActions,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
} from '@/components/sabcrm/20ui';
import { listSabshowDecks } from '@/app/actions/sabshow.actions';
import type { SabshowDeckDoc } from '@/lib/rust-client/sabshow-decks';

import { NewDeckButton } from './_components/new-deck-button';

export const dynamic = 'force-dynamic';

function statusTone(status: SabshowDeckDoc['status']): 'success' | 'warning' | 'neutral' {
    if (status === 'published') return 'success';
    if (status === 'archived') return 'neutral';
    return 'warning';
}

function statusLabel(status: SabshowDeckDoc['status']): string {
    if (status === 'published') return 'Published';
    if (status === 'archived') return 'Archived';
    return 'Draft';
}

function formatUpdated(value?: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export default async function SabshowIndexPage() {
    const { items: decks } = await listSabshowDecks({ status: 'all', limit: 50 });

    const total = decks.length;
    const published = decks.filter((d) => d.status === 'published').length;
    const drafts = decks.filter((d) => d.status !== 'published' && d.status !== 'archived').length;

    return (
        <div className="20ui mx-auto w-full max-w-6xl space-y-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabShow</PageEyebrow>
                    <PageTitle>Presentations</PageTitle>
                    <PageDescription>
                        Build slide decks, present live, and publish a shareable link.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <NewDeckButton />
                </PageActions>
            </PageHeader>

            <section
                aria-label="Deck summary"
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
                <StatCard label="Decks" value={total} icon={Presentation} accent="#6366f1" />
                <StatCard label="Published" value={published} icon={Send} accent="#16a34a" />
                <StatCard label="Drafts" value={drafts} icon={FileText} accent="#f59e0b" />
            </section>

            <section aria-label="Your decks" className="space-y-3">
                {decks.length === 0 ? (
                    <Card padding="lg">
                        <EmptyState
                            icon={Presentation}
                            title="No decks yet"
                            description="Create your first deck to start building slides, presenting, and publishing."
                            action={<NewDeckButton />}
                        />
                    </Card>
                ) : (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {decks.map((deck) => {
                            const updated = formatUpdated(deck.updatedAt);
                            return (
                                <li key={deck._id}>
                                    <Card
                                        variant="interactive"
                                        padding="md"
                                        className="flex h-full flex-col gap-3"
                                    >
                                        <Link
                                            href={`/dashboard/sabshow/${deck._id}`}
                                            className="group flex flex-col gap-2 rounded-[var(--st-radius)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <span
                                                        className="grid size-8 shrink-0 place-items-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                                                        aria-hidden="true"
                                                    >
                                                        <Presentation size={15} />
                                                    </span>
                                                    <span className="truncate text-base font-medium text-[var(--st-text)] group-hover:text-[var(--st-accent)]">
                                                        {deck.title}
                                                    </span>
                                                </span>
                                                <Badge
                                                    tone={statusTone(deck.status)}
                                                    kind={deck.status === 'published' ? 'soft' : 'outline'}
                                                >
                                                    {statusLabel(deck.status)}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-[var(--st-text-secondary)] tabular-nums">
                                                <span className="inline-flex items-center gap-1">
                                                    <Layers size={13} aria-hidden="true" />v
                                                    {deck.version ?? 1}
                                                </span>
                                                {updated ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock3 size={13} aria-hidden="true" />
                                                        {updated}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </Link>
                                        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={`/dashboard/sabshow/${deck._id}`}>
                                                    <Presentation size={13} aria-hidden="true" />
                                                    Open
                                                </Link>
                                            </Button>
                                            <Button asChild variant="ghost" size="sm">
                                                <Link
                                                    href={`/dashboard/sabshow/${deck._id}/history`}
                                                >
                                                    <History size={13} aria-hidden="true" />
                                                    History
                                                </Link>
                                            </Button>
                                            <Button asChild variant="ghost" size="sm">
                                                <Link
                                                    href={`/dashboard/sabshow/${deck._id}/publish`}
                                                >
                                                    <Eye size={13} aria-hidden="true" />
                                                    Publish
                                                </Link>
                                            </Button>
                                        </div>
                                    </Card>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
