/**
 * Client for the Wachat **interactive-builder** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/interactive-builder` by the
 * `wachat-interactive-builder` crate — saved interactive-message templates for
 * the `/wachat/templates/interactive-message-builder` page:
 *
 *   GET    /templates       — listTemplates   (?projectId=)
 *   POST   /templates       — saveTemplate
 *   DELETE /templates/{id}  — deleteTemplate
 *
 * Pure CRUD over `wa_interactive_templates`, scoped to the authenticated
 * user + the `projectId` passed in.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/interactive-builder';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * A saved interactive-message template document, cleaned by Rust's
 * `document_to_clean_json` (so `_id` is a plain hex string, dates are ISO).
 *
 * `payload` is the free-form `InteractiveMessageState` the builder page holds
 * (`{ msgType, body, buttons, sections, flowId, flowCta, flowToken,
 * carouselCards }`), persisted verbatim — typed as `unknown` here because the
 * crate stores it without a schema; callers narrow it client-side.
 */
export interface InteractiveTemplateRecord {
    /** Mongo `_id` as a plain hex string. */
    _id: string;
    userId: string;
    projectId: string;
    /** Human label, e.g. "Support Menu". */
    name: string;
    /** Free-form interactive-message state persisted verbatim. */
    payload: unknown;
    /** ISO-8601 timestamps from `document_to_clean_json`. */
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Body for `POST /v1/wachat/interactive-builder/templates`.
 *
 * `payload` is the free-form interactive-message state; it is stored verbatim
 * as JSON by the crate.
 */
export interface SaveInteractiveTemplateBody {
    /** Project the template is scoped to. */
    projectId: string;
    /** Human label for the saved template. */
    name: string;
    /** The interactive-message state to persist (free-form JSON). */
    payload: unknown;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/** Result of `GET /v1/wachat/interactive-builder/templates?projectId=`. */
export interface ListInteractiveTemplatesResponse {
    templates: InteractiveTemplateRecord[];
}

/** `{ success: true }` envelope returned by DELETE. */
export interface InteractiveBuilderSuccessResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatInteractiveBuilderApi = {
    /** List the caller's saved interactive templates for a project. */
    listTemplates: (projectId: string) =>
        rustFetch<ListInteractiveTemplatesResponse>(
            `${BASE}/templates?projectId=${encodeURIComponent(projectId)}`,
        ),

    /** Save a new named interactive-message layout; returns the cleaned doc. */
    saveTemplate: (body: SaveInteractiveTemplateBody) =>
        rustFetch<InteractiveTemplateRecord>(`${BASE}/templates`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** Delete a saved template the caller owns. */
    deleteTemplate: (id: string) =>
        rustFetch<InteractiveBuilderSuccessResponse>(
            `${BASE}/templates/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};

export type WachatInteractiveBuilderApi = typeof wachatInteractiveBuilderApi;
