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
 */

import { revalidatePath } from 'next/cache';

import { RustApiError } from '@/lib/rust-client';
import { telegramBusinessInboxApi } from '@/lib/rust-client/telegram-business-inbox';
import type {
    AnalyticsResp,
    BulkBody,
    DetailResp,
    InboxMessage,
    InboxNote,
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

const PAGE = '/dashboard/telegram/business-inbox';

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

export async function listThreadsAction(query: ListThreadsQuery): Promise<ListThreadsResp> {
    try {
        return await telegramBusinessInboxApi.listThreads(query);
    } catch (err) {
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
            error: errMsg(err),
        };
    }
}

export async function getThreadAction(
    threadId: string,
    projectId: string,
): Promise<DetailResp> {
    try {
        return await telegramBusinessInboxApi.getThread(threadId, projectId);
    } catch (err) {
        return { relatedThreads: [], error: errMsg(err) };
    }
}

export async function listMessagesAction(
    threadId: string,
    projectId: string,
    opts?: { cursor?: number; limit?: number },
): Promise<ListMessagesResp> {
    try {
        return await telegramBusinessInboxApi.messages(threadId, projectId, opts);
    } catch (err) {
        return { messages: [], error: errMsg(err) };
    }
}

export async function listNotesAction(
    threadId: string,
    projectId: string,
    opts?: { cursor?: string; limit?: number },
): Promise<ListNotesResp> {
    try {
        return await telegramBusinessInboxApi.listNotes(threadId, projectId, opts);
    } catch (err) {
        return { notes: [], error: errMsg(err) };
    }
}

export async function listAutoAssignAction(projectId: string) {
    try {
        return await telegramBusinessInboxApi.listAutoAssign(projectId);
    } catch (err) {
        return { rules: [], error: errMsg(err) };
    }
}

export async function listSlaAction(projectId: string) {
    try {
        return await telegramBusinessInboxApi.listSla(projectId);
    } catch (err) {
        return { policies: [], error: errMsg(err) };
    }
}

export async function listAgentsAction(projectId: string) {
    try {
        return await telegramBusinessInboxApi.listAgents(projectId);
    } catch (err) {
        return { agents: [], error: errMsg(err) };
    }
}

export async function analyticsAction(params: {
    projectId: string;
    from?: string;
    to?: string;
    agentId?: string;
}): Promise<AnalyticsResp> {
    try {
        return await telegramBusinessInboxApi.analytics(params);
    } catch (err) {
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
            error: errMsg(err),
        };
    }
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return fail(errMsg(err));
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
        return { success: false, created: false, error: errMsg(err) };
    }
}

// Re-export common types for the page.
export type { InboxMessage, InboxNote };
