'use server';

/**
 * Wachat widget-tracking server actions — wires the
 * `wachat-widget-tracking` Rust crate (mounted at `/v1/wachat/widget`) into
 * the `/wachat/integrations/whatsapp-widget-generator` page.
 *
 * Each body is a thin shim around `wachatWidgetTrackingApi.*`:
 *   1. validate the inputs,
 *   2. delegate to the namespace,
 *   3. return a `{ success, ... }` envelope,
 *   4. `revalidatePath()` the page so server-rendered reads stay fresh.
 *
 * Imports the API directly from its client module (NOT the `rustClient`
 * barrel in `@/lib/rust-client`) — the barrel `index.ts` is intentionally
 * left untouched for this wiring.
 */

import { revalidatePath } from 'next/cache';

import {
    wachatWidgetTrackingApi,
    type WidgetStats,
    type AdvancedSettingsBody,
} from '@/lib/rust-client/wachat-widget-tracking';
import { RustApiError } from '@/lib/rust-client';
import { getErrorMessage } from '@/lib/utils';

const WIDGET_PAGE_PATH = '/wachat/integrations/whatsapp-widget-generator';

function isObjectId(id: unknown): id is string {
    return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

function toMessage(e: unknown): string {
    if (e instanceof RustApiError) return e.message;
    return getErrorMessage(e);
}

// =================================================================
//  WIDGET STATS  (GET /{projectId}/stats)
// =================================================================

export type GetWidgetStatsResult =
    | { success: true; stats: WidgetStats }
    | { success: false; error: string };

export async function getWidgetStats(projectId: string): Promise<GetWidgetStatsResult> {
    if (!isObjectId(projectId)) {
        return { success: false, error: 'Invalid project ID.' };
    }
    try {
        const stats = await wachatWidgetTrackingApi.getStats(projectId);
        return { success: true, stats };
    } catch (e) {
        return { success: false, error: toMessage(e) };
    }
}

// =================================================================
//  ADVANCED SETTINGS  (PUT /{projectId}/advanced-settings)
// =================================================================

export type SaveAdvancedWidgetSettingsResult =
    | { success: true }
    | { success: false; error: string };

export async function saveAdvancedWidgetSettings(
    projectId: string,
    settings: AdvancedSettingsBody,
): Promise<SaveAdvancedWidgetSettingsResult> {
    if (!isObjectId(projectId)) {
        return { success: false, error: 'Invalid project ID.' };
    }

    // Coerce + validate the three knobs (the form sends loose values).
    const autoOpenDelay = Number.isFinite(settings.autoOpenDelay)
        ? Math.max(0, Math.trunc(settings.autoOpenDelay))
        : 0;
    const abTestEnabled = Boolean(settings.abTestEnabled);
    const styleVariant =
        typeof settings.styleVariant === 'string' && settings.styleVariant.trim()
            ? settings.styleVariant.trim()
            : 'classic';

    try {
        await wachatWidgetTrackingApi.updateAdvancedSettings(projectId, {
            autoOpenDelay,
            abTestEnabled,
            styleVariant,
        });
        revalidatePath(WIDGET_PAGE_PATH);
        return { success: true };
    } catch (e) {
        return { success: false, error: toMessage(e) };
    }
}
