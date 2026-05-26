/**
 * Client for `/v1/sabchat/cart-recovery/*` — abandoned-cart recovery
 * rules, cart read surface, sweep, and trigger log. Owned by the
 * `sabchat-cart-recovery` Rust crate. The visitor-side event-reporting
 * routes at `/v1/sabchat/cart-recovery-public/*` are called by the
 * storefront snippet, not by SabNode itself, so they're not wrapped here.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabChatCartStatus = 'active' | 'abandoned' | 'recovered' | 'completed';

export interface SabChatCart {
    _id: string;
    tenantId: string;
    inboxId: string;
    visitorToken: string;
    contactId?: string;
    conversationId?: string;
    status: SabChatCartStatus;
    items: Array<{ sku: string; name?: string; quantity: number; priceMinor?: number }>;
    totalMinor: number;
    currency?: string;
    lastEventAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatCartRule {
    _id: string;
    tenantId: string;
    name: string;
    inboxId?: string;
    idleMinutes: number;
    minTotalMinor?: number;
    action: 'open_widget' | 'send_message' | 'send_coupon';
    payload?: Record<string, unknown>;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatCartTrigger {
    _id: string;
    tenantId: string;
    ruleId: string;
    cartId: string;
    action: string;
    firedAt: string;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatCartRecoveryApi = {
    createRule: (body: Partial<Omit<SabChatCartRule, '_id' | 'tenantId' | 'createdAt' | 'updatedAt'>> & { name: string; idleMinutes: number; action: SabChatCartRule['action'] }) =>
        rustFetch<SabChatCartRule>('/v1/sabchat/cart-recovery/rules', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listRules: (q: { active?: boolean; inboxId?: string } = {}) =>
        rustFetch<{ items: SabChatCartRule[] }>(`/v1/sabchat/cart-recovery/rules${qs(q)}`),

    getRule: (id: string) => rustFetch<SabChatCartRule>(`/v1/sabchat/cart-recovery/rules/${id}`),

    updateRule: (id: string, body: Partial<Omit<SabChatCartRule, '_id' | 'tenantId' | 'createdAt' | 'updatedAt'>>) =>
        rustFetch<SabChatCartRule>(`/v1/sabchat/cart-recovery/rules/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    deleteRule: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/cart-recovery/rules/${id}`, { method: 'DELETE' }),

    listCarts: (q: { status?: SabChatCartStatus; inboxId?: string; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatCart[]; nextCursor?: string }>(`/v1/sabchat/cart-recovery/carts${qs(q)}`),

    getCart: (id: string) => rustFetch<SabChatCart>(`/v1/sabchat/cart-recovery/carts/${id}`),

    sweep: (body: { ruleId?: string; dryRun?: boolean } = {}) =>
        rustFetch<{ scanned: number; fired: number; details?: SabChatCartTrigger[] }>(
            '/v1/sabchat/cart-recovery/sweep',
            { method: 'POST', body: JSON.stringify(body) },
        ),

    listTriggers: (q: { ruleId?: string; cartId?: string; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatCartTrigger[]; nextCursor?: string }>(
            `/v1/sabchat/cart-recovery/triggers${qs(q)}`,
        ),
};
