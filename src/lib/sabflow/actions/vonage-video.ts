'use server';

import { createHmac } from 'crypto';

export async function executeVonageVideoAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiKey, apiSecret } = inputs;
        if (!apiKey) return { error: 'VonageVideo: apiKey is required.' };
        if (!apiSecret) return { error: 'VonageVideo: apiSecret is required.' };

        const baseUrl = 'https://api.opentok.com';

        function generateJwt(): string {
            const now = Math.floor(Date.now() / 1000);
            const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
            const payload = Buffer.from(JSON.stringify({
                iss: apiKey,
                ist: 'project',
                iat: now,
                exp: now + 300,
                jti: `${now}-${Math.random().toString(36).substr(2, 9)}`,
            })).toString('base64url');
            const signingInput = `${header}.${payload}`;
            const sig = createHmac('sha256', apiSecret).update(signingInput).digest('base64url');
            return `${signingInput}.${sig}`;
        }

        function generateClientToken(opts: {
            role?: string;
            expireTime?: number;
            data?: string;
            sessionId?: string;
        } = {}): string {
            const now = Math.floor(Date.now() / 1000);
            const nonce = Math.random().toString(36).substr(2, 9);
            const role = opts.role ?? 'publisher';
            const expireTime = opts.expireTime ?? now + 3600;
            const data = opts.data ?? '';
            const sessionId = opts.sessionId ?? '';
            const dataString = [
                `role=${role}`,
                `expire_time=${expireTime}`,
                `connection_data=${data}`,
                `nonce=${nonce}`,
                `create_time=${now}`,
                `partner_id=${apiKey}`,
                `session_id=${sessionId}`,
            ].join('&');
            const sig = createHmac('sha256', apiSecret).update(dataString).digest('hex');
            const payload = `${dataString}&sig=${sig}`;
            const encoded = Buffer.from(payload).toString('base64');
            return `T1==${encoded}`;
        }

        async function apiGet(path: string): Promise<any> {
            const jwt = generateJwt();
            const res = await fetch(`${baseUrl}${path}`, {
                method: 'GET',
                headers: {
                    'X-OPENTOK-AUTH': jwt,
                    'Accept': 'application/json',
                },
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || JSON.stringify(data) || `VonageVideo error: ${res.status}`);
            return data;
        }

        async function apiPost(path: string, body: any, formData = false): Promise<any> {
            const jwt = generateJwt();
            let reqBody: string;
            let contentType: string;
            if (formData) {
                const params = new URLSearchParams(body);
                reqBody = params.toString();
                contentType = 'application/x-www-form-urlencoded';
            } else {
                reqBody = JSON.stringify(body);
                contentType = 'application/json';
            }
            const res = await fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers: {
                    'X-OPENTOK-AUTH': jwt,
                    'Content-Type': contentType,
                    'Accept': 'application/json',
                },
                body: reqBody,
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || JSON.stringify(data) || `VonageVideo error: ${res.status}`);
            return data;
        }

        async function apiDelete(path: string): Promise<any> {
            const jwt = generateJwt();
            const res = await fetch(`${baseUrl}${path}`, {
                method: 'DELETE',
                headers: { 'X-OPENTOK-AUTH': jwt },
            });
            if (res.status === 204) return { success: true };
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || JSON.stringify(data) || `VonageVideo error: ${res.status}`);
            return data;
        }

        logger.log(`Executing VonageVideo action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'createSession': {
                const { mediaMode = 'routed', archiveMode = 'manual' } = inputs;
                const body: any = { p2p: { preference: mediaMode === 'relayed' ? 'enabled' : 'disabled' }, archiveMode };
                const data = await apiPost('/session/create', body, true);
                const session = Array.isArray(data) ? data[0] : data;
                return { output: { sessionId: session?.session_id, createDt: session?.create_dt } };
            }

            case 'getSession': {
                const { sessionId } = inputs;
                if (!sessionId) return { error: 'VonageVideo getSession: sessionId is required.' };
                const data = await apiGet(`/session/${sessionId}/info`);
                return { output: { session: data } };
            }

            case 'generateToken': {
                const { sessionId, role, expireTime, data: connectionData } = inputs;
                if (!sessionId) return { error: 'VonageVideo generateToken: sessionId is required.' };
                const expTime = expireTime ? parseInt(expireTime) : undefined;
                const token = generateClientToken({ role, expireTime: expTime, data: connectionData, sessionId });
                return { output: { token, sessionId, role: role ?? 'publisher' } };
            }

            case 'startArchive': {
                const { sessionId, name, hasVideo = true, hasAudio = true, outputMode = 'composed' } = inputs;
                if (!sessionId) return { error: 'VonageVideo startArchive: sessionId is required.' };
                const body: any = { sessionId, hasVideo, hasAudio, outputMode };
                if (name) body.name = name;
                const data = await apiPost(`/v2/project/${apiKey}/archive`, body);
                return { output: { archiveId: data.id, status: data.status, sessionId: data.sessionId } };
            }

            case 'stopArchive': {
                const { archiveId } = inputs;
                if (!archiveId) return { error: 'VonageVideo stopArchive: archiveId is required.' };
                const data = await apiPost(`/v2/project/${apiKey}/archive/${archiveId}/stop`, {});
                return { output: { archiveId: data.id, status: data.status, duration: data.duration } };
            }

            case 'getArchive': {
                const { archiveId } = inputs;
                if (!archiveId) return { error: 'VonageVideo getArchive: archiveId is required.' };
                const data = await apiGet(`/v2/project/${apiKey}/archive/${archiveId}`);
                return { output: { archive: data } };
            }

            case 'listArchives': {
                const { offset = 0, count = 50, sessionId } = inputs;
                let path = `/v2/project/${apiKey}/archive?offset=${offset}&count=${count}`;
                if (sessionId) path += `&sessionId=${sessionId}`;
                const data = await apiGet(path);
                return { output: { archives: data.items ?? data, count: data.count } };
            }

            case 'deleteArchive': {
                const { archiveId } = inputs;
                if (!archiveId) return { error: 'VonageVideo deleteArchive: archiveId is required.' };
                const data = await apiDelete(`/v2/project/${apiKey}/archive/${archiveId}`);
                return { output: data };
            }

            case 'startBroadcast': {
                const { sessionId, hls, rtmp, maxDuration = 7200, resolution = '640x480' } = inputs;
                if (!sessionId) return { error: 'VonageVideo startBroadcast: sessionId is required.' };
                const body: any = {
                    sessionId,
                    maxDuration,
                    resolution,
                    outputs: {},
                };
                if (hls) body.outputs.hls = {};
                if (rtmp) body.outputs.rtmp = Array.isArray(rtmp) ? rtmp : [rtmp];
                const data = await apiPost(`/v2/project/${apiKey}/broadcast`, body);
                return { output: { broadcastId: data.id, status: data.status, broadcastUrls: data.broadcastUrls } };
            }

            case 'stopBroadcast': {
                const { broadcastId } = inputs;
                if (!broadcastId) return { error: 'VonageVideo stopBroadcast: broadcastId is required.' };
                const data = await apiPost(`/v2/project/${apiKey}/broadcast/${broadcastId}/stop`, {});
                return { output: { broadcastId: data.id, status: data.status } };
            }

            default:
                return { error: `VonageVideo: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`VonageVideo action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'VonageVideo: An unexpected error occurred.' };
    }
}
