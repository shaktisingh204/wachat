"use server";

/**
 * Instagram Graph-API server actions.
 *
 * Now backed by the Rust BFF crate `wachat-instagram` (mounted at
 * `/v1/instagram`) — every public function here is a thin shim that calls
 * into `wachatInstagramApi` and forwards the response unchanged. The
 * legacy `{ payload?, error? }` envelope is preserved end-to-end so call
 * sites can keep branching on `error` / `instagramAccount` / `media` /
 * `comments` / `stories` / `account` / `hashtagId` / `message`.
 *
 * Direct `axios` calls to `graph.facebook.com` have been removed — the
 * Rust client owns retry, timeout, error parsing, and Bearer-token
 * plumbing. The Mongo lookup for `accessToken` / `facebookPageId` happens
 * server-side in the crate (see `load_project_for` in
 * `rust/crates/wachat-instagram/src/instagram.rs`).
 *
 * NOTE: `rustClient` (in `src/lib/rust-client/index.ts`) does not yet
 * re-export `wachatInstagram`; the registration is intentionally left for
 * a follow-up commit. Until then we import the namespace directly so this
 * file already has zero `axios` traffic to Meta.
 */
import { wachatInstagramApi } from '@/lib/rust-client/wachat-instagram';
import { getErrorMessage } from '@/lib/utils';

/**
 * Reshape Graph's `/insights` `data` array into a flat `Record<string, number>`.
 * The Rust BFF passes Graph's response through verbatim; the legacy call sites
 * expect `{ name -> value }`, so we collapse `values[0].value` per metric.
 */
function insightsArrayToRecord(data: any[] | undefined): Record<string, number> {
    const out: Record<string, number> = {};
    for (const entry of data ?? []) {
        const name = entry?.name as string | undefined;
        const value = entry?.values?.[0]?.value;
        if (name && typeof value === 'number') out[name] = value;
    }
    return out;
}

export async function getInstagramAccountForPage(projectId: string): Promise<{ instagramAccount?: any; error?: string }> {
    try {
        return await wachatInstagramApi.getAccount(projectId);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getInstagramMedia(projectId: string): Promise<{ media?: any[]; error?: string }> {
    try {
        return await wachatInstagramApi.listMedia(projectId);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getInstagramMediaDetails(projectId: string, mediaId: string): Promise<{ media?: any; error?: string }> {
    try {
        return await wachatInstagramApi.getMediaDetails(projectId, mediaId);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getInstagramComments(mediaId: string, projectId: string): Promise<{ comments?: any[]; error?: string }> {
    try {
        return await wachatInstagramApi.getComments(projectId, mediaId);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getInstagramStories(projectId: string): Promise<{ stories?: any[]; error?: string }> {
    try {
        return await wachatInstagramApi.getStories(projectId);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function discoverInstagramAccount(username: string, projectId: string): Promise<{ account?: any; error?: string }> {
    try {
        return await wachatInstagramApi.discoverAccount(projectId, username);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function createInstagramImagePost(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const imageUrl = formData.get('imageUrl') as string;
    const caption = formData.get('caption') as string;

    if (!projectId || !imageUrl) {
        return { error: "Project ID and Image URL are required." };
    }

    try {
        return await wachatInstagramApi.createImagePost(projectId, {
            imageUrl,
            caption: caption ?? undefined,
        });
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function searchHashtagId(hashtag: string, projectId: string): Promise<{ hashtagId?: string; error?: string }> {
    try {
        return await wachatInstagramApi.searchHashtagId(projectId, hashtag);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getHashtagRecentMedia(hashtagId: string, projectId: string): Promise<{ media?: any[]; error?: string }> {
    try {
        return await wachatInstagramApi.getHashtagRecentMedia(projectId, hashtagId);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Search the IG hashtag id for a tag, wrapped in a `{ hashtagId? , error? }`
 * envelope. Thin alias around {@link searchHashtagId} so the call sites that
 * follow the `search<Resource>` naming can stay consistent.
 */
export async function searchInstagramHashtag(projectId: string, tag: string): Promise<{ hashtagId?: string; error?: string }> {
    const cleaned = (tag || '').replace(/^#/, '').trim();
    if (!cleaned) return { error: 'Hashtag is required.' };
    return searchHashtagId(cleaned, projectId);
}

/**
 * Top-performing media for a hashtag. Backed by the Rust BFF's
 * `/{hashtagId}/top_media` shim. Returns `{ data, error }` so call sites can
 * keep branching on `error` and reading `data` as a plain array.
 */
export async function getHashtagTopMedia(projectId: string, hashtagId: string): Promise<{ data?: any[]; error?: string }> {
    try {
        const resp = await wachatInstagramApi.getHashtagTopMedia(projectId, hashtagId);
        if (resp.error) return { error: resp.error };
        return { data: resp.media ?? [] };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Published Reels for the connected IG account. The Rust crate filters the
 * `/media` edge by `media_product_type == "REELS"` server-side; this shim
 * just forwards the envelope.
 */
export async function getInstagramReels(projectId: string, limit = 25): Promise<{ reels?: any[]; error?: string }> {
    try {
        return await wachatInstagramApi.getReels(projectId, limit);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Fetch insights for a single reel. Best-effort: Meta sometimes denies
 * specific metrics depending on media age / account type, so we surface
 * whatever `data` came back and let the caller treat missing keys as 0.
 */
export async function getInstagramReelInsights(projectId: string, mediaId: string): Promise<{ insights?: Record<string, number>; error?: string }> {
    try {
        const resp = await wachatInstagramApi.getMediaInsights(
            projectId,
            mediaId,
            'plays,reach,likes,comments,shares,saves',
        );
        if (resp.error) return { error: resp.error };
        return { insights: insightsArrayToRecord(resp.data) };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Per-story metrics. Same best-effort posture as
 * {@link getInstagramReelInsights}.
 */
export async function getInstagramStoryInsights(projectId: string, mediaId: string): Promise<{ insights?: Record<string, number>; error?: string }> {
    try {
        const resp = await wachatInstagramApi.getMediaInsights(
            projectId,
            mediaId,
            'impressions,reach,replies,exits,taps_forward,taps_back',
        );
        if (resp.error) return { error: resp.error };
        return { insights: insightsArrayToRecord(resp.data) };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * List Instagram DM conversations on the connected Facebook Page. Equivalent
 * to `GET /{pageId}/conversations?platform=instagram`.
 */
export async function getInstagramConversations(projectId: string): Promise<{ conversations?: any[]; error?: string }> {
    try {
        return await wachatInstagramApi.getConversations(projectId);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * List messages in an Instagram conversation thread.
 */
export async function getInstagramConversationMessages(projectId: string, threadId: string): Promise<{ messages?: any[]; error?: string }> {
    try {
        return await wachatInstagramApi.getConversationMessages(projectId, threadId);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
