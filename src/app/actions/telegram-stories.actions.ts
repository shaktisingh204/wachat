'use server';

/**
 * Server actions for the Telegram Stories dashboard.
 *
 * Each action first calls the Rust BFF (`rustClient.telegramStories`),
 * and falls back to direct Mongo reads/writes against the
 * `telegram_stories` collection when the BFF is unreachable (404/5xx/0).
 * That keeps the dashboard usable on environments where the BFF route
 * isn't deployed yet, while preserving the same wire shapes the page
 * already consumes.
 *
 * Mutation rules:
 *   - create  → insertOne into `telegram_stories`, status `draft` or
 *               `scheduled` (when `scheduledAt` is provided).
 *   - update  → updateOne (project-scoped); only sets the fields the
 *               caller actually supplied.
 *   - delete  → deleteOne (project-scoped).
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    StoryRow,
    ListQuery as StoryListQuery,
    ListResp as StoryListResp,
    DetailResp as StoryDetailResp,
    CreateBody as StoryCreateBody,
    UpdateBody as StoryUpdateBody,
    AckResult as StoryAckResult,
} from '@/lib/rust-client/telegram-stories';
import { withRustFallback } from '@/lib/telegram/rust-fallback';
import { getSession } from './user.actions';

/**
 * Hydrate a Mongo `telegram_stories` doc into the `StoryRow` wire shape
 * exposed by the Rust stories client. The BFF returns ISO-8601 strings
 * for dates; Mongo holds JS `Date` instances, so we normalise here.
 */
function toStoryRow(doc: Record<string, unknown>): StoryRow {
    const toIso = (v: unknown) =>
        v instanceof Date
            ? v.toISOString()
            : typeof v === 'string'
            ? v
            : undefined;
    const createdAt = toIso(doc.createdAt) ?? new Date(0).toISOString();
    const updatedAt = toIso(doc.updatedAt) ?? createdAt;
    return {
        _id: String(doc._id),
        projectId: String(doc.projectId ?? ''),
        botId: String(doc.botId ?? ''),
        channelId: doc.channelId ? String(doc.channelId) : undefined,
        businessConnectionId:
            typeof doc.businessConnectionId === 'string'
                ? doc.businessConnectionId
                : undefined,
        telegramStoryId:
            typeof doc.telegramStoryId === 'number'
                ? doc.telegramStoryId
                : undefined,
        type: (doc.type === 'business'
            ? 'business'
            : 'channel') as StoryRow['type'],
        content:
            (doc.content ?? { mediaKind: 'photo', sabFileId: '' }) as StoryRow['content'],
        privacy: (doc.privacy ?? { kind: 'public' }) as StoryRow['privacy'],
        activePeriodSeconds:
            typeof doc.activePeriodSeconds === 'number'
                ? doc.activePeriodSeconds
                : 86400,
        postToChatPage: Boolean(doc.postToChatPage),
        protectContent: Boolean(doc.protectContent),
        status: (doc.status ?? 'draft') as StoryRow['status'],
        scheduledAt: toIso(doc.scheduledAt),
        postedAt: toIso(doc.postedAt),
        expiresAt: toIso(doc.expiresAt),
        errorMessage:
            typeof doc.errorMessage === 'string' ? doc.errorMessage : undefined,
        createdAt,
        updatedAt,
    };
}

// ---------------------------------------------------------------------------
//  Reads
// ---------------------------------------------------------------------------

export async function listTelegramStoriesActionWithFallback(
    q: StoryListQuery,
): Promise<StoryListResp> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const empty: StoryListResp = {
        stories: [],
        total: 0,
        hasMore: false,
        page,
        pageSize,
    };
    try {
        return await withRustFallback(
            () => rustClient.telegramStories.list(q),
            async () => {
                if (!q.projectId || !ObjectId.isValid(q.projectId)) return empty;
                const { db } = await connectToDatabase();
                const filter: Record<string, unknown> = {
                    projectId: new ObjectId(q.projectId),
                };
                if (q.botId && ObjectId.isValid(q.botId)) {
                    filter.botId = new ObjectId(q.botId);
                }
                if (q.status && q.status !== 'all') filter.status = q.status;
                if (q.type && q.type !== 'all') filter.type = q.type;
                if (q.search) {
                    const re = new RegExp(
                        q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                        'i',
                    );
                    (filter as { $or?: unknown[] }).$or = [
                        { 'content.caption': re },
                        { errorMessage: re },
                    ];
                }
                const skip = (page - 1) * pageSize;
                const [rows, total] = await Promise.all([
                    db
                        .collection('telegram_stories')
                        .find(filter)
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(pageSize)
                        .toArray(),
                    db.collection('telegram_stories').countDocuments(filter),
                ]);
                return {
                    stories: rows.map((r) =>
                        toStoryRow(r as Record<string, unknown>),
                    ),
                    total,
                    hasMore: skip + rows.length < total,
                    page,
                    pageSize,
                };
            },
        );
    } catch (e) {
        if (e instanceof RustApiError) return { ...empty, error: e.message };
        return { ...empty, error: String(e) };
    }
}

export async function getTelegramStoryActionWithFallback(
    storyId: string,
    projectId: string,
): Promise<StoryDetailResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramStories.detail(storyId, projectId),
            async () => {
                if (
                    !ObjectId.isValid(storyId) ||
                    !ObjectId.isValid(projectId)
                ) {
                    return { error: 'Invalid id.' };
                }
                const { db } = await connectToDatabase();
                const doc = await db.collection('telegram_stories').findOne({
                    _id: new ObjectId(storyId),
                    projectId: new ObjectId(projectId),
                });
                if (!doc) return { error: 'Story not found.' };
                return {
                    story: toStoryRow(doc as Record<string, unknown>),
                };
            },
        );
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        return { error: String(e) };
    }
}

// ---------------------------------------------------------------------------
//  Mutations
// ---------------------------------------------------------------------------

export async function createTelegramStoryActionWithFallback(
    body: StoryCreateBody,
): Promise<StoryAckResult> {
    try {
        return await withRustFallback(
            () => rustClient.telegramStories.create(body),
            async () => {
                const session = await getSession();
                if (!session?.user)
                    return { success: false, error: 'Not authenticated.' };
                if (!body.projectId || !ObjectId.isValid(body.projectId)) {
                    return { success: false, error: 'Invalid project id.' };
                }
                if (!body.botId || !ObjectId.isValid(body.botId)) {
                    return { success: false, error: 'Invalid bot id.' };
                }
                const { db } = await connectToDatabase();
                const now = new Date();
                const scheduledAt = body.scheduledAt
                    ? new Date(body.scheduledAt)
                    : undefined;
                const status = scheduledAt ? 'scheduled' : 'draft';
                const ins = await db.collection('telegram_stories').insertOne({
                    projectId: new ObjectId(body.projectId),
                    botId: new ObjectId(body.botId),
                    channelId:
                        body.channelId && ObjectId.isValid(body.channelId)
                            ? new ObjectId(body.channelId)
                            : undefined,
                    businessConnectionId: body.businessConnectionId,
                    type: body.type,
                    content: body.content,
                    privacy: body.privacy,
                    activePeriodSeconds: body.activePeriodSeconds,
                    postToChatPage: Boolean(body.postToChatPage),
                    protectContent: Boolean(body.protectContent),
                    status,
                    scheduledAt,
                    createdAt: now,
                    updatedAt: now,
                } as Record<string, unknown>);
                return { success: true, storyId: ins.insertedId.toString() };
            },
        );
    } catch (e) {
        if (e instanceof RustApiError)
            return { success: false, error: e.message };
        return { success: false, error: String(e) };
    }
}

export async function updateTelegramStoryActionWithFallback(
    storyId: string,
    body: StoryUpdateBody,
): Promise<StoryAckResult> {
    try {
        return await withRustFallback(
            () => rustClient.telegramStories.update(storyId, body),
            async () => {
                if (
                    !ObjectId.isValid(storyId) ||
                    !ObjectId.isValid(body.projectId)
                ) {
                    return { success: false, error: 'Invalid id.' };
                }
                const { db } = await connectToDatabase();
                const set: Record<string, unknown> = { updatedAt: new Date() };
                if (body.content !== undefined) set.content = body.content;
                if (body.privacy !== undefined) set.privacy = body.privacy;
                if (body.activePeriodSeconds !== undefined)
                    set.activePeriodSeconds = body.activePeriodSeconds;
                if (body.postToChatPage !== undefined)
                    set.postToChatPage = body.postToChatPage;
                if (body.protectContent !== undefined)
                    set.protectContent = body.protectContent;
                if (body.scheduledAt !== undefined) {
                    set.scheduledAt = new Date(body.scheduledAt);
                    set.status = 'scheduled';
                }
                const upd = await db
                    .collection('telegram_stories')
                    .updateOne(
                        {
                            _id: new ObjectId(storyId),
                            projectId: new ObjectId(body.projectId),
                        },
                        { $set: set },
                    );
                if (upd.matchedCount === 0) {
                    return { success: false, error: 'Story not found.' };
                }
                return { success: true, storyId };
            },
        );
    } catch (e) {
        if (e instanceof RustApiError)
            return { success: false, error: e.message };
        return { success: false, error: String(e) };
    }
}

export async function deleteTelegramStoryActionWithFallback(
    storyId: string,
    projectId: string,
): Promise<StoryAckResult> {
    try {
        return await withRustFallback(
            () => rustClient.telegramStories.delete(storyId, projectId),
            async () => {
                if (
                    !ObjectId.isValid(storyId) ||
                    !ObjectId.isValid(projectId)
                ) {
                    return { success: false, error: 'Invalid id.' };
                }
                const { db } = await connectToDatabase();
                const del = await db.collection('telegram_stories').deleteOne({
                    _id: new ObjectId(storyId),
                    projectId: new ObjectId(projectId),
                });
                if (del.deletedCount === 0) {
                    return { success: false, error: 'Story not found.' };
                }
                return { success: true, storyId };
            },
        );
    } catch (e) {
        if (e instanceof RustApiError)
            return { success: false, error: e.message };
        return { success: false, error: String(e) };
    }
}
