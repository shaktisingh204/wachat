'use server';

/**
 * Wachat ads-roadmap server actions.
 *
 * Thin shims around the `wachat-ads-roadmap` Rust crate (mounted at
 * `/v1/wachat/ads-roadmap`), which owns the global roadmap phases and the
 * per-user, deduped upvotes. These actions back the
 * `/wachat/whatsapp-ads/roadmap` page:
 *
 *   getAdsRoadmapPhases() → GET  /phases
 *   voteAdsRoadmapPhase() → POST /phases/{phase}/vote (idempotent upvote)
 *   syncAdsRoadmap()      → POST /sync (stub; no external PM configured)
 *
 * The api is imported DIRECTLY from the client module (not via the central
 * `rustClient` barrel) — registration in `src/lib/rust-client/index.ts`
 * happens centrally later.
 */

import { revalidatePath } from 'next/cache';

import {
    wachatAdsRoadmapApi,
    type RoadmapPhase,
} from '@/lib/rust-client/wachat-ads-roadmap';
import { getErrorMessage } from '@/lib/utils';

const ROADMAP_PATH = '/wachat/whatsapp-ads/roadmap';

export interface GetAdsRoadmapPhasesResult {
    phases?: RoadmapPhase[];
    error?: string;
}

export interface VoteAdsRoadmapPhaseResult {
    success: boolean;
    /** `true` when this call recorded a brand-new vote (vs. idempotent no-op). */
    created?: boolean;
    /** The phase's aggregated vote count after the call. */
    voteCount?: number;
    error?: string;
}

export interface SyncAdsRoadmapResult {
    synced: boolean;
    reason?: string;
    error?: string;
}

/** Fetch the global roadmap phases, each enriched with its aggregated vote count. */
export async function getAdsRoadmapPhases(): Promise<GetAdsRoadmapPhasesResult> {
    try {
        const r = await wachatAdsRoadmapApi.listPhases();
        return { phases: r.phases };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

/** Record the caller's upvote for a phase (idempotent per user). */
export async function voteAdsRoadmapPhase(
    phaseSlug: string,
): Promise<VoteAdsRoadmapPhaseResult> {
    const slug = phaseSlug?.trim();
    if (!slug) {
        return { success: false, error: 'Phase is required.' };
    }
    try {
        const r = await wachatAdsRoadmapApi.votePhase(slug);
        revalidatePath(ROADMAP_PATH);
        return { success: r.success, created: r.created, voteCount: r.voteCount };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/** Trigger an external-PM sync (currently a stub — never performs a live sync). */
export async function syncAdsRoadmap(): Promise<SyncAdsRoadmapResult> {
    try {
        const r = await wachatAdsRoadmapApi.sync();
        revalidatePath(ROADMAP_PATH);
        return { synced: r.synced, reason: r.reason };
    } catch (e: unknown) {
        return { synced: false, error: getErrorMessage(e) };
    }
}
