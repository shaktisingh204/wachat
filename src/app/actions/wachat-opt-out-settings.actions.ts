'use server';

/**
 * Wachat opt-out-SETTINGS server actions.
 *
 * Thin shims over the `wachatOptOutSettingsApi` namespace backed by the
 * `wachat-opt-out-settings` Rust crate (mounted at
 * `/v1/wachat/opt-out-settings`). The crate owns the `wa_opt_out_settings`
 * upsert (one doc per `{userId, projectId}`); this file only validates input,
 * delegates, and revalidates the `/wachat/opt-out` page.
 *
 * NOTE: the opt-out LIST lives in `wachat-features` — those actions
 * (`getOptOutList`, `addToOptOut`, `removeFromOptOut`) are unchanged. This
 * file backs ONLY the project-level AI-Settings toggle (`sentimentAutoOptOut`).
 *
 * This imports the api module directly rather than through `@/lib/rust-client`
 * because the central barrel registration is wired separately.
 */

import { revalidatePath } from 'next/cache';
import { wachatOptOutSettingsApi } from '@/lib/rust-client/wachat-opt-out-settings';
import type { OptOutSettings } from '@/lib/rust-client/wachat-opt-out-settings';
import { getErrorMessage } from '@/lib/utils';

export type GetOptOutSettingsResult =
    | { settings: OptOutSettings; error?: undefined }
    | { settings?: undefined; error: string };

/**
 * Read the project-level opt-out settings (or backend defaults when none has
 * been saved yet).
 */
export async function getOptOutSettings(
    projectId: string,
): Promise<GetOptOutSettingsResult> {
    if (!projectId) return { error: 'Project ID is required.' };
    try {
        const r = await wachatOptOutSettingsApi.getSettings(projectId);
        return { settings: r.settings };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export type SaveOptOutSettingsResult =
    | { success: true; error?: undefined }
    | { success: false; error: string };

/**
 * Upsert the sentiment-auto-opt-out toggle for a project.
 */
export async function saveOptOutSettings(
    projectId: string,
    sentimentAutoOptOut: boolean,
): Promise<SaveOptOutSettingsResult> {
    if (!projectId) return { success: false, error: 'Project ID is required.' };
    try {
        const r = await wachatOptOutSettingsApi.upsertSettings(projectId, {
            sentimentAutoOptOut,
        });
        revalidatePath('/wachat/opt-out');
        return { success: r.success };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}
