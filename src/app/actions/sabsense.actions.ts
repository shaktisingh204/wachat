'use server';

/**
 * PageSense server actions — site, heatmap, funnel, recording, and
 * form-analytics CRUD. Thin wrappers over the Rust BFF; the rust-client
 * modules in `src/lib/rust-client/pagesense-*.ts` are already
 * server-only, but actions add Next.js revalidation + a small
 * normalized return shape.
 */

import { revalidatePath } from 'next/cache';

import { pagesenseSitesApi, type CreateSiteInput, type UpdateSiteInput } from '@/lib/rust-client/sabsense-sites';
import { pagesenseHeatmapsApi } from '@/lib/rust-client/sabsense-heatmaps';
import { pagesenseHeatmapEventsApi } from '@/lib/rust-client/sabsense-heatmap-events';
import {
    pagesenseFunnelsApi,
    type FunnelStep,
} from '@/lib/rust-client/sabsense-funnels';
import { pagesenseFunnelRunsApi } from '@/lib/rust-client/sabsense-funnel-runs';
import { pagesenseRecordingsApi } from '@/lib/rust-client/sabsense-recordings';
import {
    pagesenseFormAnalyticsApi,
    type FieldDropoff,
} from '@/lib/rust-client/sabsense-form-analytics';

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string };

function errResult(e: unknown, fallback: string): { success: false; error: string } {
    const msg = e instanceof Error ? e.message : fallback;
    return { success: false, error: msg };
}

/* ─── Sites ──────────────────────────────────────────────────────────── */

export async function listPagesenseSites() {
    try {
        const r = await pagesenseSitesApi.list({ limit: 100 });
        return r.items;
    } catch (e) {
        console.error('[pagesense] listSites failed', e);
        return [];
    }
}

export async function getPagesenseSite(id: string) {
    try {
        return await pagesenseSitesApi.getById(id);
    } catch (e) {
        console.error('[pagesense] getSite failed', e);
        return null;
    }
}

export async function createPagesenseSite(input: CreateSiteInput): Promise<ActionResult<{ id: string }>> {
    try {
        const r = await pagesenseSitesApi.create(input);
        revalidatePath('/dashboard/pagesense');
        return { success: true, data: { id: r.id } };
    } catch (e) {
        return errResult(e, 'Failed to create site');
    }
}

export async function updatePagesenseSite(id: string, patch: UpdateSiteInput): Promise<ActionResult> {
    try {
        await pagesenseSitesApi.update(id, patch);
        revalidatePath('/dashboard/pagesense');
        revalidatePath(`/dashboard/pagesense/${id}`);
        return { success: true };
    } catch (e) {
        return errResult(e, 'Failed to update site');
    }
}

export async function deletePagesenseSite(id: string): Promise<ActionResult> {
    try {
        await pagesenseSitesApi.delete(id);
        revalidatePath('/dashboard/pagesense');
        return { success: true };
    } catch (e) {
        return errResult(e, 'Failed to delete site');
    }
}

/* ─── Heatmaps ───────────────────────────────────────────────────────── */

export async function listHeatmapSnapshots(params: { siteId: string; url?: string; variant?: string }) {
    try {
        const r = await pagesenseHeatmapsApi.list({ ...params, limit: 50 });
        return r.items;
    } catch (e) {
        console.error('[pagesense] listHeatmapSnapshots failed', e);
        return [];
    }
}

export async function regenerateHeatmapSnapshot(input: {
    siteId: string;
    url: string;
    variant?: string;
    periodFromMs: number;
    periodToMs: number;
}): Promise<ActionResult<{ id: string; sampleSize: number }>> {
    try {
        const r = await pagesenseHeatmapsApi.regenerate(input);
        revalidatePath(`/dashboard/pagesense/${input.siteId}/heatmaps`);
        revalidatePath(`/dashboard/pagesense/${input.siteId}/scroll`);
        return { success: true, data: r };
    } catch (e) {
        return errResult(e, 'Failed to regenerate snapshot');
    }
}

export async function listHeatmapEvents(params: {
    siteId: string;
    url?: string;
    limit?: number;
    fromMs?: number;
    toMs?: number;
    eventType?: 'click' | 'move' | 'scroll';
}) {
    try {
        const r = await pagesenseHeatmapEventsApi.list(params);
        return r.items;
    } catch (e) {
        console.error('[pagesense] listHeatmapEvents failed', e);
        return [];
    }
}

/* ─── Funnels ────────────────────────────────────────────────────────── */

export async function listFunnels(siteId: string) {
    try {
        const r = await pagesenseFunnelsApi.list({ siteId, limit: 100 });
        return r.items;
    } catch (e) {
        console.error('[pagesense] listFunnels failed', e);
        return [];
    }
}

export async function createFunnel(input: {
    siteId: string;
    name: string;
    steps: FunnelStep[];
}): Promise<ActionResult<{ id: string }>> {
    try {
        const r = await pagesenseFunnelsApi.create(input);
        revalidatePath(`/dashboard/pagesense/${input.siteId}/funnels`);
        return { success: true, data: { id: r.id } };
    } catch (e) {
        return errResult(e, 'Failed to create funnel');
    }
}

export async function deleteFunnel(siteId: string, funnelId: string): Promise<ActionResult> {
    try {
        await pagesenseFunnelsApi.delete(funnelId);
        revalidatePath(`/dashboard/pagesense/${siteId}/funnels`);
        return { success: true };
    } catch (e) {
        return errResult(e, 'Failed to delete funnel');
    }
}

export async function listFunnelRuns(funnelId: string) {
    try {
        const r = await pagesenseFunnelRunsApi.list({ funnelId, limit: 20 });
        return r.items;
    } catch (e) {
        console.error('[pagesense] listFunnelRuns failed', e);
        return [];
    }
}

export async function runFunnel(
    siteId: string,
    body: { funnelId: string; periodFromMs: number; periodToMs: number },
): Promise<ActionResult<{ id: string }>> {
    try {
        const r = await pagesenseFunnelRunsApi.run(body);
        revalidatePath(`/dashboard/pagesense/${siteId}/funnels`);
        return { success: true, data: { id: r.id } };
    } catch (e) {
        return errResult(e, 'Failed to run funnel');
    }
}

/* ─── Recordings ─────────────────────────────────────────────────────── */

export async function listRecordings(params: {
    siteId: string;
    url?: string;
    country?: string;
    minDuration?: number;
}) {
    try {
        const r = await pagesenseRecordingsApi.list({ ...params, limit: 50 });
        return r.items;
    } catch (e) {
        console.error('[pagesense] listRecordings failed', e);
        return [];
    }
}

export async function getRecording(id: string) {
    try {
        return await pagesenseRecordingsApi.getById(id);
    } catch (e) {
        console.error('[pagesense] getRecording failed', e);
        return null;
    }
}

/* ─── Form analytics ─────────────────────────────────────────────────── */

export async function listFormAnalytics(siteId: string) {
    try {
        const r = await pagesenseFormAnalyticsApi.list({ siteId, limit: 100 });
        return r.items;
    } catch (e) {
        console.error('[pagesense] listFormAnalytics failed', e);
        return [];
    }
}

export async function upsertFormAnalytics(input: {
    siteId: string;
    formSelector: string;
    perFieldDropoff?: FieldDropoff[];
    completionRate?: number;
}): Promise<ActionResult<{ id: string }>> {
    try {
        const r = await pagesenseFormAnalyticsApi.upsert(input);
        revalidatePath(`/dashboard/pagesense/${input.siteId}/forms`);
        return { success: true, data: { id: r.id } };
    } catch (e) {
        return errResult(e, 'Failed to upsert form analytics');
    }
}

export async function deleteFormAnalytics(siteId: string, id: string): Promise<ActionResult> {
    try {
        await pagesenseFormAnalyticsApi.delete(id);
        revalidatePath(`/dashboard/pagesense/${siteId}/forms`);
        return { success: true };
    } catch (e) {
        return errResult(e, 'Failed to delete form analytics');
    }
}
