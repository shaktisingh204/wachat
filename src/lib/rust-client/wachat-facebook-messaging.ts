/**
 * Client for the Facebook Messenger / Conversations slice of the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/messaging` by the
 * `wachat-facebook-messaging` crate. Each method is a thin wrapper around
 * {@link rustFetch}.
 *
 *   GET    /projects/:projectId/conversations
 *   GET    /projects/:projectId/conversations/search?query=...
 *   GET    /projects/:projectId/chat-initial-data
 *   GET    /projects/:projectId/conversations/:conversationId/messages
 *   POST   /projects/:projectId/conversations/:conversationId/mark-read
 *
 *   POST   /projects/:projectId/messages/text
 *   POST   /projects/:projectId/messages/media
 *   POST   /projects/:projectId/messages/button-template
 *   POST   /projects/:projectId/messages/generic-template
 *   POST   /projects/:projectId/messages/quick-replies
 *
 *   POST   /projects/:projectId/handover/pass
 *   POST   /projects/:projectId/handover/take
 *   POST   /projects/:projectId/handover/request
 *   GET    /projects/:projectId/handover/secondary-receivers
 *
 *   POST   /projects/:projectId/notifications/one-time/request
 *   POST   /projects/:projectId/notifications/one-time/send
 *   POST   /projects/:projectId/notifications/recurring/opt-in
 *   POST   /projects/:projectId/notifications/recurring/send
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/messaging';

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

/** Pass-through Graph object — message + conversation shapes are open. */
export type FacebookGraphValue = Record<string, any>;

export interface ConversationsResp {
    conversations: FacebookGraphValue[];
}

export interface MessagesResp {
    messages: FacebookGraphValue[];
}

export interface ChatInitialDataResp {
    project: FacebookGraphValue | null;
    conversations: FacebookGraphValue[];
}

export interface AckResp {
    success: boolean;
}

export interface SecondaryReceiversResp {
    receivers: FacebookGraphValue[];
}

// ---------------------------------------------------------------------------
// Send body shapes
// ---------------------------------------------------------------------------

export interface SendTextBody {
    recipient_id: string;
    message_text: string;
}

export interface SendMediaBody {
    recipient_id: string;
    /** `image` | `video` | `audio` | `file` */
    media_type: 'image' | 'video' | 'audio' | 'file';
    /** Public URL or pre-uploaded media id. */
    media_url: string;
}

export interface ButtonTemplateButton {
    type: 'web_url' | 'postback';
    title: string;
    url?: string;
    payload?: string;
}

export interface SendButtonTemplateBody {
    recipient_id: string;
    text: string;
    buttons: ButtonTemplateButton[];
}

export interface SendGenericTemplateBody {
    recipient_id: string;
    elements: FacebookGraphValue[];
}

export interface QuickReplyItem {
    content_type: 'text' | 'user_phone_number' | 'user_email';
    title?: string;
    payload?: string;
    image_url?: string;
}

export interface SendQuickRepliesBody {
    recipient_id: string;
    text: string;
    quick_replies: QuickReplyItem[];
}

// ---------------------------------------------------------------------------
// Handover Protocol
// ---------------------------------------------------------------------------

export interface PassThreadBody {
    psid: string;
    target_app_id: string;
    metadata?: string;
}

export interface ThreadControlBody {
    psid: string;
    metadata?: string;
}

// ---------------------------------------------------------------------------
// One-time / recurring notifications
// ---------------------------------------------------------------------------

export interface OneTimeNotifRequestBody {
    psid: string;
    title: string;
    payload: string;
}

export interface OneTimeNotifSendBody {
    /** `one_time_notif_token` returned when the user opted in. */
    token: string;
    message_text: string;
}

export interface RecurringOptInBody {
    psid: string;
    title: string;
    image_url: string;
    payload: string;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

export interface RecurringSendBody {
    /** `notification_messages_token` returned when the user opted in. */
    token: string;
    message_text: string;
}

// ---------------------------------------------------------------------------
// Public namespace — one method per route
// ---------------------------------------------------------------------------

const enc = encodeURIComponent;

export const wachatFacebookMessagingApi = {
    // ---- Inbox / list ------------------------------------------------------
    getConversations: (projectId: string) =>
        rustFetch<ConversationsResp>(
            `${BASE}/projects/${enc(projectId)}/conversations`,
        ),

    searchConversations: (projectId: string, query: string) =>
        rustFetch<ConversationsResp>(
            `${BASE}/projects/${enc(projectId)}/conversations/search?query=${enc(query)}`,
        ),

    getChatInitialData: (projectId: string) =>
        rustFetch<ChatInitialDataResp>(
            `${BASE}/projects/${enc(projectId)}/chat-initial-data`,
        ),

    getConversationMessages: (projectId: string, conversationId: string) =>
        rustFetch<MessagesResp>(
            `${BASE}/projects/${enc(projectId)}/conversations/${enc(conversationId)}/messages`,
        ),

    markConversationAsRead: (projectId: string, conversationId: string) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/conversations/${enc(conversationId)}/mark-read`,
            { method: 'POST' },
        ),

    // ---- Send --------------------------------------------------------------
    sendTextMessage: (projectId: string, body: SendTextBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/messages/text`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    sendMediaMessage: (projectId: string, body: SendMediaBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/messages/media`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    sendButtonTemplate: (projectId: string, body: SendButtonTemplateBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/messages/button-template`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    sendGenericTemplate: (projectId: string, body: SendGenericTemplateBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/messages/generic-template`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    sendQuickReplies: (projectId: string, body: SendQuickRepliesBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/messages/quick-replies`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    // ---- Handover Protocol ------------------------------------------------
    passThreadControl: (projectId: string, body: PassThreadBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/handover/pass`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    takeThreadControl: (projectId: string, body: ThreadControlBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/handover/take`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    requestThreadControl: (projectId: string, body: ThreadControlBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/handover/request`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    getSecondaryReceivers: (projectId: string) =>
        rustFetch<SecondaryReceiversResp>(
            `${BASE}/projects/${enc(projectId)}/handover/secondary-receivers`,
        ),

    // ---- Notifications ----------------------------------------------------
    sendOneTimeNotifRequest: (projectId: string, body: OneTimeNotifRequestBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/notifications/one-time/request`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    sendOneTimeNotification: (projectId: string, body: OneTimeNotifSendBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/notifications/one-time/send`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    sendRecurringNotifOptIn: (projectId: string, body: RecurringOptInBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/notifications/recurring/opt-in`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    sendRecurringNotification: (projectId: string, body: RecurringSendBody) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${enc(projectId)}/notifications/recurring/send`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
};

export type WachatFacebookMessagingApi = typeof wachatFacebookMessagingApi;
