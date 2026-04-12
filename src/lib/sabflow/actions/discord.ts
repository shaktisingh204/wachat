
'use server';

import type { WithId, User } from '@/lib/definitions';
import axios from 'axios';
import { assertSafeOutboundUrl } from './url-guard';

const DISCORD_BASE = 'https://discord.com/api/v10';

function getDiscordToken(user: WithId<User>): string | null {
    const settings = (user as any).sabFlowConnections?.find((c: any) => c.appName === 'Discord');
    if (!settings?.credentials) return null;
    return String(
        settings.credentials.botToken ||
        settings.credentials.accessToken ||
        settings.credentials.apiKey ||
        ''
    ) || null;
}

function authHeaders(token: string) {
    // Bot tokens use "Bot <token>"; OAuth access tokens use "Bearer <token>"
    const prefix = /^[A-Za-z0-9_\-]+\./.test(token) ? 'Bot ' : 'Bearer ';
    return { Authorization: `${prefix}${token}`, 'Content-Type': 'application/json' };
}

export async function executeDiscordAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        switch (actionName) {
            case 'sendWebhook': {
                // Webhook URLs don't need a bot token
                const rawUrl = String(inputs.webhookUrl ?? '').trim();
                if (!rawUrl) throw new Error('webhookUrl is required.');
                if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(rawUrl)) {
                    throw new Error('webhookUrl must be a discord.com webhook URL.');
                }
                const safeUrl = await assertSafeOutboundUrl(rawUrl);
                const body: any = { content: String(inputs.content ?? '') };
                if (inputs.username) body.username = String(inputs.username);
                const res = await axios.post(safeUrl.toString(), body);
                logger.log(`[Discord] Webhook posted`);
                return { output: { ok: String(res.status >= 200 && res.status < 300) } };
            }

            case 'sendMessage': {
                const token = getDiscordToken(user);
                if (!token) throw new Error('Discord is not connected.');
                const channelId = String(inputs.channelId ?? '').trim();
                const message = String(inputs.message ?? '');
                if (!channelId) throw new Error('channelId is required.');
                if (!message) throw new Error('message is required.');
                const res = await axios.post(
                    `${DISCORD_BASE}/channels/${channelId}/messages`,
                    { content: message },
                    { headers: authHeaders(token) }
                );
                return { output: { messageId: res.data?.id } };
            }

            case 'sendEmbed': {
                const token = getDiscordToken(user);
                if (!token) throw new Error('Discord is not connected.');
                const channelId = String(inputs.channelId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!channelId || !title) throw new Error('channelId and title are required.');
                const embed: any = { title };
                if (inputs.description) embed.description = String(inputs.description);
                if (inputs.color) embed.color = Number(inputs.color);
                if (inputs.url) embed.url = String(inputs.url);
                const res = await axios.post(
                    `${DISCORD_BASE}/channels/${channelId}/messages`,
                    { embeds: [embed] },
                    { headers: authHeaders(token) }
                );
                return { output: { messageId: res.data?.id } };
            }

            case 'createThread': {
                const token = getDiscordToken(user);
                if (!token) throw new Error('Discord is not connected.');
                const channelId = String(inputs.channelId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!channelId || !name) throw new Error('channelId and name are required.');
                const res = await axios.post(
                    `${DISCORD_BASE}/channels/${channelId}/threads`,
                    { name, type: 11 /* PUBLIC_THREAD */ },
                    { headers: authHeaders(token) }
                );
                return { output: { threadId: res.data?.id } };
            }

            default:
                return { error: `Discord action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.response?.data?.message || e.message || 'Discord action failed.';
        return { error: msg };
    }
}
