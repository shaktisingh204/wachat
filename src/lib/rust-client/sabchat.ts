/**
 * Client for the SabChat Rust BFF — Pillar 1 + 2 foundation.
 *
 * Mirrors every route mounted under `/v1/sabchat/*` by the Rust crates:
 *   /v1/sabchat/inboxes        → sabchat-inboxes
 *   /v1/sabchat/contacts       → sabchat-contacts
 *   /v1/sabchat/conversations  → sabchat-conversations
 *   /v1/sabchat/messages       → sabchat-messages
 *   /v1/sabchat/audit          → sabchat-audit
 *   /v1/sabchat/routing        → sabchat-routing
 *   /v1/sabchat/widget         → sabchat-widget   (public, no JWT)
 *   /v1/sabchat/ws             → sabchat-ws       (websocket)
 *
 * Server-only — the JWT-issuing fetcher must never reach the browser.
 */
import 'server-only';

import { rustFetch } from './fetcher';

// ---------------------------------------------------------------------------
// Shared wire types (mirror the Rust DTOs — every Rust handler is camelCase).
// ---------------------------------------------------------------------------

export type ChannelType =
    | 'website'
    | 'whatsapp_cloud'
    | 'whatsapp_personal'
    | 'instagram'
    | 'facebook'
    | 'telegram'
    | 'email'
    | 'sms'
    | 'voice'
    | 'in_app'
    | 'apple_business_chat'
    | 'google_business_messages'
    | 'line'
    | 'viber'
    | 'x_dm';

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'snoozed';
export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SenderType = 'visitor' | 'agent' | 'bot' | 'system';
export type MessageDirection = 'inbound' | 'outbound';

export interface SocialIdentity {
    provider: string;
    externalId: string;
    handle?: string;
}

export type ContentBlock =
    | { kind: 'text'; text: string }
    | { kind: 'image'; url: string; alt?: string }
    | { kind: 'file'; attachment: Attachment }
    | { kind: 'voice'; url: string; durationS: number; transcript?: string }
    | {
          kind: 'card';
          title: string;
          subtitle?: string;
          imageUrl?: string;
          buttons?: CardButton[];
      }
    | { kind: 'carousel'; cards: CarouselCard[] }
    | { kind: 'form'; fields: FormField[] }
    | {
          kind: 'payment';
          currency: string;
          amountMinor: number;
          linkUrl: string;
          provider?: string;
      }
    | { kind: 'location'; lat: number; lng: number; label?: string }
    | { kind: 'system'; text: string };

export interface Attachment {
    sabfileId: string;
    url: string;
    name: string;
    mime?: string;
    size?: number;
}

export interface CardButton {
    label: string;
    kind: string;
    value: string;
}

export interface CarouselCard {
    title: string;
    subtitle?: string;
    imageUrl?: string;
    buttons?: CardButton[];
}

export interface FormField {
    key: string;
    label: string;
    kind: string;
    required?: boolean;
    options?: string[];
}

export interface BusinessHoursWindow {
    day: number;
    open: string;
    close: string;
}

export interface BusinessHours {
    enabled?: boolean;
    timezone?: string;
    windows?: BusinessHoursWindow[];
}

export interface ChannelConfig {
    settings?: Record<string, unknown>;
}

export interface SabChatInbox {
    _id: string;
    tenantId: string;
    name: string;
    channelType: ChannelType;
    channelConfig?: ChannelConfig;
    agentIds?: string[];
    teamId?: string;
    businessHours?: BusinessHours;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatContact {
    _id: string;
    tenantId: string;
    name?: string;
    avatarUrl?: string;
    emails?: string[];
    phones?: string[];
    socialIds?: SocialIdentity[];
    attrs?: Record<string, unknown>;
    tags?: string[];
    lastSeenAt?: string;
    crmContactId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SlaPolicy {
    firstResponseDueAt?: string;
    nextResponseDueAt?: string;
    resolutionDueAt?: string;
    breached?: boolean;
}

export interface SabChatConversation {
    _id: string;
    tenantId: string;
    inboxId: string;
    contactId: string;
    status: ConversationStatus;
    priority: ConversationPriority;
    assigneeId?: string;
    teamId?: string;
    labels?: string[];
    snoozeUntil?: string;
    sla?: SlaPolicy;
    lastMessageAt?: string;
    lastMessagePreview?: string;
    unreadCount?: number;
    customAttrs?: Record<string, unknown>;
    firstResponseAt?: string;
    resolvedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatMessage {
    _id: string;
    tenantId: string;
    conversationId: string;
    inboxId: string;
    contactId: string;
    senderType: SenderType;
    senderId?: string;
    direction: MessageDirection;
    content: ContentBlock;
    attachments?: Attachment[];
    providerMetadata?: Record<string, unknown>;
    private?: boolean;
    createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Inboxes
// ---------------------------------------------------------------------------

export const sabchatInboxesApi = {
    create: (body: {
        name: string;
        channelType: ChannelType;
        channelConfig?: ChannelConfig;
        agentIds?: string[];
        teamId?: string;
        businessHours?: BusinessHours;
    }) =>
        rustFetch<SabChatInbox>('/v1/sabchat/inboxes/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    list: (q: { channelType?: ChannelType; enabled?: boolean } = {}) =>
        rustFetch<{ items: SabChatInbox[] }>(`/v1/sabchat/inboxes/${qs(q)}`),

    get: (id: string) => rustFetch<SabChatInbox>(`/v1/sabchat/inboxes/${id}`),

    update: (
        id: string,
        body: Partial<{
            name: string;
            channelConfig: ChannelConfig;
            businessHours: BusinessHours;
            enabled: boolean;
            teamId: string | null;
        }>,
    ) =>
        rustFetch<SabChatInbox>(`/v1/sabchat/inboxes/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    addAgent: (id: string, agentId: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/inboxes/${id}/agents`, {
            method: 'POST',
            body: JSON.stringify({ agentId }),
        }),

    removeAgent: (id: string, agentId: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/inboxes/${id}/agents/${agentId}`, {
            method: 'DELETE',
        }),

    delete: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/inboxes/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const sabchatContactsApi = {
    create: (body: Partial<Pick<SabChatContact, 'name' | 'emails' | 'phones' | 'socialIds' | 'attrs' | 'tags'>>) =>
        rustFetch<SabChatContact>('/v1/sabchat/contacts/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    list: (q: { q?: string; tag?: string; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatContact[]; nextCursor?: string }>(`/v1/sabchat/contacts/${qs(q)}`),

    get: (id: string) => rustFetch<SabChatContact>(`/v1/sabchat/contacts/${id}`),

    update: (id: string, body: Partial<Pick<SabChatContact, 'name' | 'emails' | 'phones' | 'socialIds' | 'attrs' | 'tags'>>) =>
        rustFetch<SabChatContact>(`/v1/sabchat/contacts/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    merge: (id: string, sourceId: string) =>
        rustFetch<SabChatContact>(`/v1/sabchat/contacts/${id}/merge`, {
            method: 'POST',
            body: JSON.stringify({ sourceId }),
        }),

    resolve: (body: { email?: string; phone?: string; socialId?: SocialIdentity }) =>
        rustFetch<SabChatContact>('/v1/sabchat/contacts/resolve', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    delete: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/contacts/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export const sabchatConversationsApi = {
    create: (body: {
        inboxId: string;
        contactId: string;
        priority?: ConversationPriority;
        customAttrs?: Record<string, unknown>;
    }) =>
        rustFetch<SabChatConversation>('/v1/sabchat/conversations/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    list: (
        q: {
            inboxId?: string;
            status?: ConversationStatus;
            assigneeId?: string;
            label?: string;
            q?: string;
            limit?: number;
            cursor?: string;
        } = {},
    ) =>
        rustFetch<{ items: SabChatConversation[]; nextCursor?: string }>(
            `/v1/sabchat/conversations/${qs(q)}`,
        ),

    get: (id: string) => rustFetch<SabChatConversation>(`/v1/sabchat/conversations/${id}`),

    setStatus: (id: string, status: ConversationStatus) =>
        rustFetch<SabChatConversation>(`/v1/sabchat/conversations/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        }),

    setPriority: (id: string, priority: ConversationPriority) =>
        rustFetch<SabChatConversation>(`/v1/sabchat/conversations/${id}/priority`, {
            method: 'PATCH',
            body: JSON.stringify({ priority }),
        }),

    setAssignee: (id: string, assigneeId: string | null, reason?: string) =>
        rustFetch<SabChatConversation>(`/v1/sabchat/conversations/${id}/assignee`, {
            method: 'PATCH',
            body: JSON.stringify({ assigneeId, reason }),
        }),

    addLabel: (id: string, label: string) =>
        rustFetch<SabChatConversation>(`/v1/sabchat/conversations/${id}/labels`, {
            method: 'POST',
            body: JSON.stringify({ label }),
        }),

    removeLabel: (id: string, label: string) =>
        rustFetch<SabChatConversation>(
            `/v1/sabchat/conversations/${id}/labels/${encodeURIComponent(label)}`,
            { method: 'DELETE' },
        ),

    snooze: (id: string, until: string) =>
        rustFetch<SabChatConversation>(`/v1/sabchat/conversations/${id}/snooze`, {
            method: 'POST',
            body: JSON.stringify({ until }),
        }),

    resolve: (id: string) =>
        rustFetch<SabChatConversation>(`/v1/sabchat/conversations/${id}/resolve`, {
            method: 'POST',
        }),

    reopen: (id: string) =>
        rustFetch<SabChatConversation>(`/v1/sabchat/conversations/${id}/reopen`, {
            method: 'POST',
        }),
};

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const sabchatMessagesApi = {
    append: (body: {
        conversationId: string;
        content: ContentBlock;
        private?: boolean;
        senderType?: SenderType;
        senderId?: string;
    }) =>
        rustFetch<SabChatMessage>('/v1/sabchat/messages/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    list: (q: { conversationId: string; beforeId?: string; limit?: number }) =>
        rustFetch<{ items: SabChatMessage[] }>(`/v1/sabchat/messages/${qs(q)}`),

    get: (id: string) => rustFetch<SabChatMessage>(`/v1/sabchat/messages/${id}`),

    edit: (id: string, content: ContentBlock) =>
        rustFetch<SabChatMessage>(`/v1/sabchat/messages/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ content }),
        }),

    delete: (id: string) =>
        rustFetch<SabChatMessage>(`/v1/sabchat/messages/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Audit log (read-only over HTTP)
// ---------------------------------------------------------------------------

export const sabchatAuditApi = {
    list: (
        q: {
            conversationId?: string;
            contactId?: string;
            inboxId?: string;
            action?: string;
            actorId?: string;
            since?: string;
            until?: string;
            limit?: number;
            cursor?: string;
        } = {},
    ) =>
        rustFetch<{ events: unknown[]; nextCursor?: string }>(`/v1/sabchat/audit/${qs(q)}`),

    get: (id: string) => rustFetch<unknown>(`/v1/sabchat/audit/${id}`),
};

// ---------------------------------------------------------------------------
// Routing (assignment + SLA)
// ---------------------------------------------------------------------------

export const sabchatRoutingApi = {
    assign: (
        conversationId: string,
        body: {
            strategy: 'round_robin' | 'manual' | 'sticky' | 'unassign';
            agentId?: string;
            reason?: string;
        },
    ) =>
        rustFetch<SabChatConversation>(`/v1/sabchat/routing/assign/${conversationId}`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    slaSweep: () =>
        rustFetch<{ scanned: number; newlyBreached: number; cleared: number; unchanged: number }>(
            '/v1/sabchat/routing/sla/sweep',
            { method: 'POST' },
        ),

    agentLoad: () =>
        rustFetch<
            Array<{
                agentId: string;
                openCount: number;
                urgentCount: number;
                oldestMinutes: number;
            }>
        >('/v1/sabchat/routing/load'),
};

// ---------------------------------------------------------------------------
// Aggregate namespace
// ---------------------------------------------------------------------------

export const sabchatApi = {
    inboxes: sabchatInboxesApi,
    contacts: sabchatContactsApi,
    conversations: sabchatConversationsApi,
    messages: sabchatMessagesApi,
    audit: sabchatAuditApi,
    routing: sabchatRoutingApi,
};
