/**
 * SabShow deck editor — `/dashboard/sabshow/[deckId]`.
 *
 * Server component: loads the deck + its slides + the elements for the
 * current (or first) slide, then hands everything to the client editor
 * island. The editor owns drag / resize / inline-edit and talks to the
 * server via `sabshow.actions`.
 */
import { notFound } from 'next/navigation';

import {
    getSabshowDeck,
    listSabshowSlides,
    listSabshowElements,
} from '@/app/actions/sabshow.actions';

import { DeckEditorShell } from './_components/deck-editor-shell';

export const dynamic = 'force-dynamic';

interface DeckEditorPageProps {
    params: Promise<{ deckId: string }>;
}

export default async function DeckEditorPage({ params }: DeckEditorPageProps) {
    const { deckId } = await params;
    const deck = await getSabshowDeck(deckId);
    if (!deck) {
        notFound();
    }

    const slides = await listSabshowSlides(deckId, true);
    const firstSlideId = slides[0]?._id;
    const initialElements = firstSlideId
        ? await listSabshowElements(firstSlideId)
        : [];

    return (
        <DeckEditorShell
            deck={deck}
            initialSlides={slides}
            initialElements={initialElements}
            initialSlideId={firstSlideId ?? null}
        />
    );
}
