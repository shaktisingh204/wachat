'use server';

const TWITCH_HELIX = 'https://api.twitch.tv/helix';

export async function executeTwitchEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { accessToken, clientId } = inputs;

        const helixFetch = async (method: string, path: string, body?: any) => {
            const url = `${TWITCH_HELIX}${path}`;
            logger?.log(`[TwitchEnhanced] ${method} ${url}`);
            const opts: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Client-Id': clientId,
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
            case 'getUser': {
                const qs = inputs.login ? `?login=${encodeURIComponent(inputs.login)}` : inputs.userId ? `?id=${encodeURIComponent(inputs.userId)}` : '';
                const data = await helixFetch('GET', `/users${qs}`);
                return { output: { user: data.data?.[0] ?? null, raw: data } };
            }
            case 'getUsers': {
                const ids: string[] = inputs.ids || [];
                const logins: string[] = inputs.logins || [];
                const params = [...ids.map((i: string) => `id=${encodeURIComponent(i)}`), ...logins.map((l: string) => `login=${encodeURIComponent(l)}`)].join('&');
                const data = await helixFetch('GET', `/users?${params}`);
                return { output: { users: data.data, raw: data } };
            }
            case 'getStreams': {
                const params = new URLSearchParams();
                if (inputs.userId) params.set('user_id', inputs.userId);
                if (inputs.userLogin) params.set('user_login', inputs.userLogin);
                if (inputs.gameId) params.set('game_id', inputs.gameId);
                if (inputs.first) params.set('first', String(inputs.first));
                const data = await helixFetch('GET', `/streams?${params}`);
                return { output: { streams: data.data, pagination: data.pagination, raw: data } };
            }
            case 'getTopGames': {
                const params = new URLSearchParams();
                if (inputs.first) params.set('first', String(inputs.first));
                if (inputs.after) params.set('after', inputs.after);
                const data = await helixFetch('GET', `/games/top?${params}`);
                return { output: { games: data.data, pagination: data.pagination, raw: data } };
            }
            case 'getGames': {
                const ids: string[] = inputs.ids || [];
                const names: string[] = inputs.names || [];
                const params = [...ids.map((i: string) => `id=${encodeURIComponent(i)}`), ...names.map((n: string) => `name=${encodeURIComponent(n)}`)].join('&');
                const data = await helixFetch('GET', `/games?${params}`);
                return { output: { games: data.data, raw: data } };
            }
            case 'getChannel': {
                const data = await helixFetch('GET', `/channels?broadcaster_id=${encodeURIComponent(inputs.broadcasterId)}`);
                return { output: { channel: data.data?.[0] ?? null, raw: data } };
            }
            case 'modifyChannel': {
                const body: any = {};
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.gameId !== undefined) body.game_id = inputs.gameId;
                if (inputs.broadcasterLanguage !== undefined) body.broadcaster_language = inputs.broadcasterLanguage;
                const data = await helixFetch('PATCH', `/channels?broadcaster_id=${encodeURIComponent(inputs.broadcasterId)}`, body);
                return { output: { success: true, raw: data } };
            }
            case 'getClips': {
                const params = new URLSearchParams();
                if (inputs.broadcasterId) params.set('broadcaster_id', inputs.broadcasterId);
                if (inputs.gameId) params.set('game_id', inputs.gameId);
                if (inputs.id) params.set('id', inputs.id);
                if (inputs.first) params.set('first', String(inputs.first));
                const data = await helixFetch('GET', `/clips?${params}`);
                return { output: { clips: data.data, pagination: data.pagination, raw: data } };
            }
            case 'createClip': {
                const data = await helixFetch('POST', `/clips?broadcaster_id=${encodeURIComponent(inputs.broadcasterId)}`);
                return { output: { clip: data.data?.[0] ?? null, raw: data } };
            }
            case 'getVideos': {
                const params = new URLSearchParams();
                if (inputs.userId) params.set('user_id', inputs.userId);
                if (inputs.gameId) params.set('game_id', inputs.gameId);
                if (inputs.id) params.set('id', inputs.id);
                if (inputs.first) params.set('first', String(inputs.first));
                const data = await helixFetch('GET', `/videos?${params}`);
                return { output: { videos: data.data, pagination: data.pagination, raw: data } };
            }
            case 'getBroadcasterSubscriptions': {
                const params = new URLSearchParams({ broadcaster_id: inputs.broadcasterId });
                if (inputs.first) params.set('first', String(inputs.first));
                const data = await helixFetch('GET', `/subscriptions?${params}`);
                return { output: { subscriptions: data.data, total: data.total, pagination: data.pagination, raw: data } };
            }
            case 'getChannelFollowers': {
                const params = new URLSearchParams({ broadcaster_id: inputs.broadcasterId });
                if (inputs.first) params.set('first', String(inputs.first));
                const data = await helixFetch('GET', `/channels/followers?${params}`);
                return { output: { followers: data.data, total: data.total, pagination: data.pagination, raw: data } };
            }
            case 'sendChatMessage': {
                const data = await helixFetch('POST', '/chat/messages', {
                    broadcaster_id: inputs.broadcasterId,
                    sender_id: inputs.senderId,
                    message: inputs.message,
                });
                return { output: { result: data.data?.[0] ?? null, raw: data } };
            }
            case 'banUser': {
                const data = await helixFetch('POST', `/moderation/bans?broadcaster_id=${encodeURIComponent(inputs.broadcasterId)}&moderator_id=${encodeURIComponent(inputs.moderatorId)}`, {
                    data: {
                        user_id: inputs.userId,
                        duration: inputs.duration || undefined,
                        reason: inputs.reason || '',
                    },
                });
                return { output: { result: data.data?.[0] ?? null, raw: data } };
            }
            case 'addChannelModerator': {
                const data = await helixFetch('POST', `/moderation/moderators?broadcaster_id=${encodeURIComponent(inputs.broadcasterId)}&user_id=${encodeURIComponent(inputs.userId)}`);
                return { output: { success: true, raw: data } };
            }
            default:
                return { error: `TwitchEnhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger?.log(`[TwitchEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'TwitchEnhanced action failed' };
    }
}
