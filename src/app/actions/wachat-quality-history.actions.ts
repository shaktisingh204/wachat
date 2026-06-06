'use server';

/**
 * Wachat quality-history server actions — backs the per-phone-number quality
 * time-series on the `/wachat/health` page.
 *
 * Thin shims around `wachatQualityHistoryApi`, which owns the Mongo reads/
 * writes (collection `wa_phone_quality_history`) in the Rust crate
 * `wachat-quality-history` (mounted at `/v1/wachat/quality-history`). This
 * file only:
 *
 *   1. validates input,
 *   2. delegates to the namespace,
 *   3. returns `{ success, ... }` / the data shape the page expects,
 *   4. calls `revalidatePath()` on the health page after a mutation.
 *
 * Imported DIRECTLY from the client module (not via `rustClient`) — central
 * barrel registration in `src/lib/rust-client/index.ts` happens separately.
 */

import { revalidatePath } from 'next/cache';

import {
    wachatQualityHistoryApi,
    type QualitySnapshot,
    type QualityRating,
} from '@/lib/rust-client/wachat-quality-history';
import { getErrorMessage } from '@/lib/utils';

const HEALTH_PATH = '/wachat/health';
const VALID_RATINGS: ReadonlySet<string> = new Set(['GREEN', 'YELLOW', 'RED']);

export type QualityHistoryResult =
    | { snapshots: QualitySnapshot[]; error?: undefined }
    | { error: string; snapshots?: undefined };

/**
 * List the quality snapshots for one phone number, sorted by `date` asc.
 * Returns `{ snapshots: [] }` honestly when there is no history.
 */
export async function getQualityHistory(
    phoneNumberId: string,
): Promise<QualityHistoryResult> {
    if (!phoneNumberId || !phoneNumberId.trim()) {
        return { error: 'A phone number ID is required.' };
    }
    try {
        const r = await wachatQualityHistoryApi.listSnapshots(phoneNumberId);
        return { snapshots: r.snapshots ?? [] };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Record one quality snapshot for a phone number.
 * `rating` must be one of GREEN | YELLOW | RED; `event` is optional.
 */
export async function recordQualitySnapshot(
    phoneNumberId: string,
    rating: QualityRating | string,
    event?: string,
): Promise<{ success: boolean; error?: string }> {
    if (!phoneNumberId || !phoneNumberId.trim()) {
        return { success: false, error: 'A phone number ID is required.' };
    }
    const normalizedRating = (rating || '').trim().toUpperCase();
    if (!VALID_RATINGS.has(normalizedRating)) {
        return {
            success: false,
            error: "Rating must be one of 'GREEN', 'YELLOW', or 'RED'.",
        };
    }
    try {
        const r = await wachatQualityHistoryApi.createSnapshot(phoneNumberId, {
            rating: normalizedRating,
            event: event?.trim() || undefined,
        });
        revalidatePath(HEALTH_PATH);
        return { success: r.success };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}
