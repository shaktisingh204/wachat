/**
 * Channel routing — pick the best channel to deliver a given message to a
 * given contact, respecting opt-ins, recency of engagement, and per-channel
 * adapter availability.
 *
 * The actual heuristic is deliberately simple and explicit:
 *   1. Filter to channels the adapter is registered for AND the contact has
 *      explicitly opted in to.
 *   2. Prefer the channel the contact most recently engaged on (within the
 *      last 24h) — exploits the WhatsApp-style 24-hour session window.
 *   3. Otherwise prefer the caller's `fallbacks` order.
 *   4. Otherwise prefer a hard-coded global preference order.
 */

import type { Channel, MessageContent } from './types';
import { getChannel } from './registry';

export interface ContactChannelPreference {
    channel: Channel;
    /** Channel-level handle (phone, email, telegram chat id, …). */
    address: string;
    /** Has the contact explicitly opted in to receive on this channel? */
    optedIn: boolean;
    /** ISO timestamp of the last inbound message from the contact on this channel. */
    lastInboundAt?: string;
}

export interface RoutingContact {
    contactId: string;
    tenantId: string;
    preferences: ContactChannelPreference[];
}

const DEFAULT_PREFERENCE_ORDER: Channel[] = [
    'whatsapp',
    'rcs',
    'imessage',
    'sms',
    'telegram',
    'instagram',
    'line',
    'wechat',
    'kakao',
    'discord',
    'email',
    'webpush',
    'in-app',
    'voice',
];

const RECENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface PickResult {
    channel: Channel;
    address: string;
    /** Ordered list of remaining channels we'd try if the chosen one fails. */
    fallbackChain: Channel[];
    reason:
        | 'recency'
        | 'caller-fallback'
        | 'default-order'
        | 'forced-channel';
}

export interface PickOptions {
    /** If set, we honour this exact channel (subject to opt-in & registry). */
    forceChannel?: Channel;
    /** Caller-supplied ordered fallback list. */
    fallbacks?: Channel[];
    /** Reference time, defaults to `Date.now()`. */
    nowMs?: number;
}

/**
 * Decide which channel to use for `contact`. Throws when no channel is viable.
 */
export function pickBestChannel(
    contact: RoutingContact,
    _message: MessageContent,
    opts: PickOptions = {},
): PickResult {
    const now = opts.nowMs ?? Date.now();

    const viable = contact.preferences.filter(
        (p) => p.optedIn && getChannel(p.channel) !== undefined,
    );

    if (viable.length === 0) {
        throw new Error(
            `pickBestChannel: contact ${contact.contactId} has no opted-in & registered channels`,
        );
    }

    const byChannel = new Map<Channel, ContactChannelPreference>();
    for (const p of viable) byChannel.set(p.channel, p);

    if (opts.forceChannel) {
        const forced = byChannel.get(opts.forceChannel);
        if (forced) {
            return {
                channel: forced.channel,
                address: forced.address,
                fallbackChain: orderFallback(viable.map((v) => v.channel), forced.channel),
                reason: 'forced-channel',
            };
        }
    }

    // Step 2: recency
    const recent = viable
        .filter((p) => {
            if (!p.lastInboundAt) return false;
            return now - new Date(p.lastInboundAt).getTime() <= RECENCY_WINDOW_MS;
        })
        .sort((a, b) =>
            (b.lastInboundAt ?? '').localeCompare(a.lastInboundAt ?? ''),
        );
    if (recent.length > 0) {
        const top = recent[0];
        return {
            channel: top.channel,
            address: top.address,
            fallbackChain: orderFallback(viable.map((v) => v.channel), top.channel),
            reason: 'recency',
        };
    }

    // Step 3: caller fallbacks
    if (opts.fallbacks && opts.fallbacks.length > 0) {
        for (const c of opts.fallbacks) {
            const hit = byChannel.get(c);
            if (hit) {
                return {
                    channel: hit.channel,
                    address: hit.address,
                    fallbackChain: orderFallback(viable.map((v) => v.channel), hit.channel),
                    reason: 'caller-fallback',
                };
            }
        }
    }

    // Step 4: default global order
    for (const c of DEFAULT_PREFERENCE_ORDER) {
        const hit = byChannel.get(c);
        if (hit) {
            return {
                channel: hit.channel,
                address: hit.address,
                fallbackChain: orderFallback(viable.map((v) => v.channel), hit.channel),
                reason: 'default-order',
            };
        }
    }

    // Defensive: should be unreachable because viable.length > 0.
    const first = viable[0];
    return {
        channel: first.channel,
        address: first.address,
        fallbackChain: orderFallback(viable.map((v) => v.channel), first.channel),
        reason: 'default-order',
    };
}

function orderFallback(all: Channel[], chosen: Channel): Channel[] {
    const remaining = all.filter((c) => c !== chosen);
    remaining.sort(
        (a, b) =>
            DEFAULT_PREFERENCE_ORDER.indexOf(a) -
            DEFAULT_PREFERENCE_ORDER.indexOf(b),
    );
    return remaining;
}
