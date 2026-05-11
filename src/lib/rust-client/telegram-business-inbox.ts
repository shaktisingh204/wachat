/**
 * Client for the Telegram Business Inbox router on the Rust BFF.
 *
 * Mirrors routes registered under `/v1/telegram/business-inbox` by the
 * `telegram-business-inbox` Rust crate.
 *
 * Server-only.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/business-inbox';

// ---------------------------------------------------------------------------
//  Wire shapes
// ---------------------------------------------------------------------------

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    id?: string;
}

export type ThreadStatus = 'open' | 'pending' | 'snoozed' | 'resolved' | 'archived';
export type ThreadPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface InboxThread {
    _id: string;
    projectId: string;
    botId: string;
    chatId: string;
    type: string;
    title: string;
    status: ThreadStatus;
    priority: ThreadPriority;
    assignedAgentId?: string;
    tags: string[];
    firstResponseAt?: string;
    lastInboundAt?: string;
    lastOutboundAt?: string;
    lastAgentReplyAt?: string;
    slaDueAt?: string;
    snoozedUntil?: string;
    resolvedAt?: string;
    resolvedById?: string;
    internalNotesCount: number;
    unreadCount: number;
    lastMessagePreview?: string;
    lastMessageDirection?: 'inbound' | 'outbound';
    slaBreached: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface InboxMessage {
    _id: string;
    messageId: number;
    direction: 'inbound' | 'outbound';
    type: string;
    text?: string;
    caption?: string;
    fromUserId?: string;
    fromUsername?: string;
    replyToMessageId?: number;
    status: string;
    errorMessage?: string;
    createdAt: string;
}

export interface InboxNote {
    _id: string;
    threadId: string;
    authorId: string;
    body: string;
    mentions: string[];
    createdAt: string;
}

export interface ListThreadsQuery {
    projectId: string;
    botId?: string;
    status?: ThreadStatus | 'all';
    assignedAgentId?: string | 'unassigned' | 'anyone';
    tag?: string;
    priority?: ThreadPriority | 'all';
    search?: string;
    hasUnread?: boolean;
    page?: number;
    pageSize?: number;
}

export interface ListThreadsResp {
    threads: InboxThread[];
    total: number;
    hasMore: boolean;
    page: number;
    pageSize: number;
    openCount: number;
    pendingCount: number;
    snoozedCount: number;
    resolvedCount: number;
    breachedCount: number;
    error?: string;
}

export interface DetailResp {
    thread?: InboxThread;
    relatedThreads: InboxThread[];
    chat?: Record<string, unknown>;
    error?: string;
}

export interface ListMessagesResp {
    messages: InboxMessage[];
    nextCursor?: number;
    error?: string;
}

export interface ListNotesResp {
    notes: InboxNote[];
    nextCursor?: string;
    error?: string;
}

export interface AutoAssignMatch {
    botId?: string;
    chatType?: 'private' | 'group' | 'supergroup';
    hasTag?: string;
    keywordIn?: string[];
    languageCode?: string;
}

export interface AutoAssignAssign {
    kind: 'agent' | 'round_robin' | 'random' | 'least_loaded';
    agentIds?: string[];
}

export interface AutoAssignRule {
    _id: string;
    projectId: string;
    name: string;
    enabled: boolean;
    priority: number;
    match: AutoAssignMatch;
    assignTo: AutoAssignAssign;
    applyTags?: string[];
    setPriority?: ThreadPriority;
    setSlaSeconds?: number;
    createdAt: string;
    updatedAt: string;
}

export interface RuleBody {
    projectId: string;
    name: string;
    enabled?: boolean;
    priority?: number;
    match?: AutoAssignMatch;
    assignTo?: AutoAssignAssign;
    applyTags?: string[];
    setPriority?: ThreadPriority;
    setSlaSeconds?: number;
}

export interface SlaPolicy {
    _id: string;
    projectId: string;
    name: string;
    firstResponseSeconds: number;
    resolutionSeconds: number;
    businessHoursOnly: boolean;
    applyToTags?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface SlaBody {
    projectId: string;
    name: string;
    firstResponseSeconds: number;
    resolutionSeconds: number;
    businessHoursOnly?: boolean;
    applyToTags?: string[];
}

export interface AgentRow {
    _id: string;
    name: string;
    email?: string;
    openCount: number;
}

export interface AnalyticsResp {
    open: number;
    pending: number;
    snoozed: number;
    resolved: number;
    breached: number;
    total: number;
    avgFirstResponseSeconds: number;
    avgResolutionSeconds: number;
    slaBreachRate: number;
    byDay: Array<{ date: string; created: number; resolved: number; breached: number }>;
    leaderboard: Array<{ agentId: string; resolved: number; avgResponseSeconds: number }>;
    error?: string;
}

export interface BulkBody {
    projectId: string;
    ids: string[];
    action: 'assign' | 'status' | 'tag' | 'priority';
    payload: Record<string, unknown>;
}

export interface BulkResp {
    success: boolean;
    updated: number;
    error?: string;
    message?: string;
}

export interface UpsertThreadBody {
    projectId: string;
    botId: string;
    chatId: string;
    lastMessagePreview?: string;
    direction?: 'inbound' | 'outbound';
    hadUnread?: boolean;
}

export interface UpsertThreadResp {
    success: boolean;
    threadId?: string;
    created: boolean;
    error?: string;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? `?${parts.join('&')}` : '';
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const telegramBusinessInboxApi = {
    listThreads: (q: ListThreadsQuery) =>
        rustFetch<ListThreadsResp>(`${BASE}/threads${qs(q as Record<string, string | number | boolean | undefined>)}`),

    getThread: (id: string, projectId: string) =>
        rustFetch<DetailResp>(`${BASE}/threads/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`),

    assign: (id: string, body: { projectId: string; agentId?: string | null }) =>
        rustFetch<AckResult>(`${BASE}/threads/${encodeURIComponent(id)}/assign`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    setStatus: (id: string, body: { projectId: string; status: ThreadStatus; snoozedUntil?: string }) =>
        rustFetch<AckResult>(`${BASE}/threads/${encodeURIComponent(id)}/status`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    setTags: (id: string, body: { projectId: string; add?: string[]; remove?: string[] }) =>
        rustFetch<AckResult>(`${BASE}/threads/${encodeURIComponent(id)}/tags`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    setPriority: (id: string, body: { projectId: string; priority: ThreadPriority }) =>
        rustFetch<AckResult>(`${BASE}/threads/${encodeURIComponent(id)}/priority`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    markRead: (id: string, projectId: string) =>
        rustFetch<AckResult>(`${BASE}/threads/${encodeURIComponent(id)}/mark-read`, {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        }),

    messages: (id: string, projectId: string, opts?: { cursor?: number; limit?: number }) =>
        rustFetch<ListMessagesResp>(
            `${BASE}/threads/${encodeURIComponent(id)}/messages${qs({
                projectId,
                cursor: opts?.cursor,
                limit: opts?.limit,
            })}`,
        ),

    listNotes: (id: string, projectId: string, opts?: { cursor?: string; limit?: number }) =>
        rustFetch<ListNotesResp>(
            `${BASE}/threads/${encodeURIComponent(id)}/notes${qs({
                projectId,
                cursor: opts?.cursor,
                limit: opts?.limit,
            })}`,
        ),

    createNote: (id: string, body: { projectId: string; body: string; mentions?: string[] }) =>
        rustFetch<AckResult>(`${BASE}/threads/${encodeURIComponent(id)}/notes`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteNote: (id: string, noteId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/threads/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}?projectId=${encodeURIComponent(projectId)}`,
            { method: 'DELETE' },
        ),

    bulk: (body: BulkBody) =>
        rustFetch<BulkResp>(`${BASE}/threads/bulk`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // ----- Auto-assign -----
    listAutoAssign: (projectId: string) =>
        rustFetch<{ rules: AutoAssignRule[]; error?: string }>(
            `${BASE}/auto-assign?projectId=${encodeURIComponent(projectId)}`,
        ),
    createAutoAssign: (body: RuleBody) =>
        rustFetch<AckResult>(`${BASE}/auto-assign`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    updateAutoAssign: (id: string, body: RuleBody) =>
        rustFetch<AckResult>(`${BASE}/auto-assign/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    deleteAutoAssign: (id: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/auto-assign/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`,
            { method: 'DELETE' },
        ),
    reorderAutoAssign: (body: { projectId: string; ids: string[] }) =>
        rustFetch<AckResult>(`${BASE}/auto-assign/reorder`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // ----- SLA -----
    listSla: (projectId: string) =>
        rustFetch<{ policies: SlaPolicy[]; error?: string }>(
            `${BASE}/sla?projectId=${encodeURIComponent(projectId)}`,
        ),
    createSla: (body: SlaBody) =>
        rustFetch<AckResult>(`${BASE}/sla`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    updateSla: (id: string, body: SlaBody) =>
        rustFetch<AckResult>(`${BASE}/sla/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    deleteSla: (id: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/sla/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`,
            { method: 'DELETE' },
        ),
    slaEval: (projectId: string) =>
        rustFetch<{ success: boolean; evaluated: number; breached: number; error?: string }>(
            `${BASE}/sla/eval`,
            { method: 'POST', body: JSON.stringify({ projectId }) },
        ),

    // ----- Misc -----
    listAgents: (projectId: string) =>
        rustFetch<{ agents: AgentRow[]; error?: string }>(
            `${BASE}/agents?projectId=${encodeURIComponent(projectId)}`,
        ),

    analytics: (params: { projectId: string; from?: string; to?: string; agentId?: string }) =>
        rustFetch<AnalyticsResp>(`${BASE}/analytics${qs(params)}`),

    upsertFromMessage: (body: UpsertThreadBody) =>
        rustFetch<UpsertThreadResp>(`${BASE}/threads/upsert-from-message`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

export type TelegramBusinessInboxApi = typeof telegramBusinessInboxApi;
