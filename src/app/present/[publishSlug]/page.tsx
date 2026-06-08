/**
 * Public deck viewer. Reads `sabshow_publications` by slug via the
 * UNAUTHENTICATED `/v1/sabshow/publications/public/{slug}` endpoint,
 * then renders the deck with the same slide-canvas engine the
 * authenticated present mode uses.
 *
 * Notes:
 *   - Slug binding is the only tenant scope here — there is no session.
 *   - The deck-tree (slides / elements) is fetched server-side via the
 *     authenticated rust-client because the server can issue a service
 *     JWT. The PUBLIC client browser never talks to the authenticated
 *     endpoints — it only ever sees the rendered HTML this page emits.
 *   - Custom CSS is injected via a `<style>` tag scoped by the
 *     `.ui20` ancestor.
 */
import { notFound } from 'next/navigation';

import { sabshowPublicationsApi } from '@/lib/rust-client/sabshow-publications';
import { sabshowSlidesApi } from '@/lib/rust-client/sabshow-slides';
import { sabshowElementsApi } from '@/lib/rust-client/sabshow-elements';
import type { SabshowElementDoc } from '@/lib/rust-client/sabshow-elements';

import { PublicPresent } from './_public-present';

export const dynamic = 'force-dynamic';

interface PublicPresentPageProps {
    params: Promise<{ publishSlug: string }>;
}

export default async function PublicPresentPage({
    params,
}: PublicPresentPageProps) {
    const { publishSlug } = await params;
    const publication = await sabshowPublicationsApi.getPublicBySlug(publishSlug);
    if (!publication) notFound();

    const slides = await sabshowSlidesApi.listByDeck(publication.deckId, false);
    const elementsBySlide: Record<string, SabshowElementDoc[]> = {};
    await Promise.all(
        slides.map(async (s) => {
            if (!s._id) return;
            elementsBySlide[s._id] = await sabshowElementsApi.listBySlide(s._id);
        })
    );

    return (
        <>
            {publication.customCss ? (
                <style
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{
                        __html: `.\\32 0ui.sabshow-public { ${publication.customCss} }`,
                    }}
                />
            ) : null}
            <PublicPresent
                slug={publication.slug}
                slides={slides}
                elementsBySlide={elementsBySlide}
            />
        </>
    );
}
