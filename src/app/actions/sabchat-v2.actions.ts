'use server';

/**
 * SabChat v2 Server Actions — thin shim that hands every call straight
 * through to the Rust BFF (`/v1/sabchat/*`).
 *
 * The legacy `sabchat.actions.ts` (Mongo-on-user-doc) is kept around for
 * the old widget config screens; new surfaces (inbox v2, agents UI,
 * conversation timelines, …) call into these wrappers instead.
 */

import { rustClient } from '@/lib/rust-client';
import { revalidatePath } from 'next/cache';
import { getErrorMessage } from '@/lib/utils';
import type {
    ContentBlock,
    ConversationPriority,
    ConversationStatus,
} from '@/lib/rust-client/sabchat';

// ---------------------------------------------------------------------------
// Inbox queries (server components)
// ---------------------------------------------------------------------------

export async function listInboxes() {
    try {
        return await rustClient.sabchat.inboxes.list();
    } catch (e) {
        return { items: [], error: getErrorMessage(e) };
    }
}

export async function getInbox(id: string) {
    try {
        return await rustClient.sabchat.inboxes.get(id);
    } catch (e) {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Conversation queries
// ---------------------------------------------------------------------------

export async function listConversations(params: {
    inboxId?: string;
    status?: ConversationStatus;
    assigneeId?: string;
    label?: string;
    q?: string;
    cursor?: string;
}) {
    try {
        return await rustClient.sabchat.conversations.list(params);
    } catch (e) {
        return { items: [], error: getErrorMessage(e) };
    }
}

export async function getConversation(id: string) {
    try {
        return await rustClient.sabchat.conversations.get(id);
    } catch (e) {
        return null;
    }
}

export async function listConversationMessages(conversationId: string, beforeId?: string) {
    try {
        return await rustClient.sabchat.messages.list({ conversationId, beforeId, limit: 100 });
    } catch (e) {
        return { items: [], error: getErrorMessage(e) };
    }
}

// ---------------------------------------------------------------------------
// Mutations (called from forms / client islands)
// ---------------------------------------------------------------------------

export async function sendAgentMessage(
    conversationId: string,
    text: string,
    opts: { private?: boolean } = {},
) {
    if (!text.trim()) return { error: 'Empty message' };
    try {
        const content: ContentBlock = { kind: 'text', text };
        const msg = await rustClient.sabchat.messages.append({
            conversationId,
            content,
            private: opts.private ?? false,
            senderType: 'agent',
        });
        revalidatePath(`/dashboard/sabchat/inbox-v2`);
        return { message: 'sent', data: msg };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function setConversationStatus(id: string, status: ConversationStatus) {
    try {
        await rustClient.sabchat.conversations.setStatus(id, status);
        revalidatePath('/dashboard/sabchat/inbox-v2');
        return { message: 'updated' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function setConversationPriority(id: string, priority: ConversationPriority) {
    try {
        await rustClient.sabchat.conversations.setPriority(id, priority);
        revalidatePath('/dashboard/sabchat/inbox-v2');
        return { message: 'updated' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function setConversationAssignee(
    id: string,
    assigneeId: string | null,
    reason?: string,
) {
    try {
        await rustClient.sabchat.conversations.setAssignee(id, assigneeId, reason);
        revalidatePath('/dashboard/sabchat/inbox-v2');
        return { message: 'updated' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function resolveConversation(id: string) {
    try {
        await rustClient.sabchat.conversations.resolve(id);
        revalidatePath('/dashboard/sabchat/inbox-v2');
        return { message: 'resolved' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function reopenConversation(id: string) {
    try {
        await rustClient.sabchat.conversations.reopen(id);
        revalidatePath('/dashboard/sabchat/inbox-v2');
        return { message: 'reopened' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function autoAssignConversation(
    id: string,
    strategy: 'round_robin' | 'sticky' = 'round_robin',
) {
    try {
        await rustClient.sabchat.routing.assign(id, { strategy });
        revalidatePath('/dashboard/sabchat/inbox-v2');
        return { message: 'assigned' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

// ---------------------------------------------------------------------------
// Inbox bootstrap (admin)
// ---------------------------------------------------------------------------

export async function createInbox(formData: FormData) {
    const name = String(formData.get('name') ?? '').trim();
    const channelType = String(formData.get('channelType') ?? 'website') as
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
    if (!name) return { error: 'Name required' };
    try {
        const inbox = await rustClient.sabchat.inboxes.create({ name, channelType });
        revalidatePath('/dashboard/sabchat/inbox-v2');
        return { message: 'created', data: inbox };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
