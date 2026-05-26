'use server';

/**
 * Server actions for the Telegram Business Inbox dashboard page.
 *
 * Each method is a thin wrapper around the typed Rust client.
 * The client itself is `server-only` so the page imports through this
 * action layer.
 *
 * NOTE: `src/lib/rust-client/index.ts` is intentionally not modified,
 * so we import `telegramBusinessInboxApi` directly rather than via
 * `rustClient.telegramBusinessInbox`.
 *
 * LIST/READ actions are wrapped in {@link withRustFallback} so that
 * when the Rust BFF is missing on the deploy target (404 / 5xx), the
 * call falls back to direct Mongo reads against
 * `telegram_inbox_threads`, `telegram_inbox_notes`, `telegram_messages`,
 * `telegram_chats`, and `telegram_bots`. Mutations cannot be safely
 * faked — they return a graceful "backend not deployed" envelope.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter, type Document } from 'mongodb';

import { RustApiError } from '@/lib/rust-client';
import { telegramBusinessInboxApi } from '@/lib/rust-client/telegram-business-inbox';
import type {
    AnalyticsResp,
    BulkBody,
    DetailResp,
    InboxMessage,
    InboxNote,
    InboxThread,
    ListMessagesResp,
    ListNotesResp,
    ListThreadsQuery,
    ListThreadsResp,
    RuleBody,
    SlaBody,
    ThreadPriority,
    ThreadStatus,
    UpsertThreadBody,
    UpsertThreadResp,
} from '@/lib/rust-client/telegram-business-inbox';
import { connectToDatabase } from '@/lib/mongodb';
import { withRustFallback, isRustUnavailable } from '@/lib/telegram/rust-fallback';
import { getSession } from '@/app/actions/user.actions';
import { getProjectById } from '@/app/actions/project.actions';
import type { TelegramChat, TelegramMessage } from '@/lib/definitions';

const PAGE = '/dashboard/telegram/business-inbox';
const RUST_DOWN_ERROR = 'Telegram backend is not deployed yet — message not sent.';

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

function mutationFail(err: unknown): { success: false; error: string } {
    if (isRustUnavailable(err)) return fail(RUST_DOWN_ERROR);
    return fail(errMsg(err));
}

// ── Mongo → wire-shape mappers ─────────────────────────────────────

function asString(v: unknown): string | undefined {
    if (typeof v === 'string') return v;
    if (v instanceof ObjectId) return v.toHexString();
    return undefined;
}

function mapThreadDoc(d: Document): InboxThread | null {
    const id = d._id;
    if (!(id instanceof ObjectId)) return null;
    const projectId = asString(d.projectId);
    const botId = asString(d.botId);
    if (!projectId || !botId) return null;
    const slaDue = d.slaDueAt instanceof Date ? d.slaDueAt : undefined;
    const resolvedAt = d.resolvedAt instanceof Date ? d.resolvedAt : undefined;
    const breached = slaDue && !resolvedAt ? slaDue < new Date() : false;
    return {
        _id: id.toHexString(),
        projectId,
        botId,
        chatId: typeof d.chatId === 'string' ? d.chatId : '',
        type: typeof d.type === 'string' ? d.type : 'private',
        title: typeof d.title === 'string' ? d.title : '',
        status: (typeof d.status === 'string' ? d.status : 'open') as ThreadStatus,
        priority: (typeof d.priority === 'string' ? d.priority : 'normal') as ThreadPriority,
        assignedAgentId: typeof d.assignedAgentId === 'string' ? d.assignedAgentId : undefined,
        tags: Array.isArray(d.tags) ? (d.tags.filter((t) => typeof t === 'string') as string[]) : [],
        firstResponseAt: d.firstResponseAt instanceof Date ? d.firstResponseAt.toISOString() : undefined,
        lastInboundAt: d.lastInboundAt instanceof Date ? d.lastInboundAt.toISOString() : undefined,
        lastOutboundAt: d.lastOutboundAt instanceof Date ? d.lastOutboundAt.toISOString() : undefined,
        lastAgentReplyAt: d.lastAgentReplyAt instanceof Date ? d.lastAgentReplyAt.toISOString() : undefined,
        slaDueAt: slaDue?.toISOString(),
        snoozedUntil: d.snoozedUntil instanceof Date ? d.snoozedUntil.toISOString() : undefined,
        resolvedAt: resolvedAt?.toISOString(),
        resolvedById: typeof d.resolvedById === 'string' ? d.resolvedById : undefined,
        internalNotesCount:
            typeof d.internalNotesCount === 'number' ? d.internalNotesCount : 0,
        unreadCount: typeof d.unreadCount === 'number' ? d.unreadCount : 0,
        lastMessagePreview:
            typeof d.lastMessagePreview === 'string' ? d.lastMessagePreview : undefined,
        lastMessageDirection:
            d.lastMessageDirection === 'inbound' || d.lastMessageDirection === 'outbound'
                ? d.lastMessageDirection
                : undefined,
        slaBreached: typeof d.slaBreached === 'boolean' ? d.slaBreached : breached,
        createdAt: (d.createdAt instanceof Date ? d.createdAt : new Date()).toISOString(),
        updatedAt: (d.updatedAt instanceof Date ? d.updatedAt : new Date()).toISOString(),
    };
}

function mapMessageDoc(d: TelegramMessage & { _id: ObjectId }): InboxMessage {
    return {
        _id: d._id.toHexString(),
        messageId: d.messageId,
        direction: d.direction,
        type: d.type,
        text: d.text,
        caption: d.caption,
        fromUserId: d.fromUserId,
        fromUsername: d.fromUsername,
        replyToMessageId: d.replyToMessageId,
        status: d.status,
        errorMessage: d.errorMessage,
        createdAt: d.createdAt.toISOString(),
    };
}

function mapNoteDoc(d: Document): InboxNote | null {
    const id = d._id;
    if (!(id instanceof ObjectId)) return null;
    const threadId = asString(d.threadId);
    if (!threadId) return null;
    return {
        _id: id.toHexString(),
        threadId,
        authorId: asString(d.authorId) ?? '',
        body: typeof d.body === 'string' ? d.body : '',
        mentions: Array.isArray(d.mentions)
            ? (d.mentions.filter((m) => typeof m === 'string') as string[])
            : [],
        createdAt: (d.createdAt instanceof Date ? d.createdAt : new Date()).toISOString(),
    };
}

// ---------------------------------------------------------------------------
//  Reads
// ---------------------------------------------------------------------------

function emptyThreadsResp(error?: string): ListThreadsResp {
    return {
        threads: [],
        total: 0,
        hasMore: false,
        page: 1,
        pageSize: 30,
        openCount: 0,
        pendingCount: 0,
        snoozedCount: 0,
        resolvedCount: 0,
        breachedCount: 0,
        error,
    };
}

export async function listThreadsAction(query: ListThreadsQuery): Promise<ListThreadsResp> {
    return withRustFallback(
        async () => {
            try {
                return await telegramBusinessInboxApi.listThreads(query);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return emptyThreadsResp(errMsg(err));
            }
        },
        async () => {
            try {
                const session = await getSession();
                if (!session?.user) return emptyThreadsResp('Not authenticated.');
                if (!query.projectId || !ObjectId.isValid(query.projectId)) {
                    return emptyThreadsResp();
                }
                const project = await getProjectById(query.projectId);
                if (!project) return emptyThreadsResp('Access denied.');

                const { db } = await connectToDatabase();
                const baseFilter: Filter<Document> = { projectId: project._id };
                if (query.botId && ObjectId.isValid(query.botId)) {
                    baseFilter.botId = new ObjectId(query.botId);
                }
                if (query.tag) baseFilter.tags = query.tag;
                if (query.priority && query.priority !== 'all') {
                    baseFilter.priority = query.priority;
                }
                if (query.assignedAgentId === 'unassigned') {
                    baseFilter.assignedAgentId = { $in: [null, undefined] };
                } else if (
                    query.assignedAgentId &&
                    query.assignedAgentId !== 'anyone' &&
                    query.assignedAgentId !== 'unassigned'
                ) {
                    baseFilter.assignedAgentId = query.assignedAgentId;
                }
                if (query.hasUnread) {
                    baseFilter.unreadCount = { $gt: 0 };
                }
                if (query.search) {
                    const re = new RegExp(
                        query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                        'i',
                    );
                    baseFilter.$or = [
                        { title: re },
                        { lastMessagePreview: re },
                        { tags: re },
                    ];
                }

                const filter: Filter<Document> = { ...baseFilter };
                if (query.status && query.status !== 'all') {
                    filter.status = query.status;
                }

                const pageSize = Math.min(Math.max(query.pageSize ?? 30, 1), 200);
                const page = Math.max(query.page ?? 1, 1);
                const skip = (page - 1) * pageSize;

                const col = db.collection('telegram_inbox_threads');
                const [total, docs, openCount, pendingCount, snoozedCount, resolvedCount, breachedCount] =
                    await Promise.all([
                        col.countDocuments(filter),
                        col
                            .find(filter)
                            .sort({ updatedAt: -1 })
                            .skip(skip)
                            .limit(pageSize)
                            .toArray(),
                        col.countDocuments({ ...baseFilter, status: 'open' }),
                        col.countDocuments({ ...baseFilter, status: 'pending' }),
                        col.countDocuments({ ...baseFilter, status: 'snoozed' }),
                        col.countDocuments({ ...baseFilter, status: 'resolved' }),
                        col.countDocuments({ ...baseFilter, slaBreached: true }),
                    ]);

                const threads = docs
                    .map(mapThreadDoc)
                    .filter((t): t is InboxThread => t !== null);

                return {
                    threads,
                    total,
                    hasMore: skip + docs.length < total,
                    page,
                    pageSize,
                    openCount,
                    pendingCount,
                    snoozedCount,
                    resolvedCount,
                    breachedCount,
                };
            } catch (err) {
                return emptyThreadsResp(errMsg(err));
            }
        },
    );
}

export async function getThreadAction(
    threadId: string,
    projectId: string,
): Promise<DetailResp> {
    return withRustFallback(
        async () => {
            try {
                return await telegramBusinessInboxApi.getThread(threadId, projectId);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return { relatedThreads: [], error: errMsg(err) };
            }
        },
        async () => {
            try {
                if (!ObjectId.isValid(threadId)) return { relatedThreads: [] };
                const session = await getSession();
                if (!session?.user) {
                    return { relatedThreads: [], error: 'Not authenticated.' };
                }
                const project = await getProjectById(projectId);
                if (!project) return { relatedThreads: [], error: 'Access denied.' };
                const { db } = await connectToDatabase();

                const threadDoc = await db
                    .collection('telegram_inbox_threads')
                    .findOne({ _id: new ObjectId(threadId), projectId: project._id });
                if (!threadDoc) return { relatedThreads: [] };
                const thread = mapThreadDoc(threadDoc);
                if (!thread) return { relatedThreads: [] };

                const chat = await db
                    .collection<TelegramChat>('telegram_chats')
                    .findOne({
                        projectId: project._id,
                        chatId: thread.chatId,
                    });

                return {
                    thread,
                    relatedThreads: [],
                    chat: chat ? (JSON.parse(JSON.stringify(chat)) as Record<string, unknown>) : undefined,
                };
            } catch (err) {
                return { relatedThreads: [], error: errMsg(err) };
            }
        },
    );
}

export async function listMessagesAction(
    threadId: string,
    projectId: string,
    opts?: { cursor?: number; limit?: number },
): Promise<ListMessagesResp> {
    return withRustFallback(
        async () => {
            try {
                return await telegramBusinessInboxApi.messages(threadId, projectId, opts);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return { messages: [], error: errMsg(err) };
            }
        },
        async () => {
            try {
                if (!ObjectId.isValid(threadId)) return { messages: [] };
                const session = await getSession();
                if (!session?.user) {
                    return { messages: [], error: 'Not authenticated.' };
                }
                const project = await getProjectById(projectId);
                if (!project) return { messages: [], error: 'Access denied.' };
                const { db } = await connectToDatabase();

                const threadDoc = await db
                    .collection('telegram_inbox_threads')
                    .findOne({ _id: new ObjectId(threadId), projectId: project._id });
                if (!threadDoc) return { messages: [] };
                const botId = threadDoc.botId;
                const chatId = typeof threadDoc.chatId === 'string' ? threadDoc.chatId : '';
                if (!(botId instanceof ObjectId) || !chatId) return { messages: [] };

                const filter: Filter<TelegramMessage> = { botId, chatId };
                if (opts?.cursor) {
                    filter.messageId = { $lt: opts.cursor };
                }

                const limit = Math.min(opts?.limit ?? 50, 200);
                const docs = await db
                    .collection<TelegramMessage>('telegram_messages')
                    .find(filter)
                    .sort({ messageId: -1 })
                    .limit(limit + 1)
                    .toArray();

                const hasMore = docs.length > limit;
                const slice = hasMore ? docs.slice(0, limit) : docs;
                const ordered = slice.slice().reverse();
                const nextCursor = hasMore ? slice[slice.length - 1]?.messageId : undefined;

                return {
                    messages: ordered.map(mapMessageDoc),
                    nextCursor,
                };
            } catch (err) {
                return { messages: [], error: errMsg(err) };
            }
        },
    );
}

export async function listNotesAction(
    threadId: string,
    projectId: string,
    opts?: { cursor?: string; limit?: number },
): Promise<ListNotesResp> {
    return withRustFallback(
        async () => {
            try {
                return await telegramBusinessInboxApi.listNotes(threadId, projectId, opts);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return { notes: [], error: errMsg(err) };
            }
        },
        async () => {
            try {
                if (!ObjectId.isValid(threadId)) return { notes: [] };
                const session = await getSession();
                if (!session?.user) {
                    return { notes: [], error: 'Not authenticated.' };
                }
                const project = await getProjectById(projectId);
                if (!project) return { notes: [], error: 'Access denied.' };
                const { db } = await connectToDatabase();

                // Confirm the thread belongs to this project before exposing notes.
                const threadExists = await db
                    .collection('telegram_inbox_threads')
                    .findOne(
                        { _id: new ObjectId(threadId), projectId: project._id },
                        { projection: { _id: 1 } },
                    );
                if (!threadExists) return { notes: [] };

                const filter: Filter<Document> = { threadId: new ObjectId(threadId) };
                if (opts?.cursor && ObjectId.isValid(opts.cursor)) {
                    filter._id = { $lt: new ObjectId(opts.cursor) };
                }
                const limit = Math.min(opts?.limit ?? 50, 200);
                const docs = await db
                    .collection('telegram_inbox_notes')
                    .find(filter)
                    .sort({ _id: -1 })
                    .limit(limit + 1)
                    .toArray();

                const hasMore = docs.length > limit;
                const slice = hasMore ? docs.slice(0, limit) : docs;
                const notes = slice
                    .map(mapNoteDoc)
                    .filter((n): n is InboxNote => n !== null);
                const last = slice[slice.length - 1];
                const nextCursor =
                    hasMore && last?._id instanceof ObjectId
                        ? last._id.toHexString()
                        : undefined;

                return { notes, nextCursor };
            } catch (err) {
                return { notes: [], error: errMsg(err) };
            }
        },
    );
}

export async function listAutoAssignAction(projectId: string) {
    return withRustFallback(
        async () => {
            try {
                return await telegramBusinessInboxApi.listAutoAssign(projectId);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return { rules: [], error: errMsg(err) };
            }
        },
        async () => {
            try {
                if (!ObjectId.isValid(projectId)) return { rules: [] };
                const project = await getProjectById(projectId);
                if (!project) return { rules: [], error: 'Access denied.' };
                const { db } = await connectToDatabase();
                const docs = await db
                    .collection('telegram_inbox_auto_assign_rules')
                    .find({ projectId: project._id })
                    .sort({ priority: 1, _id: 1 })
                    .toArray();
                return {
                    rules: docs.map((d) => JSON.parse(JSON.stringify(d))),
                };
            } catch (err) {
                return { rules: [], error: errMsg(err) };
            }
        },
    );
}

export async function listSlaAction(projectId: string) {
    return withRustFallback(
        async () => {
            try {
                return await telegramBusinessInboxApi.listSla(projectId);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return { policies: [], error: errMsg(err) };
            }
        },
        async () => {
            try {
                if (!ObjectId.isValid(projectId)) return { policies: [] };
                const project = await getProjectById(projectId);
                if (!project) return { policies: [], error: 'Access denied.' };
                const { db } = await connectToDatabase();
                const docs = await db
                    .collection('telegram_inbox_sla_policies')
                    .find({ projectId: project._id })
                    .sort({ _id: 1 })
                    .toArray();
                return {
                    policies: docs.map((d) => JSON.parse(JSON.stringify(d))),
                };
            } catch (err) {
                return { policies: [], error: errMsg(err) };
            }
        },
    );
}

export async function listAgentsAction(projectId: string) {
    return withRustFallback(
        async () => {
            try {
                return await telegramBusinessInboxApi.listAgents(projectId);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return { agents: [], error: errMsg(err) };
            }
        },
        async () => {
            // No legacy Mongo source for inbox agents — degrade silently.
            return { agents: [] };
        },
    );
}

function emptyAnalyticsResp(error?: string): AnalyticsResp {
    return {
        open: 0,
        pending: 0,
        snoozed: 0,
        resolved: 0,
        breached: 0,
        total: 0,
        avgFirstResponseSeconds: 0,
        avgResolutionSeconds: 0,
        slaBreachRate: 0,
        byDay: [],
        leaderboard: [],
        error,
    };
}

export async function analyticsAction(params: {
    projectId: string;
    from?: string;
    to?: string;
    agentId?: string;
}): Promise<AnalyticsResp> {
    return withRustFallback(
        async () => {
            try {
                return await telegramBusinessInboxApi.analytics(params);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return emptyAnalyticsResp(errMsg(err));
            }
        },
        async () => {
            try {
                if (!ObjectId.isValid(params.projectId)) return emptyAnalyticsResp();
                const project = await getProjectById(params.projectId);
                if (!project) return emptyAnalyticsResp('Access denied.');
                const { db } = await connectToDatabase();
                const col = db.collection('telegram_inbox_threads');
                const base: Filter<Document> = { projectId: project._id };
                if (params.agentId) base.assignedAgentId = params.agentId;

                const [open, pending, snoozed, resolved, breached, total] = await Promise.all([
                    col.countDocuments({ ...base, status: 'open' }),
                    col.countDocuments({ ...base, status: 'pending' }),
                    col.countDocuments({ ...base, status: 'snoozed' }),
                    col.countDocuments({ ...base, status: 'resolved' }),
                    col.countDocuments({ ...base, slaBreached: true }),
                    col.countDocuments(base),
                ]);

                return {
                    ...emptyAnalyticsResp(),
                    open,
                    pending,
                    snoozed,
                    resolved,
                    breached,
                    total,
                    slaBreachRate: total > 0 ? breached / total : 0,
                };
            } catch (err) {
                return emptyAnalyticsResp(errMsg(err));
            }
        },
    );
}

// ---------------------------------------------------------------------------
//  Thread mutations
// ---------------------------------------------------------------------------

export async function assignThreadAction(
    threadId: string,
    projectId: string,
    agentId: string | null,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.assign(threadId, {
            projectId,
            agentId: agentId ?? undefined,
        });
        if (!res.success) return fail(res.error ?? 'Failed to assign.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function setThreadStatusAction(
    threadId: string,
    projectId: string,
    status: ThreadStatus,
    snoozedUntil?: string,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.setStatus(threadId, {
            projectId,
            status,
            snoozedUntil,
        });
        if (!res.success) return fail(res.error ?? 'Failed to set status.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function setThreadTagsAction(
    threadId: string,
    projectId: string,
    add?: string[],
    remove?: string[],
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.setTags(threadId, {
            projectId,
            add,
            remove,
        });
        if (!res.success) return fail(res.error ?? 'Failed to update tags.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function setThreadPriorityAction(
    threadId: string,
    projectId: string,
    priority: ThreadPriority,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.setPriority(threadId, {
            projectId,
            priority,
        });
        if (!res.success) return fail(res.error ?? 'Failed to update priority.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function markThreadReadAction(
    threadId: string,
    projectId: string,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.markRead(threadId, projectId);
        if (!res.success) return fail(res.error ?? 'Failed to mark read.');
        return { success: true, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function bulkThreadsAction(
    body: BulkBody,
): Promise<ActionEnvelope<{ updated: number; message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.bulk(body);
        if (!res.success) return fail(res.error ?? 'Bulk action failed.');
        revalidatePath(PAGE);
        return { success: true, updated: res.updated, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

// ---------------------------------------------------------------------------
//  Notes
// ---------------------------------------------------------------------------

export async function createNoteAction(
    threadId: string,
    projectId: string,
    body: string,
    mentions?: string[],
): Promise<ActionEnvelope<{ id?: string; message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.createNote(threadId, {
            projectId,
            body,
            mentions,
        });
        if (!res.success) return fail(res.error ?? 'Failed to add note.');
        revalidatePath(PAGE);
        return { success: true, id: res.id, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function deleteNoteAction(
    threadId: string,
    noteId: string,
    projectId: string,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.deleteNote(threadId, noteId, projectId);
        if (!res.success) return fail(res.error ?? 'Failed to delete note.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

// ---------------------------------------------------------------------------
//  Auto-assign rules
// ---------------------------------------------------------------------------

export async function createAutoAssignAction(
    body: RuleBody,
): Promise<ActionEnvelope<{ id?: string; message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.createAutoAssign(body);
        if (!res.success) return fail(res.error ?? 'Failed to create rule.');
        revalidatePath(PAGE);
        return { success: true, id: res.id, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function updateAutoAssignAction(
    id: string,
    body: RuleBody,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.updateAutoAssign(id, body);
        if (!res.success) return fail(res.error ?? 'Failed to update rule.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function deleteAutoAssignAction(
    id: string,
    projectId: string,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.deleteAutoAssign(id, projectId);
        if (!res.success) return fail(res.error ?? 'Failed to delete rule.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function reorderAutoAssignAction(
    projectId: string,
    ids: string[],
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.reorderAutoAssign({ projectId, ids });
        if (!res.success) return fail(res.error ?? 'Failed to reorder.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

// ---------------------------------------------------------------------------
//  SLA policies
// ---------------------------------------------------------------------------

export async function createSlaAction(
    body: SlaBody,
): Promise<ActionEnvelope<{ id?: string; message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.createSla(body);
        if (!res.success) return fail(res.error ?? 'Failed to create SLA.');
        revalidatePath(PAGE);
        return { success: true, id: res.id, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function updateSlaAction(
    id: string,
    body: SlaBody,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.updateSla(id, body);
        if (!res.success) return fail(res.error ?? 'Failed to update SLA.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function deleteSlaAction(
    id: string,
    projectId: string,
): Promise<ActionEnvelope<{ message?: string }>> {
    try {
        const res = await telegramBusinessInboxApi.deleteSla(id, projectId);
        if (!res.success) return fail(res.error ?? 'Failed to delete SLA.');
        revalidatePath(PAGE);
        return { success: true, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

export async function slaEvalAction(
    projectId: string,
): Promise<ActionEnvelope<{ evaluated: number; breached: number }>> {
    try {
        const res = await telegramBusinessInboxApi.slaEval(projectId);
        if (!res.success) return fail(res.error ?? 'SLA evaluation failed.');
        return { success: true, evaluated: res.evaluated, breached: res.breached };
    } catch (err) {
        return mutationFail(err);
    }
}

// ---------------------------------------------------------------------------
//  Composer (send via telegram-chats)
// ---------------------------------------------------------------------------

/**
 * Forwards to the existing `telegram-chats` send-text endpoint. The
 * business inbox does NOT own message sending — it composes on top of
 * the chat router so the message is persisted via the same path as the
 * legacy chat inbox.
 */
export async function sendMessageAction(
    botId: string,
    chatId: string,
    text: string,
    replyToMessageId?: number,
): Promise<ActionEnvelope<{ messageId?: number; message?: string }>> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const res = await rustClient.telegramChats.sendText(botId, chatId, {
            text,
            replyToMessageId,
        });
        if (!res.success) return fail(res.error ?? 'Failed to send.');
        revalidatePath(PAGE);
        return { success: true, messageId: res.messageId, message: res.message };
    } catch (err) {
        return mutationFail(err);
    }
}

// ---------------------------------------------------------------------------
//  Webhook entrypoint (internal — for the Telegram webhook handler)
// ---------------------------------------------------------------------------

export async function upsertThreadFromMessageAction(
    body: UpsertThreadBody,
): Promise<UpsertThreadResp> {
    try {
        return await telegramBusinessInboxApi.upsertFromMessage(body);
    } catch (err) {
        if (isRustUnavailable(err)) {
            return { success: false, created: false, error: RUST_DOWN_ERROR };
        }
        return { success: false, created: false, error: errMsg(err) };
    }
}

// Re-export common types for the page.
