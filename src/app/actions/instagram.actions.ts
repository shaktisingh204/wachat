

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
