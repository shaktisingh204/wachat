/**
 * Client for the Wachat **Facebook automation** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/automation` by the
 * `wachat-facebook-automation` crate. Each method is a thin shim around
 * {@link rustFetch} so the namespace surface stays close to the OpenAPI
 * operation IDs — when codegen replaces this file the call sites won't
 * change.
 *
 *   POST   /projects/{projectId}/automation                  → updateAutomationSettings
 *   POST   /projects/{projectId}/randomizer/settings         → saveRandomizerSettings
 *   GET    /projects/{projectId}/randomizer/posts            → getRandomizerPosts
 *   POST   /projects/{projectId}/randomizer/posts            → addRandomizerPost
 *   DELETE /projects/{projectId}/randomizer/posts/{postId}   → deleteRandomizerPost
 *   GET    /projects/{projectId}/broadcasts                  → getFacebookBroadcasts
 *   POST   /projects/{projectId}/broadcasts                  → sendFacebookBroadcast
 *   GET    /projects/{projectId}/live-streams                → getScheduledLiveStreams
 *   POST   /projects/{projectId}/live-streams (multipart)    → scheduleLiveStream
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/automation';

function enc(s: string): string {
    return encodeURIComponent(s);
}

// ---------------------------------------------------------------------------
// Wire shapes (mirror the Rust DTOs — camelCase on the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/** `{ success, error? }` envelope used by the form-action handlers. */
export interface OkResult {
    success: boolean;
    error?: string;
}

/** `{ message?, error? }` envelope used by broadcast / live-stream send. */
export interface MessageResult {
    message?: string;
    error?: string;
}

/** Body for `POST /projects/{projectId}/automation`. */
export interface UpdateAutomationSettingsBody {
    /** `"comment"` or `"welcome"`. */
    automationType: 'comment' | 'welcome';
    enabled?: boolean;
    // -- comment auto-reply --
    replyMode?: 'static' | 'ai';
    staticReplyText?: string;
    aiReplyPrompt?: string;
    moderationEnabled?: boolean;
    moderationPrompt?: string;
    // -- welcome message --
    message?: string;
    quickReplies?: unknown;
}

export interface SaveRandomizerSettingsBody {
    enabled: boolean;
    frequencyHours: number;
    blackoutStart?: string;
    blackoutEnd?: string;
}

/** Body for `POST /projects/{projectId}/randomizer/posts`. */
export interface AddRandomizerPostBody {
    message: string;
    imageUrl?: string;
}

export interface RandomizerPostsResponse {
    posts: any[];
}

/** Body for `POST /projects/{projectId}/broadcasts`. */
export interface SendBroadcastBody {
    message: string;
}

export interface FacebookBroadcastsResponse {
    broadcasts: any[];
}

export interface LiveStreamsResponse {
    streams: any[];
}

/**
 * Fields for `POST /projects/{projectId}/live-streams`. The endpoint is
 * multipart/form-data because the video is uploaded inline — same
 * contract the legacy `handleScheduleLiveStream` server action used.
 */
export interface ScheduleLiveStreamFields {
    title: string;
    description?: string;
    /** `YYYY-MM-DD`. */
    scheduledDate: string;
    /** `HH:MM[:SS]` (UTC). */
    scheduledTime: string;
    /** Browser `File` carrying the video. */
    videoFile: File | Blob;
    /** Optional override for `videoFile.name` if `videoFile` is a `Blob`. */
    videoFileName?: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatFacebookAutomationApi = {
    // ---- automation settings -----------------------------------------------
    updateAutomationSettings: (projectId: string, body: UpdateAutomationSettingsBody) =>
        rustFetch<OkResult>(`${BASE}/projects/${enc(projectId)}/automation`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // ---- post randomizer ---------------------------------------------------
    saveRandomizerSettings: (projectId: string, body: SaveRandomizerSettingsBody) =>
        rustFetch<OkResult>(
            `${BASE}/projects/${enc(projectId)}/randomizer/settings`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    getRandomizerPosts: (projectId: string) =>
        rustFetch<RandomizerPostsResponse>(
            `${BASE}/projects/${enc(projectId)}/randomizer/posts`,
        ),

    addRandomizerPost: (projectId: string, body: AddRandomizerPostBody) =>
        rustFetch<OkResult>(
            `${BASE}/projects/${enc(projectId)}/randomizer/posts`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    deleteRandomizerPost: (projectId: string, postId: string) =>
        rustFetch<OkResult>(
            `${BASE}/projects/${enc(projectId)}/randomizer/posts/${enc(postId)}`,
            { method: 'DELETE' },
        ),

    // ---- broadcasts --------------------------------------------------------
    getFacebookBroadcasts: (projectId: string) =>
        rustFetch<FacebookBroadcastsResponse>(
            `${BASE}/projects/${enc(projectId)}/broadcasts`,
        ),

    sendFacebookBroadcast: (projectId: string, body: SendBroadcastBody) =>
        rustFetch<MessageResult>(
            `${BASE}/projects/${enc(projectId)}/broadcasts`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    // ---- live streams ------------------------------------------------------
    getScheduledLiveStreams: (projectId: string) =>
        rustFetch<LiveStreamsResponse>(
            `${BASE}/projects/${enc(projectId)}/live-streams`,
        ),

    /**
     * Multipart upload — accepts the video file inline. The shared
     * fetcher passes `body` through to `fetch`, so we hand it a
     * `FormData` and let it stream straight to the Rust router.
     *
     * NOTE: the fetcher does set `Content-Type: application/json` by
     * default. Pass `headers: undefined` so it doesn't override the
     * boundary header `fetch` sets automatically for `FormData`.
     */
    scheduleLiveStream: (projectId: string, fields: ScheduleLiveStreamFields) => {
        const fd = new FormData();
        fd.append('title', fields.title);
        fd.append('description', fields.description ?? '');
        fd.append('scheduledDate', fields.scheduledDate);
        fd.append('scheduledTime', fields.scheduledTime);
        const file = fields.videoFile;
        const filename =
            fields.videoFileName ||
            (typeof (file as File).name === 'string' ? (file as File).name : 'upload.mp4');
        fd.append('videoFile', file, filename);
        return rustFetch<MessageResult>(
            `${BASE}/projects/${enc(projectId)}/live-streams`,
            {
                method: 'POST',
                body: fd,
            },
        );
    },
};

export type WachatFacebookAutomationApi = typeof wachatFacebookAutomationApi;
