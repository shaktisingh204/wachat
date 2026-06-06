'use server';

/**
 * Wachat link-generator server actions.
 *
 * Thin shims around the `wachat-link-generator` Rust crate (mounted at
 * `/v1/wachat/link-generator`). They replace two legacy code paths:
 *
 *   - `integrations/whatsapp-link-generator/actions.ts#saveGeneratedLink`
 *     (native-Mongo insert into `wa_link_clicks`) → `saveGeneratedLink` here
 *   - `whatsapp-link-generator/actions.ts#shortenUrlAction` (TinyURL HTTP
 *     round-trip) → `shortenLink` here (internal shortener, no external dep)
 *
 * The crate owns all Mongo I/O and the owner-or-agent tenancy guard; this
 * file only validates input, delegates to the rust-client namespace,
 * re-shapes the response to the `{ success, ... }` contract the pages use,
 * and calls `revalidatePath()` on the same paths the legacy code did.
 *
 * NOTE: imports `wachatLinkGeneratorApi` directly from the client module
 * (the `rust-client/index.ts` barrel is intentionally NOT touched).
 */

import { revalidatePath } from 'next/cache';

import {
    wachatLinkGeneratorApi,
    type SavedLink,
} from '@/lib/rust-client/wachat-link-generator';
import { getErrorMessage } from '@/lib/utils';

export interface SaveGeneratedLinkResult {
    success: boolean;
    link?: SavedLink;
    error?: string;
}

export interface ListGeneratedLinksResult {
    success: boolean;
    links: SavedLink[];
    error?: string;
}

export interface ShortenLinkResult {
    success: boolean;
    /** Internal short path, e.g. `/s/1a2b3c4d`. */
    shortPath?: string;
    /** Absolute short URL built from `NEXT_PUBLIC_APP_URL` + `shortPath`. */
    shortUrl?: string;
    shortCode?: string;
    originalUrl?: string;
    error?: string;
}

/** Trim a configured base URL of any trailing slash. */
function appBaseUrl(): string {
    return (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
}

/**
 * Persist a generated `wa.me` link under a project. Also surfaces the link
 * on `/wachat/link-tracking` (the crate writes `clickedAt`), so we
 * revalidate both that page and the generator page.
 */
export async function saveGeneratedLink(
    projectId: string,
    url: string,
    meta?: { phone?: string; message?: string },
): Promise<SaveGeneratedLinkResult> {
    if (!projectId) return { success: false, error: 'A project is required.' };
    if (!url || !url.trim()) return { success: false, error: 'A link URL is required.' };
    try {
        const link = await wachatLinkGeneratorApi.saveLink(projectId, {
            url: url.trim(),
            phone: meta?.phone || undefined,
            message: meta?.message || undefined,
        });
        revalidatePath('/wachat/link-tracking');
        revalidatePath('/wachat/whatsapp-link-generator');
        revalidatePath('/wachat/integrations/whatsapp-link-generator');
        return { success: true, link };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/** List a project's saved links, newest first. */
export async function listGeneratedLinks(
    projectId: string,
): Promise<ListGeneratedLinksResult> {
    if (!projectId) return { success: false, links: [], error: 'A project is required.' };
    try {
        const r = await wachatLinkGeneratorApi.listLinks(projectId);
        return { success: true, links: r.links };
    } catch (e: unknown) {
        return { success: false, links: [], error: getErrorMessage(e) };
    }
}

/**
 * Shorten a long URL via the internal shortener (replaces the old TinyURL
 * round-trip). Returns both the raw short path and an absolute URL built
 * from `NEXT_PUBLIC_APP_URL` when configured.
 */
export async function shortenLink(url: string): Promise<ShortenLinkResult> {
    if (!url || !url.trim()) return { success: false, error: 'A URL is required.' };
    try {
        const r = await wachatLinkGeneratorApi.shorten({ url: url.trim() });
        const base = appBaseUrl();
        return {
            success: r.success,
            shortPath: r.shortPath,
            shortUrl: base ? `${base}${r.shortPath}` : r.shortPath,
            shortCode: r.shortCode,
            originalUrl: r.originalUrl,
        };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}
