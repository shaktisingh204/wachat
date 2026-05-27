/**
 * Publish settings for a deck.
 *
 * Reads the existing publication (if any) and renders a small form for
 * slug + custom CSS + theme. The action lives in `_publish-form.tsx`.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/zoruui/button';
import {
    getSabshowDeck,
    listSabshowPublications,
} from '@/app/actions/sabshow.actions';

import { PublishForm } from './_publish-form';

export const dynamic = 'force-dynamic';

interface PublishPageProps {
    params: Promise<{ deckId: string }>;
}

export default async function PublishPage({ params }: PublishPageProps) {
    const { deckId } = await params;
    const deck = await getSabshowDeck(deckId);
    if (!deck) notFound();
    const publications = await listSabshowPublications(deckId);
    const existing = publications[0] ?? null;

    return (
        <div className="zoruui mx-auto w-full max-w-2xl space-y-4 p-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">{deck.title}</h1>
                    <p className="text-sm text-zoru-ink-muted">Publish settings</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href={`/dashboard/sabshow/${deckId}`}>Back to editor</Link>
                </Button>
            </header>

            <PublishForm deckId={deckId} existing={existing} />
        </div>
    );
}
