/**
 * Client for the Wachat **quality-history** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/quality-history` by the
 * `wachat-quality-history` crate. Backs the per-phone-number quality
 * time-series on the `/wachat/health` page:
 *
 *   GET    /{phoneNumberId}            → listSnapshots  (sorted by date asc, [] when none)
 *   POST   /{phoneNumberId}/snapshot   → createSnapshot (record {rating, event?})
 *
 * Reads return an honest empty array when there is no history — never mock
 * data. Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/quality-history';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/** Quality rating label stored per snapshot. */
export type QualityRating = 'GREEN' | 'YELLOW' | 'RED';

/**
 * One quality snapshot document, as returned by `GET /{phoneNumberId}`.
 *
 * Shaped by `document_to_clean_json` on the Rust side, so `_id` and the
 * BSON dates are serialized as strings. `event` is `null` when no
 * annotation was recorded.
 */
export interface QualitySnapshot {
    _id: string;
    userId: string;
    phoneNumberId: string;
    rating: QualityRating | string;
    event: string | null;
    /** ISO timestamp of the reading (the time-series x-axis). */
    date: string;
    createdAt: string;
}

/**
 * Body for `POST /v1/wachat/quality-history/{phoneNumberId}/snapshot` —
 * record one quality reading.
 */
export interface SnapshotBody {
    /** Quality rating label at this point in time. Normalized to uppercase. */
    rating: QualityRating | string;
    /** Optional event/annotation explaining a change (empty stores `null`). */
    event?: string;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/**
 * Result of `GET /v1/wachat/quality-history/{phoneNumberId}`.
 *
 * `snapshots` is sorted by `date` ascending and is an empty array when the
 * phone number has no recorded history (honest empty state — never mocked).
 */
export interface ListSnapshotsResponse {
    snapshots: QualitySnapshot[];
}

/** `{ success: true }` envelope for the snapshot mutation. */
export interface SnapshotSuccessResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatQualityHistoryApi = {
    listSnapshots: (phoneNumberId: string) =>
        rustFetch<ListSnapshotsResponse>(
            `${BASE}/${encodeURIComponent(phoneNumberId)}`,
        ),

    createSnapshot: (phoneNumberId: string, body: SnapshotBody) =>
        rustFetch<SnapshotSuccessResponse>(
            `${BASE}/${encodeURIComponent(phoneNumberId)}/snapshot`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),
};

export type WachatQualityHistoryApi = typeof wachatQualityHistoryApi;
