/**
 * Client for the Wachat **features** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/features` by the Phase 6
 * `wachat-features` crate (umbrella crate with `chat`, `messaging`,
 * `contacts`, `analytics`, `profile`, `media`, `misc` submodules — see
 * `rust/crates/wachat-features/src/lib.rs`).
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/features';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enc(s: string): string {
    return encodeURIComponent(s);
}

function get<T>(path: string): Promise<T> {
    return rustFetch<T>(`${BASE}${path}`);
}

function post<T>(path: string, body?: unknown): Promise<T> {
    return rustFetch<T>(`${BASE}${path}`, {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

function del<T>(path: string): Promise<T> {
    return rustFetch<T>(`${BASE}${path}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Generic envelopes used by many endpoints
// ---------------------------------------------------------------------------

export interface OkEnvelope { success: boolean; }
export interface MessageEnvelope { message: string; }

// ---------------------------------------------------------------------------
// Wave D additions — message-tag write verbs + analytics, link-click clear.
// Shapes mirror `rust/crates/wachat-features/src/messaging/tags.rs` and
// `.../analytics/link_clicks.rs` exactly (every handler DTO is
// `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/** Body for `PATCH /message-tags/{tagId}` — at least one field required. */
export interface UpdateMessageTagBody {
    name?: string;
    color?: string;
}

/** Body for `POST /projects/{projectId}/message-tags/bulk-apply`. */
export interface BulkApplyMessageTagBody {
    /** Tag to stamp (hex ObjectId string). */
    tagId: string;
    /** Only conversations assigned to this agent (hex ObjectId string). */
    assignedAgent?: string;
    /** Only conversations with at least one unread message. */
    unreadOnly?: boolean;
}

/** Result of the bulk-apply handler (`BulkApplyResp`). */
export interface BulkApplyMessageTagResponse {
    success: boolean;
    /** Conversations that gained the tag. */
    modifiedCount: number;
    /** Conversations that matched the criteria. */
    matchedCount: number;
}

/** One daily-usage bucket from the tag-analytics aggregation. */
export interface MessageTagAnalyticsDay {
    /** Calendar day, "YYYY-MM-DD". */
    _id: string;
    /** Tagged messages on that day. */
    count: number;
}

/** Result of `GET /projects/{projectId}/message-tags/{tagId}/analytics`. */
export interface MessageTagAnalyticsResponse {
    /** Ascending by date. */
    dailyUsage: MessageTagAnalyticsDay[];
    /** Total tagged messages over the window. */
    total: number;
}

/** Result of `DELETE /projects/{projectId}/analytics/link-clicks` (`ClearResp`). */
export interface ClearLinkClicksResponse {
    success: boolean;
    /** Number of link-click rows removed. */
    deletedCount: number;
}

// ---------------------------------------------------------------------------
// Public namespace, grouped by domain
// ---------------------------------------------------------------------------

export const wachatFeaturesApi = {
    // ---- chat: labels ------------------------------------------------------
    getChatLabels: (projectId: string) =>
        get<{ labels: any[] }>(`/projects/${enc(projectId)}/chat-labels`),
    saveChatLabel: (projectId: string, name: string, color?: string) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/chat-labels`, { name, color }),
    deleteChatLabel: (labelId: string) =>
        del<OkEnvelope>(`/chat-labels/${enc(labelId)}`),
    assignLabelToContact: (contactId: string, labelId: string) =>
        post<OkEnvelope>(`/contacts/${enc(contactId)}/labels/${enc(labelId)}`),

    // ---- chat: notes -------------------------------------------------------
    getContactNotes: (contactId: string) =>
        get<{ notes: any[] }>(`/contacts/${enc(contactId)}/notes`),
    addContactNote: (contactId: string, text: string, projectId?: string) =>
        post<MessageEnvelope>(`/contacts/${enc(contactId)}/notes`, { text, projectId }),
    deleteContactNote: (noteId: string) =>
        del<OkEnvelope>(`/notes/${enc(noteId)}`),

    // ---- chat: ratings -----------------------------------------------------
    getChatRatings: (projectId: string) =>
        get<{ ratings: any[]; summary: any }>(`/projects/${enc(projectId)}/chat-ratings`),
    submitChatRating: (
        projectId: string,
        contactId: string,
        rating: number,
        feedback?: string,
    ) =>
        post<OkEnvelope>(`/projects/${enc(projectId)}/chat-ratings/submit`, {
            contactId,
            rating,
            feedback,
        }),

    // ---- chat: search/timeline/transfer/assignment ------------------------
    searchConversations: (projectId: string, query: string) =>
        get<{ messages: any[] }>(
            `/projects/${enc(projectId)}/conversation-search?q=${enc(query)}`,
        ),
    getContactTimeline: (projectId: string, contactId: string) =>
        get<{ events: any[] }>(
            `/projects/${enc(projectId)}/contact-timeline/${enc(contactId)}`,
        ),
    transferConversation: (
        contactId: string,
        fromAgentId: string,
        toAgentId: string,
        note?: string,
    ) =>
        post<OkEnvelope>(`/contacts/${enc(contactId)}/transfer`, {
            fromAgentId,
            toAgentId,
            note,
        }),
    getTransferHistory: (projectId: string) =>
        get<{ history: any[] }>(`/projects/${enc(projectId)}/transfer-history`),
    getUnassignedConversations: (projectId: string) =>
        get<{ contacts: any[] }>(`/projects/${enc(projectId)}/unassigned`),
    assignConversation: (contactId: string, agentId: string) =>
        post<OkEnvelope>(`/contacts/${enc(contactId)}/assign`, { agentId }),
    getAgentStatuses: (projectId: string) =>
        get<{ agents: any[] }>(`/projects/${enc(projectId)}/agents/statuses`),
    setAgentStatus: (agentId: string, status: string) =>
        post<OkEnvelope>(`/agents/${enc(agentId)}/status`, { status }),

    // ---- chat: history export ---------------------------------------------
    exportChatHistory: (projectId: string, contactId: string) =>
        get<{ messages: any[] }>(
            `/projects/${enc(projectId)}/contacts/${enc(contactId)}/export`,
        ),

    // ---- messaging: scheduled messages ------------------------------------
    getScheduledMessages: (projectId: string) =>
        get<{ messages: any[] }>(`/projects/${enc(projectId)}/scheduled-messages`),
    scheduleMessage: (
        projectId: string,
        recipientPhone: string,
        messageText: string,
        scheduledAt: string,
    ) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/scheduled-messages`, {
            recipientPhone,
            messageText,
            scheduledAt,
        }),
    cancelScheduledMessage: (messageId: string) =>
        post<OkEnvelope>(`/scheduled-messages/${enc(messageId)}/cancel`),

    // ---- messaging: scheduled broadcasts ----------------------------------
    getScheduledBroadcasts: (projectId: string) =>
        get<{ schedules: any[] }>(`/projects/${enc(projectId)}/scheduled-broadcasts`),
    scheduleBroadcast: (
        projectId: string,
        body: {
            name: string;
            templateName: string;
            audience?: string;
            scheduledAt: string;
            timezone?: string;
            recurring?: string;
        },
    ) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/scheduled-broadcasts`, body),
    cancelScheduledBroadcast: (scheduleId: string) =>
        post<OkEnvelope>(`/scheduled-broadcasts/${enc(scheduleId)}/cancel`),

    // ---- messaging: auto-reply rules --------------------------------------
    getAutoReplyRules: (projectId: string) =>
        get<{ rules: any[] }>(`/projects/${enc(projectId)}/auto-reply-rules`),
    saveAutoReplyRule: (projectId: string, body: {
        ruleId?: string;
        name: string;
        keywords: string;
        matchType?: string;
        responseType?: string;
        responseText?: string;
        templateName?: string;
        isActive?: boolean;
        timeFrom?: string;
        timeTo?: string;
    }) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/auto-reply-rules`, body),
    deleteAutoReplyRule: (ruleId: string) =>
        del<OkEnvelope>(`/auto-reply-rules/${enc(ruleId)}`),

    // ---- messaging: chatbot ----------------------------------------------
    getChatbotResponses: (projectId: string) =>
        get<{ responses: any[] }>(`/projects/${enc(projectId)}/chatbot-responses`),
    saveChatbotResponse: (projectId: string, body: {
        responseId?: string;
        trigger: string;
        response: string;
        matchType?: string;
        isActive?: boolean;
    }) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/chatbot-responses`, body),
    deleteChatbotResponse: (responseId: string) =>
        del<OkEnvelope>(`/chatbot-responses/${enc(responseId)}`),

    // ---- messaging: saved replies -----------------------------------------
    getSavedReplies: (projectId: string) =>
        get<{ replies: any[] }>(`/projects/${enc(projectId)}/saved-replies`),
    saveSavedReply: (projectId: string, body: {
        replyId?: string;
        shortcut: string;
        title?: string;
        body: string;
        category?: string;
        mediaUrl?: string;
    }) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/saved-replies`, body),
    deleteSavedReply: (replyId: string) =>
        del<OkEnvelope>(`/saved-replies/${enc(replyId)}`),

    // ---- messaging: quick-reply categories --------------------------------
    getQuickReplyCategories: (projectId: string) =>
        get<{ categories: any[] }>(`/projects/${enc(projectId)}/quick-reply-categories`),
    saveQuickReplyCategory: (projectId: string, body: { categoryId?: string; name: string; parentId?: string | null }) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/quick-reply-categories`, body),
    deleteQuickReplyCategory: (categoryId: string) =>
        del<OkEnvelope>(`/quick-reply-categories/${enc(categoryId)}`),

    // ---- messaging: tags --------------------------------------------------
    getMessageTags: (projectId: string) =>
        get<{ tags: any[] }>(`/projects/${enc(projectId)}/message-tags`),
    saveMessageTag: (projectId: string, name: string, color: string) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/message-tags`, { name, color }),
    deleteMessageTag: (tagId: string) =>
        del<OkEnvelope>(`/message-tags/${enc(tagId)}`),

    // ---- messaging: bulk send --------------------------------------------
    sendBulkMessages: (projectId: string, phones: string[], message: string) =>
        post<{ success: number; failed: number; total: number }>(
            `/projects/${enc(projectId)}/bulk-send`,
            { phones, message },
        ),

    // ---- contacts: groups -------------------------------------------------
    getContactGroups: (projectId: string) =>
        get<{ groups: any[] }>(`/projects/${enc(projectId)}/contact-groups`),
    saveContactGroup: (projectId: string, name: string, description?: string) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/contact-groups`, { name, description }),
    deleteContactGroup: (groupId: string) =>
        del<OkEnvelope>(`/contact-groups/${enc(groupId)}`),

    // ---- contacts: opt-out ------------------------------------------------
    getOptOutList: (projectId: string) =>
        get<{ optOuts: any[] }>(`/projects/${enc(projectId)}/opt-out`),
    addToOptOut: (projectId: string, phone: string, reason?: string) =>
        post<OkEnvelope>(`/projects/${enc(projectId)}/opt-out`, { phone, reason }),
    removeFromOptOut: (optOutId: string) =>
        del<OkEnvelope>(`/opt-out/${enc(optOutId)}`),

    // ---- contacts: blocked -----------------------------------------------
    getBlockedContacts: (projectId: string) =>
        get<{ contacts: any[] }>(`/projects/${enc(projectId)}/blocked-contacts`),
    blockContact: (projectId: string, phone: string, reason?: string) =>
        post<OkEnvelope>(`/projects/${enc(projectId)}/blocked-contacts`, { phone, reason }),
    unblockContact: (blockedId: string) =>
        del<OkEnvelope>(`/blocked-contacts/${enc(blockedId)}`),

    // ---- contacts: blacklist ---------------------------------------------
    getBlacklist: (projectId: string) =>
        get<{ numbers: any[] }>(`/projects/${enc(projectId)}/blacklist`),
    addToBlacklist: (projectId: string, phone: string) =>
        post<OkEnvelope>(`/projects/${enc(projectId)}/blacklist`, { phone }),
    bulkAddToBlacklist: (projectId: string, phones: string[]) =>
        post<{ success: boolean; count: number }>(
            `/projects/${enc(projectId)}/blacklist/bulk`,
            { phones },
        ),
    removeFromBlacklist: (blacklistId: string) =>
        del<OkEnvelope>(`/blacklist/${enc(blacklistId)}`),

    // ---- contacts: tags --------------------------------------------------
    getConversationTags: (projectId: string) =>
        get<{ tags: string[] }>(`/projects/${enc(projectId)}/conversation-tags`),

    // ---- contacts: broadcast segments -----------------------------------
    getBroadcastSegments: (projectId: string) =>
        get<{ segments: any[] }>(`/projects/${enc(projectId)}/broadcast-segments`),
    saveBroadcastSegment: (projectId: string, body: {
        name: string;
        filterTags?: string;
        filterLastActive?: string;
        filterCity?: string;
    }) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/broadcast-segments`, body),
    deleteBroadcastSegment: (segmentId: string) =>
        del<OkEnvelope>(`/broadcast-segments/${enc(segmentId)}`),

    // ---- analytics ------------------------------------------------------
    getTemplateAnalytics: (projectId: string) =>
        get<{ analytics: any[] }>(`/projects/${enc(projectId)}/analytics/templates`),
    getMessageAnalytics: (projectId: string, days = 7) =>
        get<{ dailyData: any[]; responseMetrics: any }>(
            `/projects/${enc(projectId)}/analytics/messages?days=${days}`,
        ),
    getAgentPerformance: (projectId: string, days = 30) =>
        get<{ performance: any[] }>(`/projects/${enc(projectId)}/analytics/agents?days=${days}`),
    getDeliveryReport: (projectId: string, days = 7) =>
        get<{ stats: any[]; failedMessages: any[] }>(
            `/projects/${enc(projectId)}/analytics/delivery?days=${days}`,
        ),
    getMessageStatistics: (projectId: string, period: string) =>
        get<{ stats: { total: number; incoming: number; outgoing: number; media: number } }>(
            `/projects/${enc(projectId)}/analytics/statistics?period=${enc(period)}`,
        ),
    getCreditUsage: (projectId: string) =>
        get<{ credits: number; dailyUsage: any[] }>(
            `/projects/${enc(projectId)}/analytics/credits`,
        ),
    getLinkClicks: (projectId: string) =>
        get<{ clicks: any[] }>(`/projects/${enc(projectId)}/analytics/link-clicks`),

    // ---- profile -------------------------------------------------------
    getBusinessHours: (projectId: string) =>
        get<{ hours: any | null }>(`/projects/${enc(projectId)}/business-hours`),
    saveBusinessHours: (projectId: string, body: {
        timezone?: string;
        offlineMessage?: string;
        schedule?: unknown;
        holidays?: unknown;
    }) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/business-hours`, body),

    getGreetingMessage: (projectId: string) =>
        get<{ config: { enabled: boolean; message: string } }>(
            `/projects/${enc(projectId)}/greeting`,
        ),
    saveGreetingMessage: (projectId: string, enabled: boolean, message: string) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/greeting`, { enabled, message }),

    getAwayMessage: (projectId: string) =>
        get<{ config: { enabled: boolean; message: string; schedule: string; timeFrom?: string; timeTo?: string } }>(
            `/projects/${enc(projectId)}/away`,
        ),
    saveAwayMessage: (
        projectId: string,
        enabled: boolean,
        message: string,
        schedule: string,
        timeFrom?: string,
        timeTo?: string,
    ) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/away`, {
            enabled,
            message,
            schedule,
            timeFrom,
            timeTo,
        }),

    getNotificationPreferences: (projectId: string) =>
        get<{ prefs: any | null }>(`/projects/${enc(projectId)}/notification-preferences`),
    saveNotificationPreferences: (projectId: string, prefs: Record<string, boolean>) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/notification-preferences`, prefs),

    getPhoneNumberProfiles: (projectId: string) =>
        get<{ phoneNumbers: any[] }>(`/projects/${enc(projectId)}/phone-numbers`),
    updatePhoneProfile: (projectId: string, phoneNumberId: string, profile: Record<string, any>) =>
        post<MessageEnvelope>(
            `/projects/${enc(projectId)}/phone-numbers/${enc(phoneNumberId)}/profile`,
            profile,
        ),

    // ---- media library ---------------------------------------------------
    getMediaLibrary: (projectId: string) =>
        get<{ media: any[] }>(`/projects/${enc(projectId)}/media`),
    saveMediaItem: (projectId: string, name: string, url: string, type: string) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/media`, { name, url, type }),
    deleteMediaItem: (mediaId: string) =>
        del<OkEnvelope>(`/media/${enc(mediaId)}`),

    // ---- misc -----------------------------------------------------------
    getApiKeys: (projectId: string) =>
        get<{ keys: any[] }>(`/projects/${enc(projectId)}/api-keys`),
    createApiKey: (projectId: string, name: string) =>
        post<{ key: string; message: string }>(`/projects/${enc(projectId)}/api-keys`, { name }),
    revokeApiKey: (keyId: string) =>
        post<OkEnvelope>(`/api-keys/${enc(keyId)}/revoke`),

    getWebhookLogs: (projectId: string) =>
        get<{ logs: any[] }>(`/projects/${enc(projectId)}/webhook-logs`),

    getImportHistory: (projectId: string) =>
        get<{ imports: any[] }>(`/projects/${enc(projectId)}/import-history`),

    getConversationFilters: (projectId: string) =>
        get<{ filters: any[] }>(`/projects/${enc(projectId)}/conversation-filters`),
    saveConversationFilter: (projectId: string, name: string, conditions: Record<string, any>) =>
        post<MessageEnvelope>(`/projects/${enc(projectId)}/conversation-filters`, { name, conditions }),
    deleteConversationFilter: (filterId: string) =>
        del<OkEnvelope>(`/conversation-filters/${enc(filterId)}`),

    // ---- health / conversational automation / commerce settings ----------
    // Wraps Meta Cloud API calls previously inlined in
    // `src/app/actions/whatsapp.actions.ts` (getWabaHealthStatus,
    // getPhoneNumberHealthStatus, getConversationalAutomation +
    // update/delete, getCommerceSettings + update).
    getWabaHealth: (wabaId: string) =>
        get<{ healthStatus: any | null }>(`/waba/${enc(wabaId)}/health`),
    getPhoneNumberHealth: (phoneNumberId: string) =>
        get<{
            healthStatus: any | null;
            messagingLimitTier: any | null;
            nameStatus: any | null;
            qualityRating: any | null;
        }>(`/phone-numbers/${enc(phoneNumberId)}/health`),

    getConversationalAutomation: (phoneNumberId: string) =>
        get<{ automation: any }>(
            `/phone-numbers/${enc(phoneNumberId)}/conversational-automation`,
        ),
    updateConversationalAutomation: (
        phoneNumberId: string,
        body: {
            enable_welcome_message?: boolean;
            prompts?: string[];
            commands?: Array<{ command_name: string; command_description: string }>;
        },
    ) =>
        post<MessageEnvelope>(
            `/phone-numbers/${enc(phoneNumberId)}/conversational-automation`,
            body,
        ),
    deleteConversationalAutomation: (phoneNumberId: string, fields: string[]) =>
        rustFetch<MessageEnvelope>(
            `${BASE}/phone-numbers/${enc(phoneNumberId)}/conversational-automation`,
            { method: 'DELETE', body: JSON.stringify({ fields }) },
        ),

    getCommerceSettings: (phoneNumberId: string) =>
        get<{ settings: any }>(`/phone-numbers/${enc(phoneNumberId)}/commerce-settings`),
    updateCommerceSettings: (
        phoneNumberId: string,
        body: { is_cart_enabled?: boolean; is_catalog_visible?: boolean },
    ) =>
        post<MessageEnvelope>(
            `/phone-numbers/${enc(phoneNumberId)}/commerce-settings`,
            body,
        ),

    // ---- Wave D: message-tag write verbs + analytics, link-click clear ----
    updateMessageTag: (tagId: string, body: UpdateMessageTagBody) =>
        rustFetch<OkEnvelope>(`${BASE}/message-tags/${enc(tagId)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    bulkApplyMessageTag: (projectId: string, body: BulkApplyMessageTagBody) =>
        post<BulkApplyMessageTagResponse>(
            `/projects/${enc(projectId)}/message-tags/bulk-apply`,
            body,
        ),
    messageTagAnalytics: (projectId: string, tagId: string, days?: number) =>
        get<MessageTagAnalyticsResponse>(
            `/projects/${enc(projectId)}/message-tags/${enc(tagId)}/analytics${
                days !== undefined ? `?days=${days}` : ''
            }`,
        ),
    deleteLinkClicks: (projectId: string) =>
        del<ClearLinkClicksResponse>(
            `/projects/${enc(projectId)}/analytics/link-clicks`,
        ),
};

export type WachatFeaturesApi = typeof wachatFeaturesApi;
