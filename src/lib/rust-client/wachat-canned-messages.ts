/**
 * Client for the Wachat **canned-messages** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/canned-messages` by the
 * `wachat-canned-messages` crate (backs the `/wachat/settings/canned` page):
 *
 *   GET    /{id}              → listMessages   (id = projectId; favourites first, then name)
 *   POST   /{id}              → createMessage  (id = projectId)
 *   DELETE /{id}              → deleteMessage  (id = messageId)
 *   PUT    /{id}/{messageId}  → updateMessage  (id = projectId)
 *   GET    /{id}/settings     → getSettings    (id = projectId)
 *   PUT    /{id}/settings     → updateSettings (id = projectId; upsert)
 *
 * Routing quirk: Axum 0.8 forbids two single-segment routes whose param names
 * differ, so the crate shares one `{id}` segment across GET/POST (projectId)
 * and DELETE (messageId). The literal `/settings` suffix wins over the generic
 * `/{messageId}` two-segment route. Callers MUST pass the right id per verb.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/canned-messages';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/** Accepted canned-message types (`VALID_TYPES` in the Rust handler). */
export type CannedMessageType = 'text' | 'image' | 'video' | 'audio' | 'document';

/**
 * Stored `content` block on a canned-message document. Text messages carry
 * `text`; media messages carry `mediaUrl` plus optional `caption` / `fileName`.
 */
export interface CannedMessageContent {
    text?: string;
    mediaUrl?: string;
    caption?: string;
    fileName?: string;
}

/**
 * A canned-message document as returned by the Rust crate
 * (`document_to_clean_json` — `_id` and `projectId` are stringified, dates are
 * ISO strings). `userId` is omitted here because the page never reads it.
 */
export interface CannedMessageDoc {
    _id: string;
    projectId: string;
    name: string;
    type: CannedMessageType;
    content: CannedMessageContent;
    isFavourite: boolean;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Body for `POST /{projectId}` (create) and `PUT /{projectId}/{messageId}`
 * (update). Mirrors `CannedMessageBody`: the crate accepts the flattened
 * top-level media fields (used here) or a nested `content` object.
 */
export interface SaveCannedMessageBody {
    /** Unique label identifying this snippet (e.g. "Welcome Message"). */
    name: string;
    /** Message type: `text` | `image` | `video` | `audio` | `document`. */
    type: CannedMessageType;
    /** Text body (text messages). */
    text?: string;
    /** Media URL (media messages). */
    mediaUrl?: string;
    /** Optional caption for media messages. */
    caption?: string;
    /** Optional file name for `document` messages. */
    fileName?: string;
    /** Pins this message to the top of the list when `true`. */
    isFavourite?: boolean;
}

/** Body for `PUT /{projectId}/settings` (mirrors `CannedSettingsBody`). */
export interface SaveCannedSettingsBody {
    /** Share canned messages with the account's other sub-projects. */
    syncAcrossProjects: boolean;
    /** Keyboard shortcut that opens the canned-messages menu (e.g. "Cmd + /"). */
    keyboardTrigger?: string | null;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/** Result of `GET /{projectId}` (mirrors `ListMessagesResponse`). */
export interface ListCannedMessagesResponse {
    messages: CannedMessageDoc[];
}

/** Result of `GET /{projectId}/settings` (mirrors `CannedSettingsResponse`). */
export interface CannedSettingsResponse {
    syncAcrossProjects: boolean;
    keyboardTrigger: string;
}

/** `{ success: true }` envelope returned by update / delete / settings writes. */
export interface CannedSuccessResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatCannedMessagesApi = {
    /** `GET /{projectId}` — list a project's canned messages (favourites first). */
    list: (projectId: string) =>
        rustFetch<ListCannedMessagesResponse>(
            `${BASE}/${encodeURIComponent(projectId)}`,
        ),

    /** `POST /{projectId}` — create a canned message; returns the new doc. */
    create: (projectId: string, body: SaveCannedMessageBody) =>
        rustFetch<CannedMessageDoc>(
            `${BASE}/${encodeURIComponent(projectId)}`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    /** `PUT /{projectId}/{messageId}` — update an existing canned message. */
    update: (projectId: string, messageId: string, body: SaveCannedMessageBody) =>
        rustFetch<CannedSuccessResponse>(
            `${BASE}/${encodeURIComponent(projectId)}/${encodeURIComponent(messageId)}`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            },
        ),

    /** `DELETE /{messageId}` — delete a canned message (id is the messageId). */
    remove: (messageId: string) =>
        rustFetch<CannedSuccessResponse>(
            `${BASE}/${encodeURIComponent(messageId)}`,
            { method: 'DELETE' },
        ),

    /** `GET /{projectId}/settings` — read this tenant/project's canned settings. */
    getSettings: (projectId: string) =>
        rustFetch<CannedSettingsResponse>(
            `${BASE}/${encodeURIComponent(projectId)}/settings`,
        ),

    /** `PUT /{projectId}/settings` — upsert canned-message settings. */
    updateSettings: (projectId: string, body: SaveCannedSettingsBody) =>
        rustFetch<CannedSuccessResponse>(
            `${BASE}/${encodeURIComponent(projectId)}/settings`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            },
        ),
};

export type WachatCannedMessagesApi = typeof wachatCannedMessagesApi;
