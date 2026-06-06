/**
 * Client for the Wachat **post-generator** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/post-generator` by the
 * `wachat-post-generator` crate. The crate owns only the *persistence* +
 * *publish* halves of the `/wachat/post-generator` page — AI generation stays
 * in the Next streaming route (`/wachat/post-generator/api`) and is NOT
 * proxied here.
 *
 *   GET    /drafts?projectId=                 → listDrafts
 *   POST   /drafts                            → saveDraft
 *   DELETE /drafts/{id}                       → deleteDraft
 *   POST   /publish/facebook                  → publishFacebook (Meta Graph seam)
 *   POST   /publish/whatsapp-status           → publishWhatsappStatus
 *   GET    /publish-log?projectId=            → publishLog
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/post-generator';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * A saved post draft, as returned by `document_to_clean_json` on the Rust
 * side. `_id`/`projectId`/`userId` are hex strings; dates are RFC3339 strings.
 */
export interface PostDraft {
    _id: string;
    userId: string;
    projectId: string;
    /** Optional human label; `null` when the user saved without a title. */
    title: string | null;
    /** The post copy. */
    body: string;
    /** Intended destination — `"facebook"` | `"whatsapp-status"`. */
    channel: string;
    createdAt: string;
    updatedAt: string;
}

/** Body for `POST /drafts`. */
export interface SaveDraftBody {
    projectId: string;
    /** Optional human title/label for the draft. */
    title?: string;
    /** The post copy. Required, non-empty. */
    body: string;
    /** `"facebook"` | `"whatsapp-status"`. Defaults to `"facebook"` server-side. */
    channel?: string;
}

/** `GET /drafts` response. */
export interface ListDraftsResponse {
    drafts: PostDraft[];
}

/**
 * Body for `POST /publish/facebook` and `POST /publish/whatsapp-status`.
 *
 * Either reference a saved draft (`draftId`) or pass inline `text`. At least
 * one must resolve to a non-empty body.
 */
export interface PublishBody {
    projectId: string;
    /** Saved draft to publish (hex ObjectId). Optional if `text` is given. */
    draftId?: string;
    /** Inline post copy. Optional if `draftId` is given. */
    text?: string;
}

/** Result of a publish attempt (FB feed or WhatsApp-status intent). */
export interface PublishResponse {
    success: boolean;
    /** The publish_log row id (hex) recorded for this attempt. */
    logId: string;
    /** `"published"` | `"queued"` | `"failed"`. */
    status: string;
    /** Meta object id of the new post, when the Graph call succeeded. */
    postId?: string;
    /** Failure reason, when `status === "failed"`. */
    reason?: string;
}

/**
 * A publish-log entry, as returned by `document_to_clean_json`. `_id` and the
 * id fields are hex strings; `ts`/`createdAt` are RFC3339 strings.
 */
export interface PublishLogEntry {
    _id: string;
    userId: string;
    projectId: string;
    /** `"facebook"` | `"whatsapp-status"`. */
    channel: string;
    /** `"published"` | `"queued"` | `"failed"`. */
    status: string;
    /** Failure reason; `null` on success/queued. */
    reason: string | null;
    /** Meta object id of the published post; `null` when none. */
    postId: string | null;
    /** The post copy that was published. */
    text: string;
    ts: string;
    createdAt: string;
}

/** `GET /publish-log` response. */
export interface PublishLogResponse {
    entries: PublishLogEntry[];
}

/** Generic `{ success }` envelope (DELETE). */
export interface SuccessResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatPostGeneratorApi = {
    listDrafts: (projectId: string) =>
        rustFetch<ListDraftsResponse>(
            `${BASE}/drafts?projectId=${encodeURIComponent(projectId)}`,
        ),

    saveDraft: (body: SaveDraftBody) =>
        rustFetch<PostDraft>(`${BASE}/drafts`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteDraft: (draftId: string) =>
        rustFetch<SuccessResponse>(
            `${BASE}/drafts/${encodeURIComponent(draftId)}`,
            { method: 'DELETE' },
        ),

    publishFacebook: (body: PublishBody) =>
        rustFetch<PublishResponse>(`${BASE}/publish/facebook`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    publishWhatsappStatus: (body: PublishBody) =>
        rustFetch<PublishResponse>(`${BASE}/publish/whatsapp-status`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    publishLog: (projectId: string) =>
        rustFetch<PublishLogResponse>(
            `${BASE}/publish-log?projectId=${encodeURIComponent(projectId)}`,
        ),
};

export type WachatPostGeneratorApi = typeof wachatPostGeneratorApi;
