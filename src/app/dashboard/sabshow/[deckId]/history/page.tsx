/**
 * Version history timeline for a deck.
 *
 * Restore is intentionally not wired up yet — the Rust crate
 * `sabshow-versions` only stores metadata (the deck-tree blob lives in
 * SabFiles). The TS replay coordinator hasn't landed; until it does the
 * "Restore" button just shows a toast (see `_history-actions.tsx`).
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/zoruui/button';
import { Card } from '@/components/zoruui/card';
import { EmptyState } from '@/components/sabcrm/20ui/compat';
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
        <div className="zoruui mx-auto w-full max-w-3xl space-y-4 p-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">{deck.title}</h1>
                    <p className="text-sm text-zoru-ink-muted">Version history</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href={`/dashboard/sabshow/${deckId}`}>Back to editor</Link>
                </Button>
            </header>

            {versions.length === 0 ? (
                <EmptyState
                    title="No saved versions yet"
                    description="Press 'Save version' in the editor to snapshot the current deck."
                />
            ) : (
                <ul className="space-y-2">
                    {versions.map((v) => (
                        <li key={v._id}>
                            <Card className="flex items-center justify-between gap-3 p-3">
                                <div>
                                    <div className="text-sm font-medium">
                                        v{v.version}
                                        {v.comment ? ` — ${v.comment}` : ''}
                                    </div>
                                    <div className="text-xs text-zoru-ink-muted">
                                        {new Date(v.savedAt).toLocaleString()}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    title="Restore is deferred — see sabshow-versions docs"
                                >
                                    Restore (soon)
                                </Button>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
