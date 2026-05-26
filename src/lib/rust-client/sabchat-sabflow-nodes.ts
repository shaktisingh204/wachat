/**
 * Client for `/v1/sabchat/sabflow/*` — node descriptors + action entry
 * points the SabFlow executor calls when running a SabChat-flavoured
 * workflow. Owned by the `sabchat-sabflow-nodes` Rust crate.
 *
 * The descriptors surface (`GET /nodes`) is what SabFlow's UI palette
 * reads to render the SabChat triggers and actions; the `/actions/*`
 * routes are what the executor POSTs to when a node fires.
 */
import 'server-only';

import { rustFetch } from './fetcher';
import type { ContentBlock } from './sabchat';

export interface SabChatSabflowNodeDescriptor {
    name: string;
    displayName: string;
    description?: string;
    group?: string;
    isTrigger?: boolean;
    properties?: unknown[];
    [key: string]: unknown;
}

export interface SabChatSabflowActionResult {
    ok: boolean;
    conversationId?: string;
    messageId?: string;
    output?: Record<string, unknown>;
}

export const sabchatSabflowNodesApi = {
    // ---- descriptors -------------------------------------------------------
    nodes: () => rustFetch<{ nodes: SabChatSabflowNodeDescriptor[] }>('/v1/sabchat/sabflow/nodes'),

    // ---- actions -----------------------------------------------------------
    sendMessage: (body: {
        conversationId: string;
        content: ContentBlock;
        private?: boolean;
        senderType?: string;
        senderId?: string;
    }) =>
        rustFetch<SabChatSabflowActionResult>('/v1/sabchat/sabflow/actions/send-message', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    addLabel: (body: { conversationId: string; label: string }) =>
        rustFetch<SabChatSabflowActionResult>('/v1/sabchat/sabflow/actions/add-label', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    setStatus: (body: { conversationId: string; status: 'open' | 'pending' | 'resolved' | 'snoozed' }) =>
        rustFetch<SabChatSabflowActionResult>('/v1/sabchat/sabflow/actions/set-status', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    setPriority: (body: { conversationId: string; priority: 'low' | 'medium' | 'high' | 'urgent' }) =>
        rustFetch<SabChatSabflowActionResult>('/v1/sabchat/sabflow/actions/set-priority', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    setAssignee: (body: { conversationId: string; assigneeId?: string | null; reason?: string }) =>
        rustFetch<SabChatSabflowActionResult>('/v1/sabchat/sabflow/actions/set-assignee', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    runMacro: (body: { conversationId: string; macroId: string; vars?: Record<string, unknown> }) =>
        rustFetch<SabChatSabflowActionResult>('/v1/sabchat/sabflow/actions/run-macro', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};
