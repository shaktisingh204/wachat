/**
 * Discord adapter — supports two transports:
 *   1. Webhook (most common for one-way notifications, just needs a webhook URL).
 *   2. Bot REST API (channel.id + bot token, supports threads & reactions).
 *
 * `creds.webhookUrl` takes precedence; if absent we fall back to the bot path.
 */

import {
    ChannelAdapter,
    ChannelCredentials,
    ChannelError,
    ContactRef,
    MessageContent,
    SendOptions,
    SendResult,
} from '../types';

interface DiscordCreds extends ChannelCredentials {
    webhookUrl?: string;
    botToken?: string;
}

const DISCORD_API = 'https://discord.com/api/v10';

export const discordAdapter: ChannelAdapter = {
    channel: 'discord',
    displayName: 'Discord',

    async send(
        creds: ChannelCredentials,
        to: ContactRef,
        content: MessageContent,
        opts?: SendOptions,
    ): Promise<SendResult> {
        const c = creds as DiscordCreds;

        const payload: Record<string, unknown> = {
            content: content.text ?? '',
            embeds: content.raw?.embeds,
            allowed_mentions: { parse: [] }, // safe default — explicit opt-in
        };

        if (c.webhookUrl) {
            const res = await fetch(`${c.webhookUrl}?wait=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new ChannelError({
                    channel: 'discord',
                    code: `HTTP_${res.status}`,
                    message: `Discord webhook failed: ${text}`,
                    retryable: res.status >= 500,
                });
            }
            const json = (await res.json().catch(() => ({}))) as { id?: string };
            return {
                messageId: opts?.idempotencyKey ?? json.id ?? `dc_${Date.now()}`,
                providerMessageId: json.id,
                status: 'sent',
            };
        }

        if (!c.botToken) {
            throw new ChannelError({
                channel: 'discord',
                code: 'MISSING_CREDENTIALS',
                message: 'Discord adapter requires `webhookUrl` or `botToken`',
            });
        }

        // Bot path: `to.address` is a channel id.
        const res = await fetch(
            `${DISCORD_API}/channels/${encodeURIComponent(to.address)}/messages`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bot ${c.botToken}`,
                    'Content-Type': 'application/json',
                    ...(opts?.idempotencyKey
                        ? { 'X-Idempotency-Key': opts.idempotencyKey }
                        : {}),
                },
                body: JSON.stringify(payload),
            },
        );
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new ChannelError({
                channel: 'discord',
                code: `HTTP_${res.status}`,
                message: `Discord bot send failed: ${text}`,
                retryable: res.status >= 500,
            });
        }
        const json = (await res.json().catch(() => ({}))) as { id?: string };
        return {
            messageId: opts?.idempotencyKey ?? json.id ?? `dc_${Date.now()}`,
            providerMessageId: json.id,
            status: 'sent',
        };
    },
};

export default discordAdapter;
