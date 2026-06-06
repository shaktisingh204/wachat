/**
 * Client for the Wachat **link-generator** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/link-generator` by the
 * `wachat-link-generator` crate (replaces the legacy
 * `integrations/whatsapp-link-generator/actions.ts` native-Mongo
 * `saveGeneratedLink` + the TinyURL `shortenUrlAction`):
 *
 *   POST  /shorten                       → internal URL shortener (replaces tinyurl)
 *   GET   /projects/{projectId}/links    → list a project's saved wa.me links
 *   POST  /projects/{projectId}/links    → persist a generated wa.me link
 *
 * Server-only — uses the shared JWT-issuing fetcher. The Rust handlers
 * enforce owner-or-agent membership per project, so a saved link is never
 * visible across tenants.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/link-generator';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * Body for `POST /v1/wachat/link-generator/projects/{projectId}/links`.
 *
 * Mirrors `SaveLinkBody`: the generated `wa.me` URL plus the optional
 * sanitized phone (E.164 without `+`) and pre-filled message the page
 * already computes.
 */
export interface SaveLinkBody {
    /** The generated `wa.me` URL. */
    url: string;
    /** Sanitized E.164 phone (no `+`) the link targets. */
    phone?: string;
    /** Pre-filled message bundled into the link. */
    message?: string;
}

/**
 * One saved link row, as returned by `document_to_clean_json` on the Rust
 * side (`_id`/`projectId`/`userId` are hex strings, dates are ISO-8601;
 * `phone`/`message` are `null` when the page omitted them).
 */
export interface SavedLink {
    _id: string;
    projectId: string;
    userId: string;
    url: string;
    phone: string | null;
    message: string | null;
    /** ISO-8601. */
    createdAt: string;
    /** ISO-8601 — written equal to `createdAt` so the link surfaces in tracking. */
    clickedAt: string;
}

/**
 * Result of `GET /v1/wachat/link-generator/projects/{projectId}/links` —
 * mirrors `ListLinksResponse`. Newest first, capped at 500 server-side.
 */
export interface ListLinksResponse {
    links: SavedLink[];
}

/**
 * Body for `POST /v1/wachat/link-generator/shorten` — mirrors `ShortenBody`.
 */
export interface ShortenBody {
    /** The original (long) URL to shorten. */
    url: string;
}

/**
 * Result of `POST /v1/wachat/link-generator/shorten` — mirrors
 * `ShortenResponse`. The internal shortener stores `{ shortCode, originalUrl }`
 * and returns the internal short path `/s/{shortCode}` (no external request).
 */
export interface ShortenResponse {
    success: boolean;
    /** 8-char code derived deterministically from the doc ObjectId. */
    shortCode: string;
    /** Internal short path, e.g. `/s/1a2b3c4d`. */
    shortPath: string;
    /** Echo of the original URL. */
    originalUrl: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatLinkGeneratorApi = {
    /** Persist a generated `wa.me` link under the caller's project. */
    saveLink: (projectId: string, body: SaveLinkBody) =>
        rustFetch<SavedLink>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/links`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    /** List a project's saved links, newest first. */
    listLinks: (projectId: string) =>
        rustFetch<ListLinksResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/links`,
        ),

    /** Shorten a long URL via the internal shortener (replaces TinyURL). */
    shorten: (body: ShortenBody) =>
        rustFetch<ShortenResponse>(`${BASE}/shorten`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

export type WachatLinkGeneratorApi = typeof wachatLinkGeneratorApi;
