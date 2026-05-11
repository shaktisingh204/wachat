'use server';

/**
 * Server actions for the Telegram Broadcasts dashboard page.
 *
 * Every method here is a thin wrapper around the typed Rust client.
 * The client is `server-only` so the page imports these helpers from
 * the Client Component layer.
 */

import { revalidatePath } from 'next/cache';

import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    AnalyticsResp,
    BroadcastRow,
    CreateBody,
    DeliveriesQuery,
    DeliveriesResp,
    ListQuery,
    UpdateBody,
} from '@/lib/rust-client/telegram-broadcasts';

const PAGE = '/dashboard/telegram/broadcasts';

type ActionEnvelope<T> =
    | ({ success: true } & T)
    | { success: false; error: string };

function fail(msg: string): { success: false; error: string } {
    return { success: false, error: msg };
}

function errMsg(err: unknown): string {
    if (err instanceof RustApiError) return err.message;
    if (err instanceof Error) return err.message;
    return String(err);
}

// ---------------------------------------------------------------------------
//  Reads
// ---------------------------------------------------------------------------

export async function listBroadcastsAction(
    query: ListQuery,
): Promise<{ broadcasts: BroadcastRow[]; nextCursor?: string; error?: string }> {
    try {
        const res = await rustClient.telegramBroadcasts.list(query);
        return {
            broadcasts: res.broadcasts ?? [],
            nextCursor: res.nextCursor,
            error: res.error,
        };
    } catch (err) {
        return { broadcasts: [], error: errMsg(err) };
    }
}

export async function getBroadcastAction(
    broadcastId: string,
    projectId: string,
): Promise<{ broadcast: BroadcastRow | null; error?: string }> {
    try {
        const res = await rustClient.telegramBroadcasts.get(broadcastId, projectId);
        return { broadcast: res.broadcast ?? null, error: res.error };
    } catch (err) {
        return { broadcast: null, error: errMsg(err) };
    }
}

export async function listDeliveriesAction(
    broadcastId: string,
    query: DeliveriesQuery,
): Promise<DeliveriesResp> {
    try {
        return await rustClient.telegramBroadcasts.deliveries(broadcastId, query);
    } catch (err) {
        return { deliveries: [], error: errMsg(err) };
    }
}

export async function exportDeliveriesCsvAction(
    broadcastId: string,
    projectId: string,
): Promise<{ csv: string; error?: string }> {
    try {
        // We piggy-back on the list endpoint and synthesise the CSV in
        // TS. The Rust crate also exposes a streaming CSV endpoint for
        // very large exports, but going through the server action keeps
        // the auth model identical to the rest of the page.
        const out: string[] = ['chatId,status,errorCode,errorMessage,sentAt'];
        let cursor: string | undefined;
        // Cap the pull to 100 pages × 500 rows = 50,000 deliveries to
        // protect the BFF; users with bigger exports should ask the
        // platform team for a direct dump.
        for (let i = 0; i < 100; i += 1) {
            const res = await rustClient.telegramBroadcasts.deliveries(broadcastId, {
                projectId,
                cursor,
                limit: 500,
            });
            if (res.error) return { csv: out.join('\n'), error: res.error };
            for (const d of res.deliveries) {
                out.push(
                    [
                        csvCell(d.chatId),
                        csvCell(d.status),
                        d.errorCode != null ? String(d.errorCode) : '',
                        csvCell(d.errorMessage ?? ''),
                        d.sentAt ?? '',
                    ].join(','),
                );
            }
            if (!res.nextCursor) break;
            cursor = res.nextCursor;
        }
        return { csv: out.join('\n') };
    } catch (err) {
        return { csv: '', error: errMsg(err) };
    }
}

function csvCell(s: string): string {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

export async function analyticsAction(
    projectId: string,
    from?: string,
    to?: string,
): Promise<AnalyticsResp> {
    try {
        return await rustClient.telegramBroadcasts.analytics({ projectId, from, to });
    } catch (err) {
        return {
            totalBroadcasts: 0,
            totalSent: 0,
            totalFailed: 0,
            successRate: 0,
            topErrors: [],
            byDay: [],
            error: errMsg(err),
        };
    }
}

// ---------------------------------------------------------------------------
//  Mutations
// ---------------------------------------------------------------------------

export async function createBroadcastAction(
    body: CreateBody,
): Promise<ActionEnvelope<{ broadcastId?: string; message?: string }>> {
    try {
        const res = await rustClient.telegramBroadcasts.create(body);
        if (!res.success) return fail(res.error ?? 'Failed to create broadcast.');
        revalidatePath(PAGE);
        return { success: true, broadcastId: res.broadcastId, message: res.message };
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function updateBroadcastAction(
    broadcastId: string,
    body: UpdateBody,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await rustClient.telegramBroadcasts.update(broadcastId, body);
        if (!res.success) return fail(res.error ?? 'Failed to update broadcast.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function deleteBroadcastAction(
    broadcastId: string,
    projectId: string,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await rustClient.telegramBroadcasts.delete(broadcastId, projectId);
        if (!res.success) return fail(res.error ?? 'Failed to delete broadcast.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function duplicateBroadcastAction(
    broadcastId: string,
    projectId: string,
): Promise<ActionEnvelope<{ broadcastId?: string; message?: string }>> {
    try {
        const res = await rustClient.telegramBroadcasts.duplicate(broadcastId, projectId);
        if (!res.success) return fail(res.error ?? 'Failed to duplicate broadcast.');
        revalidatePath(PAGE);
        return { success: true, broadcastId: res.broadcastId, message: res.message };
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function sendBroadcastNowAction(
    broadcastId: string,
    projectId: string,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await rustClient.telegramBroadcasts.sendNow(broadcastId, projectId);
        if (!res.success) return fail(res.error ?? 'Failed to send broadcast.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function scheduleBroadcastAction(
    broadcastId: string,
    projectId: string,
    scheduledAt: string,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await rustClient.telegramBroadcasts.schedule(
            broadcastId,
            projectId,
            scheduledAt,
        );
        if (!res.success) return fail(res.error ?? 'Failed to schedule broadcast.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function cancelBroadcastAction(
    broadcastId: string,
    projectId: string,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await rustClient.telegramBroadcasts.cancel(broadcastId, projectId);
        if (!res.success) return fail(res.error ?? 'Failed to cancel broadcast.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function testBroadcastAction(
    broadcastId: string,
    projectId: string,
    chatId: number,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await rustClient.telegramBroadcasts.test(broadcastId, projectId, chatId);
        if (!res.success) return fail(res.error ?? 'Test send failed.');
        return { success: true, message: res.message };
    } catch (err) {
        return fail(errMsg(err));
    }
}
