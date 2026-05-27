/**
 * Present mode for the deck owner / shared editors.
 *
 * Loads the deck + slides + elements upfront, then hands off to the
 * client present view. The optional `[slideIdx]` path segment is handled
 * by a child route — this base route opens at slide 0.
 */
import { notFound } from 'next/navigation';

import {
    getSabshowDeck,
    listSabshowElements,
    listSabshowSlides,
} from '@/app/actions/sabshow.actions';
import type { SabshowElementDoc } from '@/lib/rust-client/sabshow-elements';

import { PresentView } from './_present-view';

export const dynamic = 'force-dynamic';

interface PresentPageProps {
    params: Promise<{ deckId: string }>;
}

export default async function PresentPage({ params }: PresentPageProps) {
    const { deckId } = await params;
    const deck = await getSabshowDeck(deckId);
    if (!deck) notFound();
    const slides = await listSabshowSlides(deckId, false);

    // Bulk-fetch all elements upfront so present mode never blocks on
    // navigation. The Rust list endpoint accepts `deckId` for this.
    const elementsBySlide = new Map<string, SabshowElementDoc[]>();
    await Promise.all(
        slides.map(async (s) => {
            if (!s._id) return;
            const els = await listSabshowElements(s._id);
            elementsBySlide.set(s._id, els);
        })
    );

    return (
        <PresentView
            deckTitle={deck.title}
            slides={slides}
            elementsBySlide={Object.fromEntries(elementsBySlide.entries())}
            initialIndex={0}
        />
    );
}
