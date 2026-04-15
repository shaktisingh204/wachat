'use server';

const DISCORD_BASE = 'https://discord.com/api/v10';

export async function executeDiscordEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { botToken } = inputs;

        const discordFetch = async (method: string, path: string, body?: any) => {
            const url = `${DISCORD_BASE}${path}`;
            logger?.log(`[DiscordEnhanced] ${method} ${url}`);
            const opts: RequestInit = {
                method,
                headers: {
                    Authorization: `Bot ${botToken}`,
                    'Content-Type': 'application/json',
                },
            };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(url, opts);
            if (res.status === 204) return { success: true };
            const text = await res.text();
            let json: any;
            try { json = JSON.parse(text); } catch { json = { raw: text }; }
            if (!res.ok) throw new Error(json?.message || json?.error || text);
            return json;
        };

        switch (actionName) {
            case 'sendMessage': {
                const data = await discordFetch('POST', `/channels/${encodeURIComponent(inputs.channelId)}/messages`, {
                    content: inputs.content,
                    embeds: inputs.embeds,
                    components: inputs.components,
                    tts: inputs.tts ?? false,
                });
                return { output: { message: data, messageId: data.id, raw: data } };
            }
            case 'editMessage': {
                const data = await discordFetch('PATCH', `/channels/${encodeURIComponent(inputs.channelId)}/messages/${encodeURIComponent(inputs.messageId)}`, {
                    content: inputs.content,
                    embeds: inputs.embeds,
                    components: inputs.components,
                });
                return { output: { message: data, raw: data } };
            }
            case 'deleteMessage': {
                const data = await discordFetch('DELETE', `/channels/${encodeURIComponent(inputs.channelId)}/messages/${encodeURIComponent(inputs.messageId)}`);
                return { output: { success: true, raw: data } };
            }
            case 'createThread': {
                const body: any = {
                    name: inputs.name,
                    auto_archive_duration: inputs.autoArchiveDuration || 1440,
                    type: inputs.type || 11, // 11 = PUBLIC_THREAD
                };
                if (inputs.messageId) {
                    // Thread from existing message
                    const data = await discordFetch('POST', `/channels/${encodeURIComponent(inputs.channelId)}/messages/${encodeURIComponent(inputs.messageId)}/threads`, body);
                    return { output: { thread: data, threadId: data.id, raw: data } };
                } else {
                    // Standalone thread (forum / news)
                    const data = await discordFetch('POST', `/channels/${encodeURIComponent(inputs.channelId)}/threads`, body);
                    return { output: { thread: data, threadId: data.id, raw: data } };
                }
            }
            case 'listChannels': {
                const data = await discordFetch('GET', `/guilds/${encodeURIComponent(inputs.guildId)}/channels`);
                return { output: { channels: data, count: Array.isArray(data) ? data.length : 0, raw: data } };
            }
            case 'createChannel': {
                const body: any = {
                    name: inputs.name,
                    type: inputs.type ?? 0, // 0 = GUILD_TEXT
                };
                if (inputs.topic) body.topic = inputs.topic;
                if (inputs.parentId) body.parent_id = inputs.parentId;
                if (inputs.position !== undefined) body.position = inputs.position;
                const data = await discordFetch('POST', `/guilds/${encodeURIComponent(inputs.guildId)}/channels`, body);
                return { output: { channel: data, channelId: data.id, raw: data } };
            }
            case 'deleteChannel': {
                const data = await discordFetch('DELETE', `/channels/${encodeURIComponent(inputs.channelId)}`);
                return { output: { success: true, channel: data, raw: data } };
            }
            case 'getGuild': {
                const data = await discordFetch('GET', `/guilds/${encodeURIComponent(inputs.guildId)}`);
                return { output: { guild: data, raw: data } };
            }
            case 'listGuildMembers': {
                const params = new URLSearchParams({ limit: String(inputs.limit || 100) });
                if (inputs.after) params.set('after', inputs.after);
                const data = await discordFetch('GET', `/guilds/${encodeURIComponent(inputs.guildId)}/members?${params}`);
                return { output: { members: data, count: Array.isArray(data) ? data.length : 0, raw: data } };
            }
            case 'kickMember': {
                const data = await discordFetch('DELETE', `/guilds/${encodeURIComponent(inputs.guildId)}/members/${encodeURIComponent(inputs.userId)}`);
                return { output: { success: true, raw: data } };
            }
            case 'banMember': {
                const body: any = {};
                if (inputs.deleteMessageSeconds !== undefined) body.delete_message_seconds = inputs.deleteMessageSeconds;
                const data = await discordFetch('PUT', `/guilds/${encodeURIComponent(inputs.guildId)}/bans/${encodeURIComponent(inputs.userId)}`, body);
                return { output: { success: true, raw: data } };
            }
            case 'unbanMember': {
                const data = await discordFetch('DELETE', `/guilds/${encodeURIComponent(inputs.guildId)}/bans/${encodeURIComponent(inputs.userId)}`);
                return { output: { success: true, raw: data } };
            }
            case 'createRole': {
                const body: any = { name: inputs.name };
                if (inputs.permissions) body.permissions = inputs.permissions;
                if (inputs.color) body.color = inputs.color;
                if (inputs.hoist !== undefined) body.hoist = inputs.hoist;
                if (inputs.mentionable !== undefined) body.mentionable = inputs.mentionable;
                const data = await discordFetch('POST', `/guilds/${encodeURIComponent(inputs.guildId)}/roles`, body);
                return { output: { role: data, roleId: data.id, raw: data } };
            }
            case 'assignRole': {
                const data = await discordFetch('PUT', `/guilds/${encodeURIComponent(inputs.guildId)}/members/${encodeURIComponent(inputs.userId)}/roles/${encodeURIComponent(inputs.roleId)}`);
                return { output: { success: true, raw: data } };
            }
            case 'sendWebhookMessage': {
                // Uses webhook URL directly
                const webhookUrl = inputs.webhookUrl;
                if (!webhookUrl) throw new Error('webhookUrl is required for sendWebhookMessage');
                logger?.log(`[DiscordEnhanced] POST ${webhookUrl}`);
                const res = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: inputs.content,
                        username: inputs.username,
                        avatar_url: inputs.avatarUrl,
                        embeds: inputs.embeds,
                        components: inputs.components,
                    }),
                });
                if (res.status === 204) return { output: { success: true } };
                const text = await res.text();
                let json: any;
                try { json = JSON.parse(text); } catch { json = { raw: text }; }
                if (!res.ok) throw new Error(json?.message || text);
                return { output: { message: json, raw: json } };
            }
            default:
                return { error: `DiscordEnhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger?.log(`[DiscordEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'DiscordEnhanced action failed' };
    }
}
