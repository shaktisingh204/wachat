'use server';

/**
 * Server actions for the Telegram Broadcasts dashboard page.
 *
 * Every method here is a thin wrapper around the typed Rust client.
 * The client is `server-only` so the page imports these helpers from
 * the Client Component layer.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    AnalyticsResp,
    BroadcastRow,
    BroadcastStatus,
    CreateBody,
    DeliveriesQuery,
    DeliveriesResp,
    ListQuery,
    UpdateBody,
} from '@/lib/rust-client/telegram-broadcasts';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from './user.actions';
import { getProjectById } from './project.actions';
import { withRustFallback } from '@/lib/telegram/rust-fallback';

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

/**
 * Convert a Mongo `telegram_broadcasts` document into the camelCased
 * `BroadcastRow` envelope the page expects from the Rust BFF. Status
 * strings in Mongo are upper-case (`QUEUED`, `SENDING`, …); the Rust
 * envelope is lower-case (`scheduled`, `sending`, …), so we normalise.
 */
function statusToRust(s: unknown): BroadcastStatus {
    const v = String(s ?? '').toLowerCase();
    if (v === 'queued' || v === 'scheduled') return 'scheduled';
    if (v === 'sending') return 'sending';
    if (v === 'completed') return 'completed';
    if (v === 'failed') return 'failed';
    if (v === 'cancelled' || v === 'canceled') return 'cancelled';
    return 'draft';
}

function toIso(v: unknown): string | undefined {
    if (!v) return undefined;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return undefined;
}

function mongoDocToBroadcastRow(doc: any): BroadcastRow {
    const stats = doc.stats ?? {};
    return {
        _id: doc._id?.toString?.() ?? String(doc._id ?? ''),
        projectId: doc.projectId?.toString?.() ?? String(doc.projectId ?? ''),
        botId: doc.botId?.toString?.() ?? String(doc.botId ?? ''),
        name: doc.name ?? '',
        status: statusToRust(doc.status),
        audience: doc.audience ?? {},
        message: doc.message ?? {},
        media: doc.media ?? [],
        inlineKeyboard: doc.inlineKeyboard ?? doc.message?.buttons ?? [],
        counters: {
            queued: doc.counters?.queued,
            sent: stats.sent ?? doc.counters?.sent,
            failed: stats.failed ?? doc.counters?.failed,
            skipped: doc.counters?.skipped,
        },
        stats: {
            total: stats.total,
            sent: stats.sent,
            failed: stats.failed,
        },
        errorSummary: doc.errorSummary ?? null,
        scheduledAt: toIso(doc.scheduledAt),
        startedAt: toIso(doc.startedAt),
        completedAt: toIso(doc.completedAt ?? doc.finishedAt),
        createdAt: toIso(doc.createdAt) ?? new Date(0).toISOString(),
        updatedAt: toIso(doc.updatedAt) ?? new Date(0).toISOString(),
    };
}

/**
 * Resolve the caller's session and verify project access. Used by every
 * Mongo fallback path — without Rust we have to do the auth gate
 * ourselves.
 */
async function authProject(
    projectId: string,
): Promise<{ ok: true; userId: ObjectId } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Not authenticated.' };
    if (!ObjectId.isValid(projectId)) return { ok: false, error: 'Invalid project id.' };
    const project = await getProjectById(projectId);
    if (!project) return { ok: false, error: 'Access denied.' };
    return { ok: true, userId: new ObjectId(session.user._id) };
}

// ---------------------------------------------------------------------------
//  Reads
// ---------------------------------------------------------------------------

export async function listBroadcastsAction(
    query: ListQuery,
): Promise<{ broadcasts: BroadcastRow[]; nextCursor?: string; error?: string }> {
    type ListResult = {
        broadcasts: BroadcastRow[];
        nextCursor?: string;
        error?: string;
    };
    try {
        return await withRustFallback<ListResult>(
            async () => {
                const res = await rustClient.telegramBroadcasts.list(query);
                return {
                    broadcasts: res.broadcasts ?? [],
                    nextCursor: res.nextCursor,
                    error: res.error,
                };
            },
            async () => {
                // Mongo fallback — flat read, no cursor pagination.
                const auth = await authProject(query.projectId);
                if (!auth.ok) return { broadcasts: [], error: auth.error };
                if (!ObjectId.isValid(query.projectId)) {
                    return { broadcasts: [], error: 'Invalid project id.' };
                }
                const filter: Record<string, unknown> = {
                    projectId: new ObjectId(query.projectId),
                };
                if (query.botId && ObjectId.isValid(query.botId)) {
                    filter.botId = new ObjectId(query.botId);
                }
                const { db } = await connectToDatabase();
                const docs = await db
                    .collection('telegram_broadcasts')
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .limit(100)
                    .toArray();
                return {
                    broadcasts: docs.map(mongoDocToBroadcastRow),
                };
            },
        );
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
        return await withRustFallback(
            () => rustClient.telegramBroadcasts.deliveries(broadcastId, query),
            // Per-recipient deliveries are populated by the Rust worker;
            // no Mongo mirror exists, so return an empty list.
            async () => ({ deliveries: [] }),
        );
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
        return await withRustFallback(
            () => rustClient.telegramBroadcasts.analytics({ projectId, from, to }),
            // The analytics aggregation lives on the Rust side; the
            // legacy Node path never had it. Return zeroed defaults so
            // the dashboard cards stay visible instead of red-bannering.
            async () => ({
                totalBroadcasts: 0,
                totalSent: 0,
                totalFailed: 0,
                successRate: 0,
                topErrors: [],
                byDay: [],
            }),
        );
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
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramBroadcasts.create(body);
                if (!res.success) return fail(res.error ?? 'Failed to create broadcast.');
                revalidatePath(PAGE);
                return {
                    success: true as const,
                    broadcastId: res.broadcastId,
                    message: res.message,
                };
            },
            async () => {
                const auth = await authProject(body.projectId);
                if (!auth.ok) return fail(auth.error);
                if (!ObjectId.isValid(body.botId)) return fail('Invalid bot id.');
                const { db } = await connectToDatabase();
                // Verify bot belongs to project.
                const bot = await db
                    .collection('telegram_bots')
                    .findOne({
                        _id: new ObjectId(body.botId),
                        projectId: new ObjectId(body.projectId),
                    });
                if (!bot) return fail('Bot not found in this project.');
                const now = new Date();
                const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;
                const status = scheduledAt && scheduledAt.getTime() > now.getTime()
                    ? 'scheduled'
                    : 'QUEUED';
                const doc = {
                    projectId: new ObjectId(body.projectId),
                    botId: new ObjectId(body.botId),
                    userId: auth.userId,
                    name: body.name,
                    audience: body.audience,
                    message: body.message,
                    media: body.media ?? [],
                    inlineKeyboard: body.inlineKeyboard ?? [],
                    status,
                    stats: { total: 0, sent: 0, failed: 0 },
                    scheduledAt: scheduledAt ?? now,
                    createdAt: now,
                    updatedAt: now,
                };
                const ins = await db.collection('telegram_broadcasts').insertOne(doc as any);
                revalidatePath(PAGE);
                return {
                    success: true as const,
                    broadcastId: ins.insertedId.toString(),
                    message: 'Broadcast created.',
                };
            },
        );
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
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramBroadcasts.delete(broadcastId, projectId);
                if (!res.success) return fail(res.error ?? 'Failed to delete broadcast.');
                revalidatePath(PAGE);
                return { success: true as const, message: res.message };
            },
            async () => {
                if (!ObjectId.isValid(broadcastId)) return fail('Invalid broadcast id.');
                const auth = await authProject(projectId);
                if (!auth.ok) return fail(auth.error);
                const { db } = await connectToDatabase();
                const existing = await db
                    .collection('telegram_broadcasts')
                    .findOne({
                        _id: new ObjectId(broadcastId),
                        projectId: new ObjectId(projectId),
                    });
                if (!existing) return fail('Broadcast not found.');
                const status = String(existing.status ?? '').toLowerCase();
                if (status === 'sending') {
                    return fail('Cannot delete a broadcast while it is sending.');
                }
                await db
                    .collection('telegram_broadcasts')
                    .deleteOne({ _id: new ObjectId(broadcastId) });
                revalidatePath(PAGE);
                return { success: true as const, message: 'Broadcast deleted.' };
            },
        );
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
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramBroadcasts.sendNow(broadcastId, projectId);
                if (!res.success) return fail(res.error ?? 'Failed to send broadcast.');
                revalidatePath(PAGE);
                return { success: true as const, message: res.message };
            },
            async () => {
                // Without Rust we can't actually dispatch; instead we flag
                // the broadcast as QUEUED with `scheduledAt = now` so the
                // cron route at `/api/telegram/cron` picks it up on the
                // next tick.
                if (!ObjectId.isValid(broadcastId)) return fail('Invalid broadcast id.');
                const auth = await authProject(projectId);
                if (!auth.ok) return fail(auth.error);
                const { db } = await connectToDatabase();
                const existing = await db
                    .collection('telegram_broadcasts')
                    .findOne({
                        _id: new ObjectId(broadcastId),
                        projectId: new ObjectId(projectId),
                    });
                if (!existing) return fail('Broadcast not found.');
                const status = String(existing.status ?? '').toLowerCase();
                if (status === 'sending' || status === 'completed') {
                    return fail(`Cannot send a ${existing.status} broadcast.`);
                }
                const now = new Date();
                await db.collection('telegram_broadcasts').updateOne(
                    { _id: new ObjectId(broadcastId) },
                    { $set: { status: 'QUEUED', scheduledAt: now, updatedAt: now } },
                );
                revalidatePath(PAGE);
                return {
                    success: true as const,
                    message: 'Broadcast queued for delivery.',
                };
            },
        );
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
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramBroadcasts.cancel(broadcastId, projectId);
                if (!res.success) return fail(res.error ?? 'Failed to cancel broadcast.');
                revalidatePath(PAGE);
                return { success: true as const, message: res.message };
            },
            async () => {
                if (!ObjectId.isValid(broadcastId)) return fail('Invalid broadcast id.');
                const auth = await authProject(projectId);
                if (!auth.ok) return fail(auth.error);
                const { db } = await connectToDatabase();
                const existing = await db
                    .collection('telegram_broadcasts')
                    .findOne({
                        _id: new ObjectId(broadcastId),
                        projectId: new ObjectId(projectId),
                    });
                if (!existing) return fail('Broadcast not found.');
                const status = String(existing.status ?? '').toLowerCase();
                if (status === 'sending' || status === 'completed') {
                    return fail(`Cannot cancel a ${existing.status} broadcast.`);
                }
                await db.collection('telegram_broadcasts').updateOne(
                    { _id: new ObjectId(broadcastId) },
                    { $set: { status: 'CANCELLED', updatedAt: new Date() } },
                );
                revalidatePath(PAGE);
                return { success: true as const, message: 'Broadcast cancelled.' };
            },
        );
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
