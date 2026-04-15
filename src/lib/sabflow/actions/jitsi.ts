'use server';

export async function executeJitsiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const JAAS_BASE = 'https://api.8x8.com/jaas/v1';

        const jaasFetch = async (method: string, path: string, body?: any) => {
            const token = inputs.apiKey || inputs.accessToken;
            const res = await fetch(`${JAAS_BASE}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`JaaS API error ${res.status}: ${text}`);
            return text ? JSON.parse(text) : {};
        };

        const generateHS256Jwt = (payload: object, secret: string): string => {
            const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
            const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
            const crypto = require('crypto');
            const sig = crypto
                .createHmac('sha256', secret)
                .update(`${header}.${body}`)
                .digest('base64url');
            return `${header}.${body}.${sig}`;
        };

        switch (actionName) {
            case 'generateToken': {
                const now = Math.floor(Date.now() / 1000);
                const payload = {
                    iss: inputs.appId,
                    sub: inputs.sub || '*',
                    aud: inputs.aud || 'jitsi',
                    room: inputs.room || '*',
                    exp: inputs.exp || now + 3600,
                    nbf: inputs.nbf || now,
                    context: {
                        user: {
                            id: inputs.userId || user?._id?.toString(),
                            name: inputs.userName || user?.name,
                            email: inputs.userEmail || user?.email,
                            moderator: inputs.moderator ?? false,
                        },
                        features: { recording: inputs.recording ?? false, livestreaming: inputs.livestreaming ?? false },
                    },
                };
                const secret = inputs.privateKey || inputs.apiKey;
                const token = generateHS256Jwt(payload, secret);
                return { output: { token, payload } };
            }
            case 'createRoom': {
                const data = await jaasFetch('POST', `/${inputs.appId}/rooms`, {
                    name: inputs.name,
                    startTime: inputs.startTime,
                    endTime: inputs.endTime,
                });
                return { output: data };
            }
            case 'validateToken': {
                const data = await jaasFetch('POST', `/${inputs.appId}/rooms/validate-token`, {
                    token: inputs.token,
                });
                return { output: data };
            }
            case 'getUsage': {
                const qs = new URLSearchParams();
                if (inputs.from) qs.set('from', inputs.from);
                if (inputs.to) qs.set('to', inputs.to);
                const data = await jaasFetch('GET', `/${inputs.appId}/usage?${qs}`);
                return { output: data };
            }
            case 'listRooms': {
                const qs = new URLSearchParams();
                if (inputs.limit) qs.set('limit', String(inputs.limit));
                const data = await jaasFetch('GET', `/${inputs.appId}/rooms?${qs}`);
                return { output: data };
            }
            case 'getRoomInfo': {
                const data = await jaasFetch('GET', `/${inputs.appId}/rooms/${inputs.roomId}`);
                return { output: data };
            }
            case 'endMeeting': {
                const data = await jaasFetch('DELETE', `/${inputs.appId}/rooms/${inputs.roomId}`);
                return { output: data };
            }
            case 'getTranscript': {
                const data = await jaasFetch('GET', `/${inputs.appId}/transcripts/${inputs.transcriptId}`);
                return { output: data };
            }
            case 'listTranscripts': {
                const qs = new URLSearchParams();
                if (inputs.roomId) qs.set('roomId', inputs.roomId);
                if (inputs.limit) qs.set('limit', String(inputs.limit));
                const data = await jaasFetch('GET', `/${inputs.appId}/transcripts?${qs}`);
                return { output: data };
            }
            case 'getRecording': {
                const data = await jaasFetch('GET', `/${inputs.appId}/recordings/${inputs.recordingId}`);
                return { output: data };
            }
            case 'listRecordings': {
                const qs = new URLSearchParams();
                if (inputs.roomId) qs.set('roomId', inputs.roomId);
                if (inputs.limit) qs.set('limit', String(inputs.limit));
                const data = await jaasFetch('GET', `/${inputs.appId}/recordings?${qs}`);
                return { output: data };
            }
            case 'deleteRecording': {
                await jaasFetch('DELETE', `/${inputs.appId}/recordings/${inputs.recordingId}`);
                return { output: { success: true, recordingId: inputs.recordingId } };
            }
            case 'createWebhook': {
                const data = await jaasFetch('POST', `/${inputs.appId}/webhooks`, {
                    url: inputs.url,
                    events: inputs.events,
                    secret: inputs.secret,
                });
                return { output: data };
            }
            case 'listWebhooks': {
                const data = await jaasFetch('GET', `/${inputs.appId}/webhooks`);
                return { output: data };
            }
            case 'deleteWebhook': {
                await jaasFetch('DELETE', `/${inputs.appId}/webhooks/${inputs.webhookId}`);
                return { output: { success: true, webhookId: inputs.webhookId } };
            }
            default:
                return { error: `Unknown Jitsi action: ${actionName}` };
        }
    } catch (e: any) {
        logger.log(`Jitsi action error: ${e.message}`);
        return { error: e.message };
    }
}
