/**
 * Client for the Wachat **project-attributes** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/project-attributes` by the
 * `wachat-project-attributes` crate (port of the `userAttributes[]` read leg
 * of `getProjectById()` + `handleSaveUserAttributes` from
 * `src/app/actions/project.actions.ts`):
 *
 *   GET   /projects/{id}/attributes   → list project user attributes
 *   PATCH /projects/{id}/attributes   → replace the whole array
 *
 * A user attribute is an embedded record on the `projects` document
 * (`projects.userAttributes[]`) — there is no separate collection. `PATCH`
 * replaces the whole array wholesale. Both legs are owner-or-agent scoped to
 * the authenticated caller.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/project-attributes';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * A single custom user attribute as stored in `projects.userAttributes[]`.
 *
 * Mirrors the Rust `UserAttribute` DTO. `id` is a client-minted stable key
 * (uuid in the legacy UI); it is optional on the wire — the handler
 * back-fills a fresh value when omitted (e.g. a freshly added row).
 */
export interface WachatUserAttribute {
    /** Stable client key for this attribute row. Optional on write. */
    id?: string;
    /** Human label, e.g. "Membership Level". Required, non-empty. */
    name: string;
    /** One of `TEXT` | `NUMBER` | `BOOLEAN` | `DATE`. Required. */
    dataType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | string;
    /** Optional inbound webhook mapping key (e.g. `custom_field_1`). */
    webhookKey?: string | null;
    /** `ACTIVE` | `INACTIVE`. Required. */
    status: 'ACTIVE' | 'INACTIVE' | string;
}

/**
 * Body for `PATCH /v1/wachat/project-attributes/projects/{id}/attributes` —
 * the full replacement set (replaces the stored array).
 *
 * Mirrors the Rust `ReplaceAttributesBody` DTO.
 */
export interface ReplaceAttributesBody {
    /** The complete new list of attributes (replaces the stored array). */
    attributes: WachatUserAttribute[];
}

/**
 * Result of `GET /v1/wachat/project-attributes/projects/{id}/attributes`.
 *
 * Mirrors the Rust `ListAttributesResponse` DTO. The stored attributes are
 * returned as cleaned JSON objects (passthrough so any extra legacy fields
 * the client wrote survive a round trip) — typed here as
 * `WachatUserAttribute[]` since the handler always writes that shape.
 */
export interface ListAttributesResponse {
    attributes: WachatUserAttribute[];
}

/** `{ success: true }` envelope for the PATCH mutation. */
export interface ReplaceAttributesResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatProjectAttributesApi = {
    /** GET — list the project's `userAttributes[]` (empty array when unset). */
    list: (projectId: string) =>
        rustFetch<ListAttributesResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/attributes`,
        ),

    /** PATCH — replace the project's `userAttributes[]` with a validated set. */
    replace: (projectId: string, attributes: WachatUserAttribute[]) =>
        rustFetch<ReplaceAttributesResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/attributes`,
            {
                method: 'PATCH',
                body: JSON.stringify({ attributes } satisfies ReplaceAttributesBody),
            },
        ),
};

export type WachatProjectAttributesApi = typeof wachatProjectAttributesApi;
