/**
 * Client for the Wachat **ab-testing** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/ab-tests` by the
 * `wachat-ab-testing` crate (split-test broadcast campaigns for the
 * `/wachat/campaign-ab-test` page):
 *
 *   GET    /?projectId=                  → listTests
 *   POST   /                             → createTest (create + persist scaffold)
 *   GET    /{id}                              → getTest (detail + per-variant results)
 *   DELETE /{id}                              → deleteTest
 *   POST   /{id}/stop                         → stopTest
 *   POST   /{id}/promote-winner               → promoteWinner
 *   POST   /{id}/variants/{variant}/broadcast → attachBroadcast (variant=A|B)
 *
 * The crate ONLY persists the config + a zeroed results scaffold — the
 * actual split broadcast is fired Next-side via
 * `rustClient.wachatBroadcast.bulkStart`, and a webhook later updates
 * `wa_ab_test_results`.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/ab-tests';

// ---------------------------------------------------------------------------
// Wire shapes (mirror the Rust DTOs — camelCase over the wire because every
// Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/** One variant of a split test (the `A` or `B` template). */
export interface VariantInput {
    /** Optional WhatsApp template id (when the page has a real template id). */
    templateId?: string | null;
    /** Human-readable template name shown in the picker. */
    name: string;
}

/** Body for `POST /v1/wachat/ab-tests` — create + persist a split test. */
export interface CreateTestBody {
    /** Project this test runs under (hex ObjectId). */
    projectId: string;
    /** Human label for the test. */
    name: string;
    /** Variant A template. */
    variantA: VariantInput;
    /** Variant B template. */
    variantB: VariantInput;
    /** Percentage of the audience routed to variant A (10..=90). */
    splitPct: number;
    /** Audience/segment selector: `"all"` or a `wa_broadcast_segments` id. */
    audience: string;
    /** Optional phone-number id the broadcast sends from. */
    phoneNumberId?: string | null;
}

/** Body for `POST /v1/wachat/ab-tests/{id}/promote-winner`. */
export interface PromoteWinnerBody {
    /** Winning variant: `"A"` or `"B"`. */
    winnerVariant: 'A' | 'B';
}

/**
 * Body for `POST /v1/wachat/ab-tests/{id}/variants/{variant}/broadcast` —
 * associate the launched broadcast with a variant. Once set, that variant's
 * `sent/delivered/read/failed` metrics are computed live from the
 * broadcast's `broadcast_contacts` rows.
 */
export interface AttachBroadcastBody {
    /** Hex `ObjectId` of the launched broadcast (a `broadcasts._id`). */
    broadcastId: string;
}

/** A/B test variant discriminator. */
export type AbVariant = 'A' | 'B';

/** Stored variant sub-doc as it comes back on a test config. */
export interface AbTestVariant {
    templateId: string | null;
    name: string;
}

/** Computed per-variant metrics (mirrors `VariantResult` in the Rust DTO). */
export interface VariantResult {
    /** `"A"` or `"B"`. */
    variant: string;
    /**
     * The `broadcasts._id` (hex) feeding this variant's metrics, or `null`
     * when no broadcast has been attached yet (the "not launched yet"
     * state — counts are all `0`, never fabricated).
     */
    broadcastId: string | null;
    /** Rows that reached SENT, DELIVERED or READ (handed to Meta). */
    sent: number;
    /** Rows that reached DELIVERED or READ. */
    delivered: number;
    /** Rows that reached READ (the "opened" signal for templates). */
    read: number;
    /** Rows that terminated in FAILED. */
    failed: number;
    /** Alias of `read` kept for the existing page contract (opened === read). */
    opened: number;
    /** Best-effort inbound replies attributed to this broadcast's recipients. */
    replied: number;
    /** `read / sent`, in `0.0..=1.0` (0 when `sent === 0`). */
    openRate: number;
    /** `replied / sent`, in `0.0..=1.0` (0 when `sent === 0`). */
    replyRate: number;
}

/** Light summary embedded on each row of the list response. */
export interface AbTestSummary {
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalFailed: number;
    totalReplied: number;
    variants: VariantResult[];
}

/** A persisted A/B test config doc (cleaned JSON from Mongo). */
export interface AbTest {
    _id: string;
    userId: string;
    projectId: string;
    name: string;
    variantA: AbTestVariant;
    variantB: AbTestVariant;
    splitPct: number;
    audience: string;
    phoneNumberId: string | null;
    status: 'running' | 'stopped' | 'completed' | string;
    winnerVariant: 'A' | 'B' | null;
    createdAt: string;
    updatedAt: string;
    /** Only present on the list response (enriched server-side). */
    summary?: AbTestSummary;
}

/** Response for `GET /v1/wachat/ab-tests?projectId=`. */
export interface ListTestsResponse {
    tests: AbTest[];
}

/** Response for `GET /v1/wachat/ab-tests/{id}`. */
export interface TestDetailResponse {
    test: AbTest;
    variants: VariantResult[];
}

/** `{ success: true }` envelope for stop / promote / delete. */
export interface SuccessResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Query helpers — keep `?projectId=…` strings off the call sites.
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatAbTestingApi = {
    /** `GET /v1/wachat/ab-tests?projectId=` — list tests (+ summary). */
    list: (projectId: string) =>
        rustFetch<ListTestsResponse>(`${BASE}${qs({ projectId })}`),

    /** `POST /v1/wachat/ab-tests` — create + persist the test scaffold. */
    create: (body: CreateTestBody) =>
        rustFetch<AbTest>(`${BASE}`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `GET /v1/wachat/ab-tests/{id}` — detail + per-variant results. */
    get: (id: string) =>
        rustFetch<TestDetailResponse>(`${BASE}/${encodeURIComponent(id)}`),

    /** `POST /v1/wachat/ab-tests/{id}/stop` — mark `status="stopped"`. */
    stop: (id: string) =>
        rustFetch<SuccessResponse>(`${BASE}/${encodeURIComponent(id)}/stop`, {
            method: 'POST',
        }),

    /** `POST /v1/wachat/ab-tests/{id}/promote-winner` — `status="completed"` + winner. */
    promoteWinner: (id: string, body: PromoteWinnerBody) =>
        rustFetch<SuccessResponse>(
            `${BASE}/${encodeURIComponent(id)}/promote-winner`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    /**
     * `POST /v1/wachat/ab-tests/{id}/variants/{variant}/broadcast` — link the
     * launched broadcast to variant `A`/`B` so its live metrics light up.
     * Idempotent on the Rust side (re-attaching overwrites the link).
     */
    attachBroadcast: (testId: string, variant: AbVariant, broadcastId: string) =>
        rustFetch<SuccessResponse>(
            `${BASE}/${encodeURIComponent(testId)}/variants/${encodeURIComponent(
                variant,
            )}/broadcast`,
            {
                method: 'POST',
                body: JSON.stringify({ broadcastId } satisfies AttachBroadcastBody),
            },
        ),

    /** `DELETE /v1/wachat/ab-tests/{id}` — delete test + its results. */
    delete: (id: string) =>
        rustFetch<SuccessResponse>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
};

export type WachatAbTestingApi = typeof wachatAbTestingApi;
