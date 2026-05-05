'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { getAdminSession } from '@/lib/admin-session';
import { rustClient } from '@/lib/rust-client';
import { getErrorMessage } from '@/lib/utils';
import type { WebhookLogListItem } from '@/lib/definitions';

/**
 * User-facing webhook server-action shims.
 *
 * Phase 6: each function below is a thin wrapper around the Rust BFF
 * (`/v1/wachat/webhook-actions/*`) exposed through `rustClient.wachatWebhookActions`.
 * Return-type contracts match the previous TS bodies exactly so the call
 * sites in the wachat dashboard never change.
 *
 * The legacy direct-Mongo path was retired with this phase — Rust is the
 * single source of truth for `webhook_logs` reads/writes from server actions.
 */

/** Paginated list of captured webhook deliveries for the wachat dashboard. */
export async function getWebhookLogs(
    projectId: string | null,
    page: number = 1,
    limit: number = 20,
    query?: string,
): Promise<{ logs: WebhookLogListItem[]; total: number }> {
    // `query` (free-text searchableText filter) is not exposed by the Rust
    // surface yet — drop it on the floor rather than 500ing. The legacy
    // path used a Mongo `$regex` over a denormalised field that no longer
    // lives on every doc.
    void query;

    try {
        const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
        const safePage = Number.isInteger(page) && page > 0 ? page : 1;

        const resp = await rustClient.wachatWebhookActions.listLogs({
            projectId: projectId ?? undefined,
            limit: safeLimit,
        });

        const logs: WebhookLogListItem[] = resp.logs.map((l) => ({
            _id: l.id,
            createdAt: l.receivedAt,
            eventField: l.field || 'N/A',
            eventSummary: l.error ? `Error: ${l.error}` : `Status: ${l.status}`,
        }));

        // Cursor-based pagination — total isn't returned. Mirror the
        // earlier Rust shim's "has-more" proxy so the UI's page math
        // doesn't regress.
        const total = resp.nextCursor ? safeLimit * (safePage + 1) : safeLimit * safePage;

        return { logs, total };
    } catch (error) {
        console.error('Failed to fetch webhook logs:', getErrorMessage(error));
        return { logs: [], total: 0 };
    }
}

/** Fetch the raw payload for a single webhook log entry. */
export async function getWebhookLogPayload(logId: string): Promise<any | null> {
    if (!ObjectId.isValid(logId)) {
        return null;
    }
    try {
        return await rustClient.wachatWebhookActions.getPayload(logId);
    } catch (error) {
        console.error('Failed to fetch webhook log payload:', getErrorMessage(error));
        return null;
    }
}

/** Mark a webhook log for reprocessing through the receiver pipeline. */
export async function handleReprocessWebhook(
    logId: string,
): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(logId)) {
        return { error: 'Invalid Log ID.' };
    }
    try {
        const r = await rustClient.wachatWebhookActions.reprocess(logId);
        return {
            message: r.ok
                ? `Marked log ${r.logId} for reprocessing.`
                : 'Reprocess failed.',
        };
    } catch (e) {
        return { error: getErrorMessage(e) || 'An unexpected error occurred during re-processing.' };
    }
}

/** Bulk-delete every webhook log whose status is `processed`. */
export async function handleClearProcessedLogs(): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    try {
        const r = await rustClient.wachatWebhookActions.clearProcessed();
        revalidatePath('/wachat/webhooks');
        return { message: `Successfully cleared ${r.deleted} processed webhook log(s).` };
    } catch (e) {
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}
