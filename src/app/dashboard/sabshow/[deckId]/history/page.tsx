/**
 * Version history timeline for a deck.
 *
 * Restore is intentionally not wired up yet. The Rust crate
 * `sabshow-versions` only stores metadata (the deck-tree blob lives in
 * SabFiles). The TS replay coordinator hasn't landed; until it does the
 * "Restore" button stays disabled (see `sabshow-versions` docs).
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GitCommitVertical, History } from 'lucide-react';

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
} from '@/components/sabcrm/20ui';
import {
    getSabshowDeck,
    listSabshowVersions,
} from '@/app/actions/sabshow.actions';

export const dynamic = 'force-dynamic';

interface HistoryPageProps {
    params: Promise<{ deckId: string }>;
}

export default async function HistoryPage({ params }: HistoryPageProps) {
    const { deckId } = await params;
    const deck = await getSabshowDeck(deckId);
    if (!deck) notFound();
    const versions = await listSabshowVersions(deckId);

    return (
        <div className="20ui mx-auto w-full max-w-3xl space-y-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>{deck.title}</PageEyebrow>
                    <PageTitle>Version history</PageTitle>
                    <PageDescription>
                        Every saved snapshot of this deck, newest first.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button asChild variant="outline">
                        <Link href={`/dashboard/sabshow/${deckId}`}>
                            <ArrowLeft size={14} aria-hidden="true" />
                            Back to editor
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>

            {versions.length === 0 ? (
                <Card padding="lg">
                    <EmptyState
                        icon={History}
                        title="No saved versions yet"
                        description="Choose Save version in the editor to snapshot the current deck. Snapshots show up here."
                        action={
                            <Button asChild>
                                <Link href={`/dashboard/sabshow/${deckId}`}>Open editor</Link>
                            </Button>
                        }
                    />
                </Card>
            ) : (
                <Card padding="none">
                    <ol className="divide-y divide-[var(--st-border)]">
                        {versions.map((v) => (
                            <li
                                key={v._id}
                                className="flex items-center justify-between gap-3 px-4 py-3"
                            >
                                <div className="flex min-w-0 items-start gap-3">
                                    <span
                                        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                                        aria-hidden="true"
                                    >
                                        <GitCommitVertical size={16} />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Badge tone="neutral" kind="outline" className="tabular-nums">
                                                v{v.version}
                                            </Badge>
                                            {v.comment ? (
                                                <span className="truncate text-sm font-medium text-[var(--st-text)]">
                                                    {v.comment}
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="mt-0.5 text-xs text-[var(--st-text-secondary)] tabular-nums">
                                            {new Date(v.savedAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    title="Restore is not available yet"
                                >
                                    Restore
                                </Button>
                            </li>
                        ))}
                    </ol>
                </Card>
            )}
        </div>
    );
}
