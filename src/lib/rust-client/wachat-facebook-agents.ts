/**
 * Client for the **wachat-facebook-agents** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/agents` by the
 * `wachat-facebook-agents` crate (Agents / Knowledge / Moderation /
 * Audience slice of `src/app/actions/facebook.actions.ts`).
 *
 * **Multipart binary stays in TS.** `uploadKnowledgeDoc` callers in the
 * server action upload the file to blob storage first, then forward the
 * parsed text body (and an optional `blobUrl` reference) here.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/agents';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enc(s: string): string {
    return encodeURIComponent(s);
}

function get<T>(path: string): Promise<T> {
    return rustFetch<T>(`${BASE}${path}`);
}

function post<T>(path: string, body?: unknown): Promise<T> {
    return rustFetch<T>(`${BASE}${path}`, {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

function patch<T>(path: string, body?: unknown): Promise<T> {
    return rustFetch<T>(`${BASE}${path}`, {
        method: 'PATCH',
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

function put<T>(path: string, body?: unknown): Promise<T> {
    return rustFetch<T>(`${BASE}${path}`, {
        method: 'PUT',
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

function del<T>(path: string): Promise<T> {
    return rustFetch<T>(`${BASE}${path}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Generic envelopes
// ---------------------------------------------------------------------------

export interface OkEnvelope { success: boolean; }
export interface MessageEnvelope { message: string; }

// ---------------------------------------------------------------------------
// Request DTOs (forwarded verbatim to the Rust crate)
// ---------------------------------------------------------------------------

export interface CreateFacebookAgentBody {
    name: string;
    personality?: string;
    welcomeMessage?: string;
    fallbackMessage?: string;
    isActive?: boolean;
}

export interface UploadKnowledgeDocBody {
    title: string;
    /** Pre-extracted plain text. Multipart binary upload is the TS shim's job. */
    content: string;
    /** Optional doc-type tag (defaults to `"text"` in the crate). */
    docType?: string;
    /** Optional reference to the original blob — uploaded server-side first. */
    blobUrl?: string;
}

export interface SaveModerationRuleBody {
    /** Comma-separated keyword list — split + lower-cased on the server. */
    keywords: string;
    action: string;
    autoReplyText?: string;
    isActive?: boolean;
    /** When set + valid ObjectId, updates an existing rule in place. */
    ruleId?: string;
}

export interface CommentAutoReplyBody {
    enabled: boolean;
    replyMode: 'static' | 'ai';
    staticReplyText?: string;
    aiReplyPrompt?: string;
}

export interface SaveAudienceSegmentBody {
    name: string;
    description?: string;
    filterCity?: string;
    filterCountry?: string;
    /** `'all'` is treated as no-filter on the server side. */
    filterGender?: string;
    filterAgeMin?: number;
    filterAgeMax?: number;
}

// ---------------------------------------------------------------------------
// Public namespace, grouped by domain
// ---------------------------------------------------------------------------

export const wachatFacebookAgentsApi = {
    // ---- agents ------------------------------------------------------------
    getFacebookAgents: (projectId: string) =>
        get<{ agents: any[] }>(`/projects/${enc(projectId)}/agents`),
    createFacebookAgent: (projectId: string, body: CreateFacebookAgentBody) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/agents`, body),
    updateFacebookAgent: (agentId: string, updates: Record<string, any>) =>
        patch<OkEnvelope>(`/agents/${enc(agentId)}`, updates),
    deleteFacebookAgent: (agentId: string) =>
        del<OkEnvelope>(`/agents/${enc(agentId)}`),

    // ---- knowledge base ----------------------------------------------------
    getKnowledgeDocs: (projectId: string) =>
        get<{ docs: any[] }>(`/projects/${enc(projectId)}/knowledge-docs`),
    /**
     * Upload a knowledge doc. Multipart binary stays in TS — extract the
     * text + (optionally) upload the original to blob storage first, then
     * forward the parsed body here.
     */
    uploadKnowledgeDoc: (projectId: string, body: UploadKnowledgeDocBody) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/knowledge-docs`, body),
    deleteKnowledgeDoc: (docId: string) =>
        del<OkEnvelope>(`/knowledge-docs/${enc(docId)}`),

    // ---- moderation rules --------------------------------------------------
    getModerationRules: (projectId: string) =>
        get<{ rules: any[] }>(`/projects/${enc(projectId)}/moderation-rules`),
    saveModerationRule: (projectId: string, body: SaveModerationRuleBody) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/moderation-rules`, body),
    deleteModerationRule: (ruleId: string) =>
        del<OkEnvelope>(`/moderation-rules/${enc(ruleId)}`),

    // ---- comment auto-reply (lives on the project document) ---------------
    handleUpdateCommentAutoReply: (projectId: string, body: CommentAutoReplyBody) =>
        put<OkEnvelope>(`/projects/${enc(projectId)}/comment-auto-reply`, body),

    // ---- audience segments -------------------------------------------------
    getAudienceSegments: (projectId: string) =>
        get<{ segments: any[] }>(`/projects/${enc(projectId)}/audience-segments`),
    saveAudienceSegment: (projectId: string, body: SaveAudienceSegmentBody) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/audience-segments`, body),
    deleteAudienceSegment: (segmentId: string) =>
        del<OkEnvelope>(`/audience-segments/${enc(segmentId)}`),
};
