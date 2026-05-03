/**
 * Cross-channel thread merging for the unified inbox.
 *
 * In SabNode the same physical contact may have a WhatsApp number, a
 * Telegram chat, and an email address. The CRM stores the canonical
 * `contactId`; per-channel handles are stored as identifiers on that
 * contact. The unified inbox joins messages across channels by canonical
 * `contactId` so an agent sees one merged conversation.
 *
 * This module is storage-agnostic: callers pass a `MessageStore` (typically
 * a thin Mongo wrapper). A default in-memory implementation is provided
 * for tests and prototyping.
 */

import type { Channel, Message, Thread } from './types';

export interface MessageStore {
    /** All messages for `contactId` across all channels, newest last. */
    listMessagesForContact(tenantId: string, contactId: string): Promise<Message[]>;
}

/**
 * Group an arbitrary message stream into one thread per `(tenantId, contactId)`
 * tuple, with channel set + last-message metadata.
 */
export function mergeMessagesIntoThreads(messages: Message[]): Thread[] {
    const byKey = new Map<string, Message[]>();
    for (const m of messages) {
        const key = `${m.tenantId}::${m.to.contactId || m.from.contactId}`;
        const arr = byKey.get(key) ?? [];
        arr.push(m);
        byKey.set(key, arr);
    }

    const threads: Thread[] = [];
    for (const [key, msgs] of byKey.entries()) {
        const [tenantId, contactId] = key.split('::');
        msgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const last = msgs[msgs.length - 1];
        const channels = Array.from(
            new Set(msgs.map((m) => m.channel)),
        ) as Channel[];
        const unread = msgs.filter(
            (m) => m.direction === 'inbound' && m.status !== 'read',
        ).length;
        threads.push({
            id: `${tenantId}:${contactId}`,
            tenantId,
            contactId,
            channels,
            lastMessageAt: last.createdAt,
            lastMessage: last,
            unreadCount: unread,
        });
    }

    threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    return threads;
}

/**
 * Public API: returns merged threads for a single contact. Because a contact
 * is the merge key, the result is at most one `Thread` (but the array shape
 * mirrors `listThreadsForTenant` for consistency).
 */
export async function getThreadsForContact(
    tenantId: string,
    contactId: string,
    store: MessageStore,
): Promise<Thread[]> {
    const msgs = await store.listMessagesForContact(tenantId, contactId);
    if (msgs.length === 0) return [];
    return mergeMessagesIntoThreads(msgs);
}

/**
 * In-memory MessageStore — useful for tests and the dev seeder.
 */
export class InMemoryMessageStore implements MessageStore {
    private msgs: Message[] = [];
    add(message: Message): void {
        this.msgs.push(message);
    }
    async listMessagesForContact(tenantId: string, contactId: string): Promise<Message[]> {
        return this.msgs.filter(
            (m) =>
                m.tenantId === tenantId &&
                (m.to.contactId === contactId || m.from.contactId === contactId),
        );
    }
}
