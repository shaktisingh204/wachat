'use server';

export async function executeLiveKitAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const BASE = inputs.livekitUrl?.replace(/\/$/, '') || 'https://your-livekit-server.com';

        // Build a signed JWT for LiveKit API authentication
        const buildLiveKitToken = async (apiKey: string, apiSecret: string, claims: any): Promise<string> => {
            const header = { alg: 'HS256', typ: 'JWT' };
            const now = Math.floor(Date.now() / 1000);
            const payload = {
                iss: apiKey,
                nbf: now,
                exp: now + 3600,
                ...claims,
            };
            const enc = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
            const signingInput = `${enc(header)}.${enc(payload)}`;
            const { createHmac } = await import('crypto');
            const sig = createHmac('sha256', apiSecret).update(signingInput).digest('base64url');
            return `${signingInput}.${sig}`;
        };

        const getToken = async (claims?: any) =>
            buildLiveKitToken(inputs.apiKey, inputs.apiSecret, {
                video: { roomCreate: true, roomList: true, roomAdmin: true, roomJoin: true },
                ...claims,
            });

        const lkFetch = async (method: string, path: string, body?: any, tokenClaims?: any) => {
            const token = await getToken(tokenClaims);
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`LiveKit API error ${res.status}: ${text}`);
            return text ? JSON.parse(text) : {};
        };

        switch (actionName) {
            case 'createRoom': {
                const body: any = {
                    name: inputs.name,
                    empty_timeout: inputs.emptyTimeout,
                    max_participants: inputs.maxParticipants,
                    metadata: inputs.metadata,
                    egress: inputs.egress,
                };
                const data = await lkFetch('POST', '/twirp/livekit.RoomService/CreateRoom', body);
                return { output: data };
            }
            case 'listRooms': {
                const body: any = { names: inputs.names };
                const data = await lkFetch('POST', '/twirp/livekit.RoomService/ListRooms', body);
                return { output: data };
            }
            case 'deleteRoom': {
                const body: any = { room: inputs.room };
                const data = await lkFetch('POST', '/twirp/livekit.RoomService/DeleteRoom', body);
                return { output: data };
            }
            case 'updateRoom': {
                const body: any = {
                    room: inputs.room,
                    metadata: inputs.metadata,
                };
                const data = await lkFetch('POST', '/twirp/livekit.RoomService/UpdateRoomMetadata', body);
                return { output: data };
            }
            case 'listParticipants': {
                const body: any = { room: inputs.room };
                const data = await lkFetch('POST', '/twirp/livekit.RoomService/ListParticipants', body);
                return { output: data };
            }
            case 'getParticipant': {
                const body: any = { room: inputs.room, identity: inputs.identity };
                const data = await lkFetch('POST', '/twirp/livekit.RoomService/GetParticipant', body);
                return { output: data };
            }
            case 'removeParticipant': {
                const body: any = { room: inputs.room, identity: inputs.identity };
                const data = await lkFetch('POST', '/twirp/livekit.RoomService/RemoveParticipant', body);
                return { output: data };
            }
            case 'muteParticipant': {
                const body: any = {
                    room: inputs.room,
                    identity: inputs.identity,
                    track_sid: inputs.trackSid,
                    muted: inputs.muted ?? true,
                };
                const data = await lkFetch('POST', '/twirp/livekit.RoomService/MutePublishedTrack', body);
                return { output: data };
            }
            case 'updateParticipant': {
                const body: any = {
                    room: inputs.room,
                    identity: inputs.identity,
                    metadata: inputs.metadata,
                    permission: inputs.permission,
                    name: inputs.name,
                };
                const data = await lkFetch('POST', '/twirp/livekit.RoomService/UpdateParticipant', body);
                return { output: data };
            }
            case 'createToken': {
                const token = await buildLiveKitToken(inputs.apiKey, inputs.apiSecret, {
                    sub: inputs.identity || `user-${Date.now()}`,
                    name: inputs.name,
                    video: {
                        roomJoin: true,
                        room: inputs.room,
                        canPublish: inputs.canPublish ?? true,
                        canSubscribe: inputs.canSubscribe ?? true,
                        canPublishData: inputs.canPublishData ?? true,
                        ...inputs.videoGrants,
                    },
                    metadata: inputs.metadata,
                });
                return { output: { token } };
            }
            case 'listTokens': {
                // LiveKit doesn't have a native list tokens endpoint; return config info
                return { output: { apiKey: inputs.apiKey, livekitUrl: BASE, message: 'Tokens are JWTs — list not available server-side.' } };
            }
            case 'sendData': {
                const body: any = {
                    room: inputs.room,
                    data: Buffer.from(typeof inputs.data === 'string' ? inputs.data : JSON.stringify(inputs.data)).toString('base64'),
                    kind: inputs.kind || 1,
                    destination_sids: inputs.destinationSids,
                    destination_identities: inputs.destinationIdentities,
                    topic: inputs.topic,
                };
                const data = await lkFetch('POST', '/twirp/livekit.RoomService/SendData', body);
                return { output: data };
            }
            case 'updateSubscriptions': {
                const body: any = {
                    room: inputs.room,
                    identity: inputs.identity,
                    track_sids: inputs.trackSids,
                    subscribe: inputs.subscribe ?? true,
                };
                const data = await lkFetch('POST', '/twirp/livekit.RoomService/UpdateSubscriptions', body);
                return { output: data };
            }
            case 'createIngress': {
                const body: any = {
                    input_type: inputs.inputType ?? 0,
                    url: inputs.url,
                    name: inputs.name,
                    room_name: inputs.roomName,
                    participant_identity: inputs.participantIdentity,
                    participant_name: inputs.participantName,
                    bypass_transcoding: inputs.bypassTranscoding ?? false,
                    audio: inputs.audio,
                    video: inputs.video,
                };
                const data = await lkFetch('POST', '/twirp/livekit.Ingress/CreateIngress', body);
                return { output: data };
            }
            case 'listIngress': {
                const body: any = {
                    room_name: inputs.roomName,
                    ingress_id: inputs.ingressId,
                };
                const data = await lkFetch('POST', '/twirp/livekit.Ingress/ListIngress', body);
                return { output: data };
            }
            default:
                return { error: `LiveKit: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`LiveKit action error: ${err.message}`);
        return { error: err.message };
    }
}
