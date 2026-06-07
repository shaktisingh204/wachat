/**
 * SabShow deck list, the landing surface at `/dashboard/sabshow`.
 *
 * Server-rendered list of every deck the current user owns OR was
 * shared into. The "+ New deck" + "From template" affordances live in
 * the `_components` client island.
 */
import Link from 'next/link';

import {
    Badge,
    Button,
    Card,
    EmptyState,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
} from '@/components/sabcrm/20ui';
import { listSabshowDecks } from '@/app/actions/sabshow.actions';

import { NewDeckButton } from './_components/new-deck-button';

export const dynamic = 'force-dynamic';

export default async function SabshowIndexPage() {
    const { items: decks } = await listSabshowDecks({ status: 'all', limit: 50 });

    return (
        <div className="ui20 mx-auto w-full max-w-6xl space-y-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>SabShow</PageTitle>
                    <PageDescription>
                        Collaborative presentations. Slides, themes, comments, publish.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <NewDeckButton />
                </PageActions>
            </PageHeader>

            {decks.length === 0 ? (
                <EmptyState
                    title="No decks yet"
                    description="Create your first SabShow deck to get started."
                />
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {decks.map((deck) => (
                        <Card key={deck._id} padding="md">
                            <Link
                                href={`/dashboard/sabshow/${deck._id}`}
                                className="block space-y-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-base font-medium text-[var(--st-text)]">
                                        {deck.title}
                                    </div>
                                    {deck.status ? (
                                        <Badge
                                            tone={
                                                deck.status === 'published'
                                                    ? 'success'
                                                    : 'neutral'
                                            }
                                            kind={
                                                deck.status === 'published'
                                                    ? 'soft'
                                                    : 'outline'
                                            }
                                        >
                                            {deck.status}
                                        </Badge>
                                    ) : null}
                                </div>
                                <div className="text-xs text-[var(--st-text-secondary)]">
                                    v{deck.version ?? 1}
                                    {deck.updatedAt
                                        ? ` · updated ${new Date(deck.updatedAt).toLocaleDateString()}`
                                        : ''}
                                </div>
                            </Link>
                            <div className="mt-3 flex gap-2">
                                <Link href={`/dashboard/sabshow/${deck._id}`}>
                                    <Button variant="outline" size="sm">
                                        Open
                                    </Button>
                                </Link>
                                <Link href={`/dashboard/sabshow/${deck._id}/history`}>
                                    <Button variant="ghost" size="sm">
                                        History
                                    </Button>
                                </Link>
                                <Link href={`/dashboard/sabshow/${deck._id}/publish`}>
                                    <Button variant="ghost" size="sm">
                                        Publish
                                    </Button>
                                </Link>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
