/**
 * Client for the Wachat **contact-merge** router on the Rust BFF.
 *
 * Mirrors the single route registered under `/v1/wachat/contact-merge` by the
 * `wachat-contact-merge` crate:
 *
 *   POST   /   → merge_contacts (destructive)
 *
 * Folds the `secondaryId` contact into the `primaryId` contact within one
 * project: the primary survives (winning non-null fields, `tagIds` unioned,
 * `variables` shallow-merged), every `incoming_messages` / `outgoing_messages`
 * FK is re-pointed, the secondary's stale `conversations` rows are dropped, and
 * the secondary contact is deleted. Owner-or-agent project guard, scoped to one
 * project.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/contact-merge';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * Body for `POST /v1/wachat/contact-merge`.
 *
 * Merges the `secondaryId` contact into the `primaryId` contact within a single
 * project. Both contacts must be scoped to `projectId`; `primaryId` survives.
 */
export interface MergeContactsBody {
    /** Project the two contacts belong to. Both must be scoped to it. */
    projectId: string;
    /** The surviving contact's id (hex `ObjectId`). Wins field conflicts. */
    primaryId: string;
    /** The contact to fold in and then delete (hex `ObjectId`). */
    secondaryId: string;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/**
 * Result of `POST /v1/wachat/contact-merge`.
 *
 * `contact` is the merged primary, normalised by the Rust side
 * (`ObjectId`→hex, dates→ISO); shape matches a `contacts` document, so the
 * caller reads `_id` / `name` / `waId` / `tagIds` off it. The `*Repointed` /
 * `*Removed` counts are for observability.
 */
export interface MergeContactsResponse {
    /** Always `true` on success (the error path returns a non-2xx body). */
    success: boolean;
    /** The merged primary contact, ObjectId→hex / dates→ISO normalised. */
    contact: MergedContact;
    /** Number of `incoming_messages` rows re-pointed to the primary. */
    incomingRepointed: number;
    /** Number of `outgoing_messages` rows re-pointed to the primary. */
    outgoingRepointed: number;
    /** Number of stale `conversations` rows removed for the secondary. */
    conversationsRemoved: number;
}

/**
 * The merged primary `contacts` document as returned by the Rust side. Only the
 * fields the merge surface reads are typed; the index signature keeps any extra
 * passthrough fields (e.g. `variables`, `phoneNumberId`, `updatedAt`).
 */
export interface MergedContact {
    _id: string;
    name?: string | null;
    waId?: string | null;
    tagIds?: string[];
    [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatContactMergeApi = {
    /**
     * `POST /v1/wachat/contact-merge` — fold `secondaryId` into `primaryId`.
     * Destructive: re-points message FKs and deletes the secondary contact.
     */
    merge: (body: MergeContactsBody) =>
        rustFetch<MergeContactsResponse>(BASE, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

export type WachatContactMergeApi = typeof wachatContactMergeApi;
