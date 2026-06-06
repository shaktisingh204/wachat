/**
 * Client for the Wachat **ads-roadmap** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/ads-roadmap` by the
 * `wachat-ads-roadmap` crate (backs the `/wachat/whatsapp-ads/roadmap` page):
 *
 *   GET    /phases               → listPhases (global, with aggregated votes)
 *   POST   /phases/{phase}/vote  → votePhase (idempotent per-user upvote)
 *   POST   /sync                 → sync (stub; no external PM configured)
 *
 * Phases are a single global plan stored in `wa_ads_roadmap_phases`; upvotes
 * live in `wa_ads_roadmap_votes`, deduped by the authenticated user. The list
 * endpoint enriches each phase doc with `voteCount` (and a `votes` mirror).
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/ads-roadmap';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * A single roadmap phase as returned by `GET /phases`.
 *
 * Phases are stored as free-form Mongo docs (cleaned to JSON by the Rust
 * handler), so beyond the known fields below the shape is open. The handler
 * always injects `voteCount` and mirrors it into `votes`; the stable slug is
 * keyed under `slug` (preferred) or `phase` (fallback).
 */
export interface RoadmapPhase {
    /** Mongo `_id` as a hex string (present once the doc is cleaned). */
    _id?: string;
    /** Stable slug; the handler also accepts `phase` as the slug fallback. */
    slug?: string;
    /** Human/short phase label (also doubles as the slug fallback). */
    phase?: string;
    /** Display title for the phase card. */
    title?: string;
    /** Milestone bullet lines. */
    milestones?: string[];
    /** Free-form status string (e.g. "Completed" | "In Progress" | "Planned"). */
    status?: string;
    /** Canonical aggregated count of distinct voters for this phase. */
    voteCount?: number;
    /** Mirror of `voteCount` (kept so legacy `votes` readers keep working). */
    votes?: number;
    /** Any extra fields the phase doc carries. */
    [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/** Result of `GET /v1/wachat/ads-roadmap/phases`. */
export interface ListPhasesResponse {
    phases: RoadmapPhase[];
}

/**
 * Result of `POST /v1/wachat/ads-roadmap/phases/{phase}/vote`.
 *
 * `created` is `true` only when this call recorded a brand-new vote; a repeat
 * call by the same user is an idempotent no-op (`created: false`).
 */
export interface VoteResponse {
    success: boolean;
    created: boolean;
    /** The phase's aggregated vote count after this call. */
    voteCount: number;
}

/**
 * Result of `POST /v1/wachat/ads-roadmap/sync`.
 *
 * No external PM is wired, so this is a stub that always reports
 * `synced: false` with a fixed `reason`.
 */
export interface SyncResponse {
    synced: boolean;
    reason: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatAdsRoadmapApi = {
    listPhases: () => rustFetch<ListPhasesResponse>(`${BASE}/phases`),

    votePhase: (phase: string) =>
        rustFetch<VoteResponse>(
            `${BASE}/phases/${encodeURIComponent(phase)}/vote`,
            { method: 'POST' },
        ),

    sync: () =>
        rustFetch<SyncResponse>(`${BASE}/sync`, { method: 'POST' }),
};

export type WachatAdsRoadmapApi = typeof wachatAdsRoadmapApi;
