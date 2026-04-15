
'use server';

const DISCORD_BASE = 'https://discord.com/api/v10';

async function discordFetch(botToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Discord v2] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${DISCORD_BASE}${path}`, options);
    if (res.status === 204) return { success: true };
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Discord API error: ${res.status}`);
    }
    return data;
}

export async function executeDiscordV2Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const botToken = String(inputs.botToken ?? '').trim();
        if (!botToken) throw new Error('botToken is required.');
        const dc = (method: string, path: string, body?: any) => discordFetch(botToken, method, path, body, logger);

        switch (actionName) {
            case 'sendMessage': {
                const channelId = String(inputs.channelId ?? '').trim();
                if (!channelId) throw new Error('channelId is required.');
                const payload: any = {};
                if (inputs.content) payload.content = String(inputs.content);
                if (inputs.embeds) payload.embeds = typeof inputs.embeds === 'string' ? JSON.parse(inputs.embeds) : inputs.embeds;
                if (inputs.components) payload.components = typeof inputs.components === 'string' ? JSON.parse(inputs.components) : inputs.components;
                if (inputs.tts !== undefined) payload.tts = inputs.tts === true || inputs.tts === 'true';
                if (!payload.content && !payload.embeds) throw new Error('content or embeds is required.');
                const data = await dc('POST', `/channels/${channelId}/messages`, payload);
                return { output: { id: data.id ?? '', channelId: data.channel_id ?? channelId, content: data.content ?? '', timestamp: data.timestamp ?? '' } };
            }

            case 'createThread': {
                const channelId = String(inputs.channelId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!channelId) throw new Error('channelId is required.');
                if (!name) throw new Error('name is required.');
                const payload: any = { name };
                if (inputs.message) payload.message = { content: String(inputs.message) };
                if (inputs.autoArchiveDuration) payload.auto_archive_duration = Number(inputs.autoArchiveDuration);
                const data = await dc('POST', `/channels/${channelId}/threads`, payload);
                return { output: { id: data.id ?? '', name: data.name ?? name, type: String(data.type ?? '') } };
            }

            case 'addRole': {
                const guildId = String(inputs.guildId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                const roleId = String(inputs.roleId ?? '').trim();
                if (!guildId || !userId || !roleId) throw new Error('guildId, userId, and roleId are required.');
                await dc('PUT', `/guilds/${guildId}/members/${userId}/roles/${roleId}`);
                return { output: { success: 'true', guildId, userId, roleId } };
            }

            case 'removeRole': {
                const guildId = String(inputs.guildId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                const roleId = String(inputs.roleId ?? '').trim();
                if (!guildId || !userId || !roleId) throw new Error('guildId, userId, and roleId are required.');
                await dc('DELETE', `/guilds/${guildId}/members/${userId}/roles/${roleId}`);
                return { output: { success: 'true', guildId, userId, roleId } };
            }

            case 'listMembers': {
                const guildId = String(inputs.guildId ?? '').trim();
                if (!guildId) throw new Error('guildId is required.');
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.after) params.set('after', String(inputs.after));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dc('GET', `/guilds/${guildId}/members${qs}`);
                return { output: { count: String(data.length ?? 0), members: JSON.stringify(data) } };
            }

            case 'getGuild': {
                const guildId = String(inputs.guildId ?? '').trim();
                if (!guildId) throw new Error('guildId is required.');
                const data = await dc('GET', `/guilds/${guildId}`);
                return { output: { id: data.id ?? '', name: data.name ?? '', memberCount: String(data.approximate_member_count ?? 0), icon: data.icon ?? '' } };
            }

            case 'getChannel': {
                const channelId = String(inputs.channelId ?? '').trim();
                if (!channelId) throw new Error('channelId is required.');
                const data = await dc('GET', `/channels/${channelId}`);
                return { output: { id: data.id ?? '', name: data.name ?? '', type: String(data.type ?? ''), guildId: data.guild_id ?? '' } };
            }

            case 'deleteMessage': {
                const channelId = String(inputs.channelId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                if (!channelId || !messageId) throw new Error('channelId and messageId are required.');
                await dc('DELETE', `/channels/${channelId}/messages/${messageId}`);
                return { output: { success: 'true', messageId } };
            }

            case 'editMessage': {
                const channelId = String(inputs.channelId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                if (!channelId || !messageId) throw new Error('channelId and messageId are required.');
                const payload: any = {};
                if (inputs.content) payload.content = String(inputs.content);
                if (inputs.embeds) payload.embeds = typeof inputs.embeds === 'string' ? JSON.parse(inputs.embeds) : inputs.embeds;
                const data = await dc('PATCH', `/channels/${channelId}/messages/${messageId}`, payload);
                return { output: { id: data.id ?? messageId, content: data.content ?? '', timestamp: data.edited_timestamp ?? '' } };
            }

            default:
                return { error: `Discord v2 action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Discord v2 action failed.' };
    }
}
