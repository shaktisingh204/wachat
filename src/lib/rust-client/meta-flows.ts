/**
 * Client for the Meta Flows router on the Rust BFF.
 *
 * Mirrors the routes registered by the `meta-flows` crate under
 * `/v1/meta/flows`. Each method is a thin wrapper around {@link rustFetch}.
 *
 *   GET    /projects/:projectId/flows                              → listFlows
 *   POST   /projects/:projectId/flows                              → createFlow
 *   POST   /projects/:projectId/sync                               → syncFlows
 *   GET    /:flowId                                                → getFlow
 *   POST   /:flowId/draft                                          → saveDraft
 *   POST   /:flowId/metadata                                       → updateMetadata
 *   POST   /:flowId/publish                                        → publish
 *   POST   /:flowId/deprecate                                      → deprecate
 *   POST   /:flowId/preview                                        → preview
 *   DELETE /:flowId?metaId=...                                     → deleteFlow
 *
 * Per-flow operations resolve the owning project from the stored flow
 * row server-side (mirrors the TS `loadOwnedFlow` helper) so the wire
 * shape doesn't have to thread `projectId` through every call.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/meta/flows';

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

export interface MetaFlowValidationError {
    error: string;
    error_type?: string;
    message: string;
    line_start?: number;
    line_end?: number;
    column_start?: number;
    column_end?: number;
    pointers?: string[];
}

/**
 * Browser-facing flow record. Mirrors `WithId<MetaFlow>` from
 * `src/lib/definitions.ts` — `_id` and `projectId` are hex strings,
 * dates are ISO-8601 strings.
 */
export interface MetaFlowRecord {
    _id: string;
    name: string;
    projectId: string;
    metaId: string;
    status: string;
    json_version?: string;
    categories: string[];
    flow_data: any;
    endpoint_uri?: string;
    validation_errors?: MetaFlowValidationError[];
    health_status?: any;
    preview?: { preview_url: string; expires_at: string } | null;
    application_id?: string;
    lastPublishedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ActionEnvelope {
    success: boolean;
    message?: string;
    error?: string;
    validation_errors?: MetaFlowValidationError[];
}

export type CreateFlowResult = ActionEnvelope & {
    flowId?: string;
    metaId?: string;
};

export type PreviewResult = ActionEnvelope & {
    preview_url?: string;
    expires_at?: string;
};

export type SyncResult = ActionEnvelope & {
    count?: number;
};

// ---------------------------------------------------------------------------
// Request bodies — mirror the DTOs in `crates/meta-flows/src/dto.rs`.
// ---------------------------------------------------------------------------

export interface CreateFlowBody {
    name: string;
    categories: string[];
    flow_data?: any;
    endpoint_uri?: string;
    clone_flow_id?: string;
}

export interface SaveDraftBody {
    flow_data: any;
}

/**
 * `endpoint_uri: null` clears the value on Meta and locally; `undefined`
 * leaves it untouched. The Rust DTO models this with `Option<Option<...>>`.
 */
export interface UpdateMetadataBody {
    name?: string;
    categories?: string[];
    endpoint_uri?: string | null;
    application_id?: string;
}

export interface PreviewBody {
    invalidate?: boolean;
    flow_token?: string;
    flow_action?: 'navigate' | 'data_exchange';
    flow_action_payload?: Record<string, any>;
    phone_number?: string;
    interactive?: boolean;
}

// ---------------------------------------------------------------------------
// Query helper
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, v);
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const metaFlowsApi = {
    listFlows: (projectId: string) =>
        rustFetch<MetaFlowRecord[]>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/flows`,
        ),

    createFlow: (projectId: string, body: CreateFlowBody) =>
        rustFetch<CreateFlowResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/flows`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    syncFlows: (projectId: string) =>
        rustFetch<SyncResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/sync`,
            { method: 'POST' },
        ),

    getFlow: (flowId: string) =>
        rustFetch<MetaFlowRecord | null>(
            `${BASE}/${encodeURIComponent(flowId)}`,
        ),

    saveDraft: (flowId: string, body: SaveDraftBody) =>
        rustFetch<ActionEnvelope>(
            `${BASE}/${encodeURIComponent(flowId)}/draft`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    updateMetadata: (flowId: string, body: UpdateMetadataBody) =>
        rustFetch<ActionEnvelope>(
            `${BASE}/${encodeURIComponent(flowId)}/metadata`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    publish: (flowId: string) =>
        rustFetch<ActionEnvelope>(
            `${BASE}/${encodeURIComponent(flowId)}/publish`,
            { method: 'POST' },
        ),

    deprecate: (flowId: string) =>
        rustFetch<ActionEnvelope>(
            `${BASE}/${encodeURIComponent(flowId)}/deprecate`,
            { method: 'POST' },
        ),

    deleteFlow: (flowId: string, metaId?: string) =>
        rustFetch<ActionEnvelope>(
            `${BASE}/${encodeURIComponent(flowId)}${qs({ metaId })}`,
            { method: 'DELETE' },
        ),

    preview: (flowId: string, body: PreviewBody) =>
        rustFetch<PreviewResult>(
            `${BASE}/${encodeURIComponent(flowId)}/preview`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
};

export type MetaFlowsApi = typeof metaFlowsApi;
