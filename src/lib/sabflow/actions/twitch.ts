
'use server';

const TWITCH_BASE = 'https://api.twitch.tv/helix';

async function twitchFetch(
    accessToken: string,
    clientId: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${TWITCH_BASE}${path}`;
    logger?.log(`[Twitch] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': clientId,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (res.status === 204) return { success: true };

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Twitch API error: ${res.status}`);
    }
    return data;
}

export async function executeTwitchAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const clientId = String(inputs.clientId ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        if (!clientId) throw new Error('clientId is required.');

        const tw = (method: string, path: string, body?: any) =>
            twitchFetch(accessToken, clientId, method, path, body, logger);

        switch (actionName) {
            case 'getUser': {
                const params: string[] = [];
                if (inputs.login) params.push(`login=${encodeURIComponent(String(inputs.login))}`);

                const data = await tw('GET', `/users${params.length ? '?' + params.join('&') : ''}`);
                const u = data.data?.[0];
                if (!u) throw new Error('User not found.');
                return {
                    output: {
                        id: u.id,
                        login: u.login,
                        displayName: u.display_name,
                        type: u.type,
                        broadcasterType: u.broadcaster_type,
                        description: u.description,
                        profileImageUrl: u.profile_image_url,
                        viewCount: u.view_count,
                    },
                };
            }

            case 'getStream': {
                const login = String(inputs.login ?? '').trim();
                if (!login) throw new Error('login is required.');

                const data = await tw('GET', `/streams?user_login=${encodeURIComponent(login)}`);
                const stream = data.data?.[0];
                if (!stream) return { output: { live: false, stream: null } };
                return {
                    output: {
                        id: stream.id,
                        title: stream.title,
                        viewerCount: stream.viewer_count,
                        gameName: stream.game_name,
                        gameId: stream.game_id,
                        startedAt: stream.started_at,
                        thumbnailUrl: stream.thumbnail_url,
                        live: true,
                    },
                };
            }

            case 'searchChannels': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');

                const params = [`query=${encodeURIComponent(query)}`];
                if (inputs.liveOnly === true || inputs.liveOnly === 'true') params.push('live_only=true');

                const data = await tw('GET', `/search/channels?${params.join('&')}`);
                const channels = data.data ?? [];
                return { output: { channels, count: channels.length } };
            }

            case 'getTopGames': {
                const first = Number(inputs.first ?? 20);
                const data = await tw('GET', `/games/top?first=${first}`);
                const games = data.data ?? [];
                return { output: { games, count: games.length } };
            }

            case 'getGame': {
                const gameId = String(inputs.gameId ?? '').trim();
                if (!gameId) throw new Error('gameId is required.');

                const data = await tw('GET', `/games?id=${encodeURIComponent(gameId)}`);
                const game = data.data?.[0];
                if (!game) throw new Error('Game not found.');
                return { output: { id: game.id, name: game.name, boxArtUrl: game.box_art_url } };
            }

            case 'listFollowers': {
                const fromId = String(inputs.fromId ?? '').trim();
                if (!fromId) throw new Error('fromId is required.');

                const params = [`from_id=${encodeURIComponent(fromId)}`];
                if (inputs.toId) params.push(`to_id=${encodeURIComponent(String(inputs.toId))}`);

                const data = await tw('GET', `/users/follows?${params.join('&')}`);
                const followers = data.data ?? [];
                return { output: { followers, total: data.total ?? followers.length } };
            }

            case 'getClips': {
                const broadcasterId = String(inputs.broadcasterId ?? '').trim();
                if (!broadcasterId) throw new Error('broadcasterId is required.');

                const first = Number(inputs.first ?? 20);
                const data = await tw('GET', `/clips?broadcaster_id=${encodeURIComponent(broadcasterId)}&first=${first}`);
                const clips = data.data ?? [];
                return { output: { clips, count: clips.length } };
            }

            case 'createClip': {
                const broadcasterId = String(inputs.broadcasterId ?? '').trim();
                if (!broadcasterId) throw new Error('broadcasterId is required.');

                const data = await tw('POST', `/clips?broadcaster_id=${encodeURIComponent(broadcasterId)}`);
                const clip = data.data?.[0];
                if (!clip) throw new Error('Failed to create clip.');
                return { output: { id: clip.id, editUrl: clip.edit_url } };
            }

            case 'listVideos': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');

                const params = [`user_id=${encodeURIComponent(userId)}`];
                if (inputs.type) params.push(`type=${encodeURIComponent(String(inputs.type))}`);

                const data = await tw('GET', `/videos?${params.join('&')}`);
                const videos = data.data ?? [];
                return { output: { videos, count: videos.length } };
            }

            case 'getBroadcasterSubscriptions': {
                const broadcasterId = String(inputs.broadcasterId ?? '').trim();
                if (!broadcasterId) throw new Error('broadcasterId is required.');

                const data = await tw('GET', `/subscriptions?broadcaster_id=${encodeURIComponent(broadcasterId)}`);
                const subscriptions = data.data ?? [];
                return { output: { subscriptions, total: data.total ?? subscriptions.length, points: data.points ?? 0 } };
            }

            case 'sendChatMessage': {
                const broadcasterId = String(inputs.broadcasterId ?? '').trim();
                const senderId = String(inputs.senderId ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!broadcasterId) throw new Error('broadcasterId is required.');
                if (!senderId) throw new Error('senderId is required.');
                if (!message) throw new Error('message is required.');

                const data = await tw('POST', '/chat/messages', {
                    broadcaster_id: broadcasterId,
                    sender_id: senderId,
                    message,
                });
                const msg = data.data?.[0];
                return { output: { messageId: msg?.message_id ?? '', isSent: msg?.is_sent ?? false } };
            }

            case 'getBans': {
                const broadcasterId = String(inputs.broadcasterId ?? '').trim();
                if (!broadcasterId) throw new Error('broadcasterId is required.');

                const data = await tw('GET', `/moderation/banned?broadcaster_id=${encodeURIComponent(broadcasterId)}`);
                const bans = data.data ?? [];
                return { output: { bans, count: bans.length } };
            }

            case 'createPrediction': {
                const broadcasterId = String(inputs.broadcasterId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const duration = Number(inputs.duration ?? 60);
                if (!broadcasterId) throw new Error('broadcasterId is required.');
                if (!title) throw new Error('title is required.');
                if (!inputs.outcomes) throw new Error('outcomes is required.');

                let outcomes: { title: string }[];
                if (Array.isArray(inputs.outcomes)) {
                    outcomes = inputs.outcomes.map((o: any) => ({ title: String(typeof o === 'string' ? o : o.title) }));
                } else {
                    outcomes = String(inputs.outcomes).split(',').map((o: string) => ({ title: o.trim() })).filter((o) => o.title);
                }
                if (outcomes.length < 2) throw new Error('At least 2 outcomes are required.');

                const data = await tw('POST', '/predictions', {
                    broadcaster_id: broadcasterId,
                    title,
                    outcomes,
                    prediction_window: duration,
                });
                const prediction = data.data?.[0];
                if (!prediction) throw new Error('Failed to create prediction.');
                return { output: { id: prediction.id, title: prediction.title, status: prediction.status } };
            }

            case 'endPrediction': {
                const broadcasterId = String(inputs.broadcasterId ?? '').trim();
                const predictionId = String(inputs.predictionId ?? '').trim();
                const status = String(inputs.status ?? '').trim().toUpperCase(); // RESOLVED, CANCELED, LOCKED
                if (!broadcasterId) throw new Error('broadcasterId is required.');
                if (!predictionId) throw new Error('predictionId is required.');
                if (!status) throw new Error('status is required.');

                const body: any = {
                    broadcaster_id: broadcasterId,
                    id: predictionId,
                    status,
                };
                if (status === 'RESOLVED') {
                    const winningOutcomeId = String(inputs.winningOutcomeId ?? '').trim();
                    if (!winningOutcomeId) throw new Error('winningOutcomeId is required when status is RESOLVED.');
                    body.winning_outcome_id = winningOutcomeId;
                }

                const data = await tw('PATCH', '/predictions', body);
                const prediction = data.data?.[0];
                if (!prediction) throw new Error('Failed to end prediction.');
                return { output: { id: prediction.id, status: prediction.status } };
            }

            default:
                return { error: `Twitch action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Twitch action failed.' };
    }
}
