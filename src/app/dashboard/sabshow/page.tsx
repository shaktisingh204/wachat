/**
 * SabShow deck list — the landing surface at `/dashboard/sabshow`.
 *
 * Server-rendered list of every deck the current user owns OR was
 * shared into. The "+ New deck" + "From template" affordances live in
 * the `_components` client island.
 */
import Link from 'next/link';

import { Button } from '@/components/zoruui/button';
import { Card } from '@/components/zoruui/card';
import { Badge } from '@/components/zoruui/badge';
import { EmptyState } from '@/components/zoruui';
import { listSabshowDecks } from '@/app/actions/sabshow.actions';

import { NewDeckButton } from './_components/new-deck-button';

export const dynamic = 'force-dynamic';

export default async function SabshowIndexPage() {
    const { items: decks } = await listSabshowDecks({ status: 'all', limit: 50 });

    return (
        <div className="zoruui mx-auto w-full max-w-6xl space-y-6 p-6">
            <header className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">SabShow</h1>
                    <p className="text-sm text-zoru-ink-muted">
                        Collaborative presentations — slides, themes, comments, publish.
                    </p>
                </div>
                <NewDeckButton />
            </header>

            {decks.length === 0 ? (
                <EmptyState
                    title="No decks yet"
                    description="Create your first SabShow deck to get started."
                />
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {decks.map((deck) => (
                        <Card key={deck._id} className="p-4">
                            <Link
                                href={`/dashboard/sabshow/${deck._id}`}
                                className="block space-y-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-base font-medium">
                                        {deck.title}
                                    </div>
                                    {deck.status ? (
                                        <Badge
                                            variant={
                                                deck.status === 'published'
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                        >
                                            {deck.status}
                                        </Badge>
                                    ) : null}
                                </div>
                                <div className="text-xs text-zoru-ink-muted">
                                    v{deck.version ?? 1}
                                    {deck.updatedAt
                                        ? ` · updated ${new Date(deck.updatedAt).toLocaleDateString()}`
                                        : ''}
                                </div>
                            </Link>
                            <div className="mt-3 flex gap-2">
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/dashboard/sabshow/${deck._id}`}>
                                        Open
                                    </Link>
                                </Button>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link
                                        href={`/dashboard/sabshow/${deck._id}/history`}
                                    >
                                        History
                                    </Link>
                                </Button>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link
                                        href={`/dashboard/sabshow/${deck._id}/publish`}
                                    >
                                        Publish
                                    </Link>
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
