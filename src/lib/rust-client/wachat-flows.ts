/**
 * Client for the wachat trigger-based flow router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/flows` by the `wachat-flows`
 * crate. These are SabNode's wachat-specific trigger-keyword flows — NOT
 * Meta Flows (those live in `meta-flows.ts`).
 *
 *   GET    /v1/flows?projectId=…             listFlows (summaries)
 *   GET    /v1/flows/{id}                    getFlow (full)
 *   POST   /v1/flows                         saveFlow (upsert, cycle-checked)
 *   DELETE /v1/flows/{id}                    deleteFlow (+ contact cleanup)
 *   GET    /v1/flows/builder-data?projectId  builderData (list + initial)
 *
 * Auth is project-scoped server-side (owner-or-agent). Access denials
 * return the same shapes the legacy TS server actions did so callers don't
 * have to special-case 4xx vs envelope errors.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/flows';

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

export interface RustFlowNodeWire {
    id: string;
    type: string;
    data: any;
    position: { x: number; y: number };
}

export interface RustFlowEdgeWire {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

/** Summary returned by `GET /v1/flows`. Shape matches the TS Mongo
 *  projection `{ _id, name, triggerKeywords, updatedAt, status }`. */
export interface RustFlowSummary {
    _id: string;
    name: string;
    triggerKeywords?: string[];
    updatedAt: string;
    status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
}

/** Full flow record returned by `GET /v1/flows/:id`. Open-ended `nodes` /
 *  `edges` because the flow-builder evolves faster than this client. */
export interface RustFlowRecord {
    _id: string;
    name: string;
    projectId: string;
    nodes: RustFlowNodeWire[];
    edges: RustFlowEdgeWire[];
    triggerKeywords: string[];
    status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    createdAt?: string;
    updatedAt: string;
}

/** Upsert body — when `flowId` is absent, creates a new flow. */
export interface SaveWachatFlowBody {
    flowId?: string;
    projectId: string;
    name: string;
    nodes: RustFlowNodeWire[];
    edges: RustFlowEdgeWire[];
    triggerKeywords: string[];
    status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
}

/** Result envelope for `POST /v1/flows`. */
export interface SaveWachatFlowResult {
    message?: string;
    error?: string;
    flowId?: string;
}

/** Result envelope for `DELETE /v1/flows/:id`. */
export interface WachatFlowAck {
    message?: string;
    error?: string;
}

/** One-shot `getFlowBuilderPageData` envelope. */
export interface BuilderPageData {
    flows: RustFlowSummary[];
    initialFlow: RustFlowRecord | null;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatFlowsApi = {
    /**
     * `GET /v1/flows?projectId=…` — summary list. Returns `[]` if the
     * caller is not owner-or-agent of the project (matches legacy
     * `getFlowsForProject`).
     */
    listFlows: (projectId: string) => {
        const qs = new URLSearchParams({ projectId }).toString();
        return rustFetch<RustFlowSummary[]>(`${BASE}/?${qs}`);
    },

    /**
     * `GET /v1/flows/:id` — full flow. Returns `null` on invalid id /
     * missing / access denied (matches legacy `getFlowById`).
     */
    getFlow: (flowId: string) =>
        rustFetch<RustFlowRecord | null>(
            `${BASE}/${encodeURIComponent(flowId)}`,
        ),

    /**
     * `POST /v1/flows` — create new flow OR update existing (when body
     * includes `flowId`). The Rust handler runs cycle detection BEFORE
     * persisting; cycles return as `{ error: "Infinite loop detected…" }`.
     */
    saveFlow: (body: SaveWachatFlowBody) =>
        rustFetch<SaveWachatFlowResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /**
     * `DELETE /v1/flows/:id` — delete + unset `contacts.activeFlow` for
     * any contact mid-flow. Returns `{ error: "Access denied" }` to
     * non-members of the owning project (matches legacy `deleteFlow`).
     */
    deleteFlow: (flowId: string) =>
        rustFetch<WachatFlowAck>(
            `${BASE}/${encodeURIComponent(flowId)}`,
            { method: 'DELETE' },
        ),

    /**
     * `GET /v1/flows/builder-data?projectId=…` — list summaries plus the
     * full first flow in one round-trip (composition of
     * `getFlowBuilderPageData`).
     */
    builderData: (projectId: string) => {
        const qs = new URLSearchParams({ projectId }).toString();
        return rustFetch<BuilderPageData>(`${BASE}/builder-data?${qs}`);
    },
};

export type WachatFlowsApi = typeof wachatFlowsApi;
