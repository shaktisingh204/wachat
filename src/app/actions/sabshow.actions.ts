'use server';

/**
 * SabShow server actions.
 *
 * Thin orchestration over the SabShow rust-client modules
 * (`src/lib/rust-client/sabshow-*.ts`). Each action:
 *   1. Resolves the current session via `getSession()`.
 *   2. Delegates to the Rust BFF, which scopes by `ownerUserId` /
 *      `sharedWithUserIds`.
 *   3. Calls `revalidatePath` on the affected dashboard surfaces.
 *
 * Public flows (the `/present/[slug]` page) do NOT go through here —
 * they read `sabshowPublicationsApi.getPublicBySlug(...)` directly via a
 * server component, which uses the unauthenticated public endpoint.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import {
    sabshowDecksApi,
    type SabshowDeckCreateInput,
    type SabshowDeckDoc,
    type SabshowDeckListParams,
    type SabshowDeckListResult,
    type SabshowDeckUpdateInput,
} from '@/lib/rust-client/sabshow-decks';
import {
    sabshowSlidesApi,
    type SabshowSlideCreateInput,
    type SabshowSlideDoc,
    type SabshowSlideLayoutKind,
    type SabshowSlideUpdateInput,
} from '@/lib/rust-client/sabshow-slides';
import {
    sabshowElementsApi,
    type SabshowElementCreateInput,
    type SabshowElementDoc,
    type SabshowElementKind,
    type SabshowElementUpdateInput,
} from '@/lib/rust-client/sabshow-elements';
import {
    sabshowThemesApi,
    type SabshowThemeDoc,
} from '@/lib/rust-client/sabshow-themes';
import {
    sabshowCommentsApi,
    type SabshowCommentCreateInput,
    type SabshowCommentDoc,
} from '@/lib/rust-client/sabshow-comments';
import {
    sabshowVersionsApi,
    type SabshowVersionDoc,
} from '@/lib/rust-client/sabshow-versions';
import {
    sabshowPublicationsApi,
    type SabshowPublicationDoc,
    type SabshowPublishInput,
} from '@/lib/rust-client/sabshow-publications';

function revalidateDeckSurfaces(deckId?: string): void {
    revalidatePath('/dashboard/sabshow');
    if (deckId) {
        revalidatePath(`/dashboard/sabshow/${deckId}`);
        revalidatePath(`/dashboard/sabshow/${deckId}/history`);
        revalidatePath(`/dashboard/sabshow/${deckId}/publish`);
    }
}

async function requireUser(): Promise<string> {
    const session = await getSession();
    if (!session?.user?._id) {
        throw new Error('Unauthorized');
    }
    return session.user._id;
}

/* ─── Decks ────────────────────────────────────────────────────────────── */

export async function listSabshowDecks(
    params: SabshowDeckListParams = {}
): Promise<SabshowDeckListResult> {
    await requireUser();
    return sabshowDecksApi.list(params);
}

export async function getSabshowDeck(
    deckId: string
): Promise<SabshowDeckDoc | null> {
    await requireUser();
    return sabshowDecksApi.getById(deckId);
}

export async function createSabshowDeck(
    input: SabshowDeckCreateInput
): Promise<SabshowDeckDoc> {
    await requireUser();
    const deck = await sabshowDecksApi.create(input);
    revalidateDeckSurfaces();
    return deck;
}

export async function updateSabshowDeck(
    deckId: string,
    patch: SabshowDeckUpdateInput
): Promise<SabshowDeckDoc> {
    await requireUser();
    const deck = await sabshowDecksApi.update(deckId, patch);
    revalidateDeckSurfaces(deckId);
    return deck;
}

export async function archiveSabshowDeck(
    deckId: string
): Promise<{ archived: boolean }> {
    await requireUser();
    const res = await sabshowDecksApi.delete(deckId);
    revalidateDeckSurfaces(deckId);
    return res;
}

export async function shareSabshowDeck(
    deckId: string,
    body: { addUserIds?: string[]; removeUserIds?: string[] }
): Promise<SabshowDeckDoc> {
    await requireUser();
    const deck = await sabshowDecksApi.share(deckId, body);
    revalidateDeckSurfaces(deckId);
    return deck;
}

/* ─── Slides ───────────────────────────────────────────────────────────── */

export async function listSabshowSlides(
    deckId: string,
    includeHidden = false
): Promise<SabshowSlideDoc[]> {
    await requireUser();
    return sabshowSlidesApi.listByDeck(deckId, includeHidden);
}

export async function addSabshowSlide(
    deckId: string,
    position?: number,
    layoutKind?: SabshowSlideLayoutKind
): Promise<SabshowSlideDoc> {
    await requireUser();
    const input: SabshowSlideCreateInput = { deckId, position, layoutKind };
    const slide = await sabshowSlidesApi.create(input);
    revalidateDeckSurfaces(deckId);
    return slide;
}

export async function duplicateSabshowSlide(
    slideId: string
): Promise<SabshowSlideDoc> {
    await requireUser();
    const slide = await sabshowSlidesApi.duplicate(slideId);
    revalidateDeckSurfaces(slide.deckId);
    return slide;
}

export async function reorderSabshowSlide(
    slideId: string,
    newPosition: number
): Promise<SabshowSlideDoc> {
    await requireUser();
    const slide = await sabshowSlidesApi.reorder(slideId, newPosition);
    revalidateDeckSurfaces(slide.deckId);
    return slide;
}

export async function updateSabshowSlide(
    slideId: string,
    patch: SabshowSlideUpdateInput
): Promise<SabshowSlideDoc> {
    await requireUser();
    const slide = await sabshowSlidesApi.update(slideId, patch);
    revalidateDeckSurfaces(slide.deckId);
    return slide;
}

export async function deleteSabshowSlide(
    slideId: string,
    deckId: string
): Promise<{ deleted: boolean }> {
    await requireUser();
    const res = await sabshowSlidesApi.delete(slideId);
    revalidateDeckSurfaces(deckId);
    return res;
}

/* ─── Elements ─────────────────────────────────────────────────────────── */

export async function listSabshowElements(
    slideId: string
): Promise<SabshowElementDoc[]> {
    await requireUser();
    return sabshowElementsApi.listBySlide(slideId);
}

/**
 * Add a positioned element (text / image / shape / chart / video / code).
 * `args` carries the geometry + kind-specific `configJson` payload.
 */
export async function addSabshowElement(
    slideId: string,
    kind: SabshowElementKind,
    args: Omit<SabshowElementCreateInput, 'slideId' | 'kind'>
): Promise<SabshowElementDoc> {
    await requireUser();
    const element = await sabshowElementsApi.create({ slideId, kind, ...args });
    revalidateDeckSurfaces(element.deckId);
    return element;
}

export async function updateSabshowElement(
    elementId: string,
    args: SabshowElementUpdateInput
): Promise<SabshowElementDoc> {
    await requireUser();
    const element = await sabshowElementsApi.update(elementId, args);
    revalidateDeckSurfaces(element.deckId);
    return element;
}

export async function deleteSabshowElement(
    elementId: string,
    deckId: string
): Promise<{ deleted: boolean }> {
    await requireUser();
    const res = await sabshowElementsApi.delete(elementId);
    revalidateDeckSurfaces(deckId);
    return res;
}

/* ─── Themes ───────────────────────────────────────────────────────────── */

export async function listSabshowThemes(): Promise<SabshowThemeDoc[]> {
    await requireUser();
    return sabshowThemesApi.list(true);
}

/* ─── Comments ─────────────────────────────────────────────────────────── */

export async function listSabshowComments(
    deckId: string,
    opts: { slideId?: string; includeResolved?: boolean } = {}
): Promise<SabshowCommentDoc[]> {
    await requireUser();
    return sabshowCommentsApi.listByDeck(deckId, opts);
}

export async function addSabshowComment(
    input: SabshowCommentCreateInput
): Promise<SabshowCommentDoc> {
    await requireUser();
    const comment = await sabshowCommentsApi.create(input);
    revalidateDeckSurfaces(input.deckId);
    return comment;
}

export async function resolveSabshowComment(
    commentId: string,
    deckId: string,
    resolved = true
): Promise<SabshowCommentDoc> {
    await requireUser();
    const comment = await sabshowCommentsApi.update(commentId, { resolved });
    revalidateDeckSurfaces(deckId);
    return comment;
}

/* ─── Versions ─────────────────────────────────────────────────────────── */

export async function listSabshowVersions(
    deckId: string
): Promise<SabshowVersionDoc[]> {
    await requireUser();
    return sabshowVersionsApi.listByDeck(deckId);
}

/**
 * Save a version snapshot.
 *
 * TODO (wiring): the caller is expected to have uploaded the deck-tree
 * JSON to SabFiles and to pass the resulting `snapshotFileId` here. The
 * convenience overload below skips the upload and just records the
 * metadata pointer at `pending://<deckId>` — replace with the real
 * SabFiles upload once the editor knows how to serialise the tree.
 */
export async function saveSabshowVersion(
    deckId: string,
    comment?: string,
    snapshotFileId?: string
): Promise<SabshowVersionDoc> {
    await requireUser();
    const version = await sabshowVersionsApi.create({
        deckId,
        snapshotFileId: snapshotFileId ?? `pending://${deckId}`,
        comment,
    });
    revalidateDeckSurfaces(deckId);
    return version;
}

/* ─── Publications ─────────────────────────────────────────────────────── */

export async function listSabshowPublications(
    deckId?: string
): Promise<SabshowPublicationDoc[]> {
    await requireUser();
    return sabshowPublicationsApi.list(deckId);
}

export async function publishSabshowDeck(
    deckIdOrInput: string | SabshowPublishInput,
    slug?: string
): Promise<SabshowPublicationDoc> {
    await requireUser();
    const input: SabshowPublishInput =
        typeof deckIdOrInput === 'string'
            ? { deckId: deckIdOrInput, slug: slug ?? '' }
            : deckIdOrInput;
    if (!input.slug) {
        throw new Error('slug is required');
    }
    const pub = await sabshowPublicationsApi.publish(input);
    revalidateDeckSurfaces(input.deckId);
    return pub;
}

export async function unpublishSabshowDeck(
    publicationId: string,
    deckId: string
): Promise<{ deleted: boolean }> {
    await requireUser();
    const res = await sabshowPublicationsApi.unpublish(publicationId);
    revalidateDeckSurfaces(deckId);
    return res;
}
