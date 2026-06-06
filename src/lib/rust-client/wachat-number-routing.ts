/**
 * Client for the Wachat **number-routing** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/number-routing` by the
 * `wachat-number-routing` crate — the backend for the `/wachat/two-line`
 * page (phone-number → team + default-route bindings):
 *
 *   GET    /          → list_bindings
 *   POST   /          → create_binding
 *   PUT    /{id}      → update_binding
 *   DELETE /{id}      → delete_binding
 *
 * All endpoints are scoped to the authenticated user. Server-only — uses the
 * shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/number-routing';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// the create/update handlers use `serde(rename_all = "camelCase")` and the
// stored docs are emitted through `document_to_clean_json`, which renders
// `_id` as a plain hex string and `DateTime` as an ISO-8601 string).
// ---------------------------------------------------------------------------

/** Inbound routing destination for a number. */
export type NumberRoutingRoute = 'bot' | 'agent';

/**
 * Body for `POST /` (create) and `PUT /{id}` (update). Matches the Rust
 * `BindingBody` DTO exactly.
 */
export interface NumberRoutingBindingBody {
    /** Human label for this line (e.g. "Sales line"). */
    label: string;
    /** WABA phone-number id this binding routes for. */
    phoneNumberId: string;
    /** Assigned team id. Omit / empty clears the assignment. */
    teamId?: string;
    /** Default route for inbound messages: `"bot"` or `"agent"`. */
    defaultRoute: NumberRoutingRoute;
}

/**
 * A stored binding document, as returned by the Rust handlers after
 * `document_to_clean_json`. `_id` is a plain hex string; `teamId` is `null`
 * when unassigned; timestamps are ISO-8601 strings.
 */
export interface NumberRoutingBinding {
    _id: string;
    userId: string;
    label: string;
    phoneNumberId: string;
    teamId: string | null;
    defaultRoute: string;
    createdAt: string;
    updatedAt: string;
}

/** Result of `GET /` — the caller's bindings. */
export interface ListBindingsResponse {
    bindings: NumberRoutingBinding[];
}

/** `{ success: true }` envelope returned by PUT / DELETE. */
export interface NumberRoutingSuccessResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatNumberRoutingApi = {
    /** GET / — list the authenticated user's bindings. */
    list: () => rustFetch<ListBindingsResponse>(`${BASE}/`),

    /** POST / — create a binding; returns the new (cleaned) document. */
    create: (body: NumberRoutingBindingBody) =>
        rustFetch<NumberRoutingBinding>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** PUT /{id} — update a binding; returns `{ success }`. */
    update: (id: string, body: NumberRoutingBindingBody) =>
        rustFetch<NumberRoutingSuccessResponse>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),

    /** DELETE /{id} — delete a binding; returns `{ success }`. */
    remove: (id: string) =>
        rustFetch<NumberRoutingSuccessResponse>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
};

export type WachatNumberRoutingApi = typeof wachatNumberRoutingApi;
