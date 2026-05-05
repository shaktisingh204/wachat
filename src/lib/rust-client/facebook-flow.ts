/**
 * Client for the Facebook Messenger flow-builder router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/flow` by the
 * `facebook-flow` crate. Each method is a thin wrapper around
 * {@link rustFetch}.
 *
 *   GET    /projects/:projectId/flows         → listFlows (summaries)
 *   POST   /projects/:projectId/flows         → saveFlow  (upsert)
 *   GET    /:flowId                           → getFlow
 *   DELETE /:flowId                           → deleteFlow
 *
 * Auth is project-scoped server-side; an invalid project id or non-owner
 * returns the same shape that the legacy TS server actions did so callers
 * don't have to special-case 4xx vs envelope errors.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/flow';

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

export interface FacebookFlowNodeWire {
    id: string;
    type: string;
    data: any;
    position: { x: number; y: number };
}

export interface FacebookFlowEdgeWire {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
}

/** Summary record returned by `GET /projects/:projectId/flows`. */
export interface FacebookFlowSummary {
    _id: string;
    name: string;
    triggerKeywords: string[];
    updatedAt: string;
}

/** Full record returned by `GET /:flowId`. */
export interface FacebookFlowRecord {
    _id: string;
    name: string;
    projectId: string;
    nodes: FacebookFlowNodeWire[];
    edges: FacebookFlowEdgeWire[];
    triggerKeywords: string[];
    createdAt?: string;
    updatedAt: string;
}

/** Upsert body — when `flowId` is omitted, creates a new row. */
export interface SaveFacebookFlowBody {
    flowId?: string;
    name: string;
    nodes: FacebookFlowNodeWire[];
    edges: FacebookFlowEdgeWire[];
    triggerKeywords: string[];
}

/** Result envelope for `POST /projects/:projectId/flows`. */
export interface SaveFacebookFlowResult {
    message?: string;
    error?: string;
    flowId?: string;
}

/** Result envelope for `DELETE /:flowId`. */
export interface FacebookFlowAck {
    message?: string;
    error?: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const facebookFlowApi = {
    listFlows: (projectId: string) =>
        rustFetch<FacebookFlowSummary[]>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/flows`,
        ),

    saveFlow: (projectId: string, body: SaveFacebookFlowBody) =>
        rustFetch<SaveFacebookFlowResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/flows`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    getFlow: (flowId: string) =>
        rustFetch<FacebookFlowRecord | null>(
            `${BASE}/${encodeURIComponent(flowId)}`,
        ),

    deleteFlow: (flowId: string) =>
        rustFetch<FacebookFlowAck>(
            `${BASE}/${encodeURIComponent(flowId)}`,
            { method: 'DELETE' },
        ),
};

export type FacebookFlowApi = typeof facebookFlowApi;
