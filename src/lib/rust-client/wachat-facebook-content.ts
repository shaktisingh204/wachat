/**
 * Client for the Facebook page **Posts & Content** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/content` by the
 * `wachat-facebook-content` crate. Each method is a one-line wrapper
 * around {@link rustFetch} so the namespace surface stays close to the
 * legacy `facebook.actions.ts` server actions.
 *
 *   GET    /projects/{id}/posts                           → getFacebookPosts
 *   POST   /projects/{id}/posts                           → createPost
 *   POST   /projects/{id}/posts/bulk                      → bulkCreatePosts
 *   PATCH  /projects/{id}/posts/{postId}                  → updatePost
 *   DELETE /projects/{id}/posts/{postId}                  → deletePost
 *   POST   /projects/{id}/posts/{postId}/publish          → publishScheduledPost
 *   GET    /projects/{id}/posts/{postId}/insights         → getPostInsights
 *   GET    /projects/{id}/posts/{postId}/crosspost-eligible → getEligibleCrosspostPages
 *   POST   /projects/{id}/posts/{postId}/crosspost        → crosspostVideo
 *   GET    /projects/{id}/scheduled-posts                 → getScheduledPosts
 *   GET    /projects/{id}/published-posts                 → getPublishedPosts
 *   GET    /projects/{id}/visitor-posts                   → getVisitorPosts
 *   GET    /projects/{id}/tagged-posts                    → getTaggedPosts
 *
 *   GET    /projects/{id}/photos                          → getPagePhotos
 *   GET    /projects/{id}/albums                          → getPageAlbums
 *   POST   /projects/{id}/albums                          → createPhotoAlbum
 *   GET    /projects/{id}/albums/{albumId}/photos         → getAlbumPhotos
 *   GET    /projects/{id}/photos/{photoId}                → getPhotoDetails
 *   GET    /projects/{id}/photos/{photoId}/insights       → getPhotoInsights
 *
 *   GET    /projects/{id}/videos                          → getPageVideos
 *   GET    /projects/{id}/videos/{videoId}                → getVideoDetails
 *   GET    /projects/{id}/videos/{videoId}/insights       → getVideoInsights
 *   POST   /projects/{id}/videos/{videoId}/thumbnail      → addVideoThumbnail
 *   GET    /projects/{id}/playlists                       → getVideoPlaylists
 *   GET    /projects/{id}/playlists/{playlistId}/videos   → getPlaylistVideos
 *
 *   GET    /projects/{id}/reels                           → getPageReels
 *   POST   /projects/{id}/reels                           → publishPageReel (start | finish)
 *   GET    /projects/{id}/stories                         → getPageStories
 *   POST   /projects/{id}/stories/photo                   → publishPhotoStory
 *   POST   /projects/{id}/stories/video                   → publishVideoStory
 *
 *   GET    /projects/{id}/ratings                         → getPageRatings
 *
 * **File uploads.** A few legacy server actions accepted multipart
 * file bytes (image post, video post, video thumbnail, photo story).
 * Multipart binary streaming **stays in TypeScript**: the shim uploads
 * the raw bytes to Meta first (`POST /me/photos`, `POST /{page}/videos`,
 * `rupload.facebook.com/...`), then calls the Rust endpoint with the
 * resulting `mediaId` or a public URL. The Rust endpoints accept either
 * `mediaUrl` or `mediaId` so callers can choose the cheaper path.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/content';

const enc = (s: string) => encodeURIComponent(s);

// ---------------------------------------------------------------------------
// Wire shapes (camelCase — every Rust handler uses serde camelCase)
// ---------------------------------------------------------------------------

export interface FacebookContentAck {
    success: boolean;
    error?: string;
}

export interface FacebookContentMessageResult {
    message?: string;
    error?: string;
}

export interface FacebookPostListResponse {
    posts: any[];
    totalCount: number;
}

export interface FacebookPublishedPostListResponse {
    posts: any[];
    paging?: any;
}

export interface FacebookDataListResponse {
    data: any[];
}

export interface FacebookCrosspostPagesResponse {
    pages: any[];
}

export interface FacebookCreateAlbumResult {
    albumId?: string;
    error?: string;
}

export interface FacebookPublishReelResult {
    videoId?: string;
    message?: string;
    error?: string;
}

export interface FacebookBulkCreateResult {
    successCount: number;
    failCount: number;
    error?: string;
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

export interface CreateFacebookPostBody {
    /** `text` | `image` | `video` | `carousel`. */
    postType: 'text' | 'image' | 'video' | 'carousel';
    message?: string;
    /** Public URL — alternative to `mediaId`. */
    mediaUrl?: string;
    /** For carousel posts */
    mediaUrls?: string[];
    /** Pre-uploaded Meta media id — alternative to `mediaUrl`. */
    mediaId?: string;
    /** Comma-separated user-tag ids. */
    tags?: string;
    /** Unix seconds. The shim is responsible for the >= now+10min check. */
    scheduledPublishTime?: number;
}

export interface BulkFacebookPostInput {
    message: string;
    imageUrl?: string;
    /** ISO-8601 string. */
    scheduledTime?: string;
}

export interface BulkCreateFacebookPostsBody {
    posts: BulkFacebookPostInput[];
}

export interface UpdateFacebookPostBody {
    message: string;
}

export interface CrosspostFacebookVideoBody {
    targetPageIds: string[];
}

export interface CreateFacebookAlbumBody {
    name: string;
    description?: string;
}

export interface AddFacebookThumbnailBody {
    /** Public URL — alternative to `thumbnailId`. */
    sourceUrl?: string;
    /** Pre-uploaded Meta thumbnail id. */
    thumbnailId?: string;
}

export interface PublishFacebookReelBody {
    /** `start` to allocate a videoId, `finish` to publish. */
    phase?: 'start' | 'finish';
    /** Required when `phase === 'finish'`. */
    videoId?: string;
    description?: string;
}

export interface PublishFacebookPhotoStoryBody {
    photoUrl: string;
}

export interface PublishFacebookVideoStoryBody {
    videoUrl: string;
}

export interface PublishedPostsQuery {
    limit?: number;
    after?: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

const project = (projectId: string) => `${BASE}/projects/${enc(projectId)}`;

export const wachatFacebookContentApi = {
    // ---- Posts (feed) ------------------------------------------------------
    getFacebookPosts: (projectId: string) =>
        rustFetch<FacebookPostListResponse>(`${project(projectId)}/posts`),

    createPost: (projectId: string, body: CreateFacebookPostBody) =>
        rustFetch<FacebookContentMessageResult>(`${project(projectId)}/posts`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    bulkCreatePosts: (projectId: string, body: BulkCreateFacebookPostsBody) =>
        rustFetch<FacebookBulkCreateResult>(`${project(projectId)}/posts/bulk`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    updatePost: (projectId: string, postId: string, body: UpdateFacebookPostBody) =>
        rustFetch<FacebookContentAck>(
            `${project(projectId)}/posts/${enc(postId)}`,
            { method: 'PATCH', body: JSON.stringify(body) },
        ),

    deletePost: (projectId: string, postId: string) =>
        rustFetch<FacebookContentAck>(
            `${project(projectId)}/posts/${enc(postId)}`,
            { method: 'DELETE' },
        ),

    publishScheduledPost: (projectId: string, postId: string) =>
        rustFetch<FacebookContentAck>(
            `${project(projectId)}/posts/${enc(postId)}/publish`,
            { method: 'POST' },
        ),

    getPostInsights: (projectId: string, postId: string) =>
        rustFetch<FacebookDataListResponse>(
            `${project(projectId)}/posts/${enc(postId)}/insights`,
        ),

    getEligibleCrosspostPages: (projectId: string, postId: string) =>
        rustFetch<FacebookCrosspostPagesResponse>(
            `${project(projectId)}/posts/${enc(postId)}/crosspost-eligible`,
        ),

    crosspostVideo: (
        projectId: string,
        postId: string,
        body: CrosspostFacebookVideoBody,
    ) =>
        rustFetch<FacebookContentAck>(
            `${project(projectId)}/posts/${enc(postId)}/crosspost`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    getScheduledPosts: (projectId: string) =>
        rustFetch<FacebookDataListResponse>(`${project(projectId)}/scheduled-posts`),

    getPublishedPosts: (projectId: string, query: PublishedPostsQuery = {}) => {
        const qs = new URLSearchParams();
        if (query.limit !== undefined) qs.set('limit', String(query.limit));
        if (query.after) qs.set('after', query.after);
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        return rustFetch<FacebookPublishedPostListResponse>(
            `${project(projectId)}/published-posts${suffix}`,
        );
    },

    getVisitorPosts: (projectId: string) =>
        rustFetch<FacebookDataListResponse>(`${project(projectId)}/visitor-posts`),

    getTaggedPosts: (projectId: string) =>
        rustFetch<FacebookDataListResponse>(`${project(projectId)}/tagged-posts`),

    // ---- Photos & albums --------------------------------------------------
    getPagePhotos: (projectId: string) =>
        rustFetch<FacebookDataListResponse>(`${project(projectId)}/photos`),

    getPageAlbums: (projectId: string) =>
        rustFetch<FacebookDataListResponse>(`${project(projectId)}/albums`),

    createPhotoAlbum: (projectId: string, body: CreateFacebookAlbumBody) =>
        rustFetch<FacebookCreateAlbumResult>(`${project(projectId)}/albums`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    getAlbumPhotos: (projectId: string, albumId: string) =>
        rustFetch<FacebookDataListResponse>(
            `${project(projectId)}/albums/${enc(albumId)}/photos`,
        ),

    getPhotoDetails: (projectId: string, photoId: string) =>
        rustFetch<any>(`${project(projectId)}/photos/${enc(photoId)}`),

    getPhotoInsights: (projectId: string, photoId: string) =>
        rustFetch<FacebookDataListResponse>(
            `${project(projectId)}/photos/${enc(photoId)}/insights`,
        ),

    // ---- Videos & playlists ------------------------------------------------
    getPageVideos: (projectId: string) =>
        rustFetch<FacebookDataListResponse>(`${project(projectId)}/videos`),

    getVideoDetails: (projectId: string, videoId: string) =>
        rustFetch<any>(`${project(projectId)}/videos/${enc(videoId)}`),

    getVideoInsights: (projectId: string, videoId: string) =>
        rustFetch<FacebookDataListResponse>(
            `${project(projectId)}/videos/${enc(videoId)}/insights`,
        ),

    addVideoThumbnail: (
        projectId: string,
        videoId: string,
        body: AddFacebookThumbnailBody,
    ) =>
        rustFetch<FacebookContentAck>(
            `${project(projectId)}/videos/${enc(videoId)}/thumbnail`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    getVideoPlaylists: (projectId: string) =>
        rustFetch<FacebookDataListResponse>(`${project(projectId)}/playlists`),

    getPlaylistVideos: (projectId: string, playlistId: string) =>
        rustFetch<FacebookDataListResponse>(
            `${project(projectId)}/playlists/${enc(playlistId)}/videos`,
        ),

    // ---- Reels & stories ---------------------------------------------------
    getPageReels: (projectId: string) =>
        rustFetch<FacebookDataListResponse>(`${project(projectId)}/reels`),

    publishPageReel: (projectId: string, body: PublishFacebookReelBody) =>
        rustFetch<FacebookPublishReelResult>(`${project(projectId)}/reels`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    getPageStories: (projectId: string) =>
        rustFetch<FacebookDataListResponse>(`${project(projectId)}/stories`),

    publishPhotoStory: (projectId: string, body: PublishFacebookPhotoStoryBody) =>
        rustFetch<FacebookContentAck>(`${project(projectId)}/stories/photo`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    publishVideoStory: (projectId: string, body: PublishFacebookVideoStoryBody) =>
        rustFetch<FacebookContentAck>(`${project(projectId)}/stories/video`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // ---- Ratings -----------------------------------------------------------
    getPageRatings: (projectId: string) =>
        rustFetch<FacebookDataListResponse>(`${project(projectId)}/ratings`),
};

export type WachatFacebookContentApi = typeof wachatFacebookContentApi;
