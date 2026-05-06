/**
 * Client for the Facebook Comments router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/comments` by the
 * `wachat-facebook-comments` crate. Each method is a thin wrapper around
 * {@link rustFetch} and returns the same `{ success?, error?, … }` shape
 * the legacy TS server actions returned, so the calling page/component
 * code does not need to change beyond the import.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/comments';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface AckResult {
    success?: boolean;
    error?: string;
}

export interface PostCommentBody {
    projectId: string;
    message: string;
}

export interface LikeObjectBody {
    projectId: string;
}

export interface PrivateReplyBody {
    projectId: string;
    message: string;
}

export interface PostCommentsResp {
    comments?: any[];
    error?: string;
}

export interface CommentRepliesResp {
    replies?: any[];
    error?: string;
}

export interface ReactionsResp {
    reactions?: any;
    error?: string;
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const wachatFacebookCommentsApi = {
    /** `POST /{objectId}` — handlePostComment */
    handlePostComment: (objectId: string, body: PostCommentBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(objectId)}`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `DELETE /{commentId}?projectId=…` — handleDeleteComment */
    handleDeleteComment: (commentId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(commentId)}?projectId=${encodeURIComponent(projectId)}`,
            { method: 'DELETE' },
        ),

    /** `POST /{objectId}/likes` — handleLikeObject */
    handleLikeObject: (objectId: string, body: LikeObjectBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(objectId)}/likes`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `GET /post/{postId}?projectId=…` — getPostComments */
    getPostComments: (postId: string, projectId: string) =>
        rustFetch<PostCommentsResp>(
            `${BASE}/post/${encodeURIComponent(postId)}?projectId=${encodeURIComponent(projectId)}`,
        ),

    /** `GET /{commentId}/replies?projectId=…` — getCommentReplies */
    getCommentReplies: (commentId: string, projectId: string) =>
        rustFetch<CommentRepliesResp>(
            `${BASE}/${encodeURIComponent(commentId)}/replies?projectId=${encodeURIComponent(projectId)}`,
        ),

    /** `GET /{objectId}/reactions?projectId=…` — getObjectReactions */
    getObjectReactions: (objectId: string, projectId: string) =>
        rustFetch<ReactionsResp>(
            `${BASE}/${encodeURIComponent(objectId)}/reactions?projectId=${encodeURIComponent(projectId)}`,
        ),

    /** `POST /{commentId}/private-replies` — sendPrivateReply */
    sendPrivateReply: (commentId: string, body: PrivateReplyBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(commentId)}/private-replies`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
};

export type WachatFacebookCommentsApi = typeof wachatFacebookCommentsApi;
