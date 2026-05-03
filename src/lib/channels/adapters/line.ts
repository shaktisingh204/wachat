/**
 * LINE Messaging API adapter.
 *
 * Docs: https://developers.line.biz/en/reference/messaging-api/
 * Auth: long-lived `channelAccessToken` (Bearer).
 */

import {
    ChannelAdapter,
    ChannelCredentials,
    ChannelError,
    ContactRef,
    MessageContent,
    SendOptions,
    SendResult,
    InboundEvent,
    Message,
} from '../types';
import crypto from 'crypto';

interface LineCreds extends ChannelCredentials {
    channelAccessToken?: string;
    channelSecret?: string;
}

const LINE_API = 'https://api.line.me/v2/bot';

export const lineAdapter: ChannelAdapter = {
    channel: 'line',
    displayName: 'LINE',

    async send(
        creds: ChannelCredentials,
        to: ContactRef,
        content: MessageContent,
        opts?: SendOptions,
    ): Promise<SendResult> {
        const c = creds as LineCreds;
        if (!c.channelAccessToken) {
            throw new ChannelError({
                channel: 'line',
                code: 'MISSING_CREDENTIALS',
                message: 'LINE adapter requires `channelAccessToken`',
            });
        }

        const messages = buildLineMessages(content);
        const headers: Record<string, string> = {
            Authorization: `Bearer ${c.channelAccessToken}`,
            'Content-Type': 'application/json',
        };
        if (opts?.idempotencyKey) headers['X-Line-Retry-Key'] = opts.idempotencyKey;

        const res = await fetch(`${LINE_API}/message/push`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ to: to.address, messages }),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new ChannelError({
                channel: 'line',
                code: `HTTP_${res.status}`,
                message: `LINE push failed: ${text}`,
                retryable: res.status >= 500,
            });
        }

        const messageId = opts?.idempotencyKey ?? `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return { messageId, providerMessageId: messageId, status: 'sent' };
    },

    verifyWebhook(payload, headers, secret) {
        const sig = headers['x-line-signature'] || headers['X-Line-Signature'];
        if (!sig) return false;
        const expected = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('base64');
        try {
            return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
        } catch {
            return false;
        }
    },

    parseWebhook(payload): InboundEvent[] {
        const body = payload as { events?: Array<Record<string, unknown>>; destination?: string };
        const events = body.events ?? [];
        const out: InboundEvent[] = [];
        for (const ev of events) {
            if (ev.type !== 'message') continue;
            const src = ev.source as { userId?: string } | undefined;
            const msg = ev.message as { id?: string; type?: string; text?: string } | undefined;
            if (!src?.userId || !msg) continue;
            const message: Message = {
                id: msg.id ?? `line_in_${Date.now()}`,
                tenantId: '', // resolved from `body.destination` upstream
                threadId: src.userId,
                channel: 'line',
                direction: 'inbound',
                status: 'delivered',
                createdAt: new Date(Number(ev.timestamp) || Date.now()).toISOString(),
                providerMessageId: msg.id,
                from: { contactId: src.userId, tenantId: '', address: src.userId, channel: 'line' },
                to: { contactId: 'self', tenantId: '', address: body.destination ?? '', channel: 'line' },
                content: msg.type === 'text' ? { kind: 'text', text: msg.text ?? '' } : { kind: 'system', text: `[${msg.type}]` },
            };
            out.push({ kind: 'message', channel: 'line', tenantId: '', message, raw: ev });
        }
        return out;
    },
};

function buildLineMessages(content: MessageContent): Array<Record<string, unknown>> {
    if (content.kind === 'text') return [{ type: 'text', text: content.text ?? '' }];
    if (content.kind === 'image' && content.media?.[0]) {
        const m = content.media[0];
        return [{ type: 'image', originalContentUrl: m.url, previewImageUrl: m.url }];
    }
    if (content.kind === 'video' && content.media?.[0]) {
        const m = content.media[0];
        return [{ type: 'video', originalContentUrl: m.url, previewImageUrl: m.url }];
    }
    return [{ type: 'text', text: content.text ?? '' }];
}

export default lineAdapter;
