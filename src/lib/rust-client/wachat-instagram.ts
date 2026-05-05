/**
 * Client for the wachat-instagram router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/instagram` by the
 * `wachat-instagram` crate (see `rust/crates/wachat-instagram/src/lib.rs`).
 * Each method is a thin shim around {@link rustFetch} preserving the
 * legacy `instagram.actions.ts` envelope shape so call sites can keep
 * branching on `error` / `instagramAccount` / `media` / etc.
 *
 *   GET    /projects/:id/account                              → getAccount
 *   GET    /projects/:id/media                                → listMedia
 *   POST   /projects/:id/media                                → createImagePost
 *   GET    /projects/:id/media/:mediaId                       → getMediaDetails
 *   GET    /projects/:id/media/:mediaId/comments              → getComments
 *   GET    /projects/:id/stories                              → getStories
 *   GET    /projects/:id/discover/:username                   → discoverAccount
 *   GET    /projects/:id/hashtag-search?q=...                 → searchHashtagId
 *   GET    /projects/:id/hashtags/:hashtagId/recent-media     → getHashtagRecentMedia
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/instagram';

function enc(s: string): string {
    return encodeURIComponent(s);
}

// ---------------------------------------------------------------------------
// Response envelopes — every method mirrors the legacy
// `{ payload?, error? }` shape so the caller's existing `if (error)` branches
// still work unchanged.
// ---------------------------------------------------------------------------

export interface InstagramAccountResp {
    instagramAccount?: any;
    error?: string;
}

export interface InstagramMediaListResp {
    media?: any[];
    error?: string;
}

export interface InstagramMediaDetailsResp {
    media?: any;
    error?: string;
}

export interface InstagramCommentsResp {
    comments?: any[];
    error?: string;
}

export interface InstagramStoriesResp {
    stories?: any[];
    error?: string;
}

export interface InstagramDiscoverResp {
    account?: any;
    error?: string;
}

export interface InstagramHashtagIdResp {
    hashtagId?: string;
    error?: string;
}

export interface InstagramImagePostResp {
    message?: string;
    error?: string;
}

export interface CreateInstagramImagePostBody {
    imageUrl: string;
    caption?: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatInstagramApi = {
    getAccount: (projectId: string) =>
        rustFetch<InstagramAccountResp>(`${BASE}/projects/${enc(projectId)}/account`),

    listMedia: (projectId: string) =>
        rustFetch<InstagramMediaListResp>(`${BASE}/projects/${enc(projectId)}/media`),

    getMediaDetails: (projectId: string, mediaId: string) =>
        rustFetch<InstagramMediaDetailsResp>(
            `${BASE}/projects/${enc(projectId)}/media/${enc(mediaId)}`,
        ),

    getComments: (projectId: string, mediaId: string) =>
        rustFetch<InstagramCommentsResp>(
            `${BASE}/projects/${enc(projectId)}/media/${enc(mediaId)}/comments`,
        ),

    getStories: (projectId: string) =>
        rustFetch<InstagramStoriesResp>(`${BASE}/projects/${enc(projectId)}/stories`),

    discoverAccount: (projectId: string, username: string) =>
        rustFetch<InstagramDiscoverResp>(
            `${BASE}/projects/${enc(projectId)}/discover/${enc(username)}`,
        ),

    createImagePost: (projectId: string, body: CreateInstagramImagePostBody) =>
        rustFetch<InstagramImagePostResp>(`${BASE}/projects/${enc(projectId)}/media`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    searchHashtagId: (projectId: string, hashtag: string) =>
        rustFetch<InstagramHashtagIdResp>(
            `${BASE}/projects/${enc(projectId)}/hashtag-search?q=${enc(hashtag)}`,
        ),

    getHashtagRecentMedia: (projectId: string, hashtagId: string) =>
        rustFetch<InstagramMediaListResp>(
            `${BASE}/projects/${enc(projectId)}/hashtags/${enc(hashtagId)}/recent-media`,
        ),
};

export type WachatInstagramApi = typeof wachatInstagramApi;
