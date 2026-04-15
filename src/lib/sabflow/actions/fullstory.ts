
'use server';

export async function executeFullStoryAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const base = 'https://api.fullstory.com';
        const serverId = inputs.serverId ? String(inputs.serverId).trim() : null;

        async function fullstoryFetch(method: string, url: string, body?: any) {
            logger?.log(`[FullStory] ${method} ${url}`);
            const credentials = Buffer.from(`${apiKey}:`).toString('base64');
            const headers: Record<string, string> = {
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            };
            if (serverId) headers['FS-Org'] = serverId;
            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) {
                const msg = data?.message || data?.error || `FullStory API error: ${res.status}`;
                throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
            }
            return data;
        }

        switch (actionName) {
            case 'getUser': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                const data = await fullstoryFetch('GET', `${base}/v2/users/${uid}`);
                return { output: { user: data } };
            }

            case 'setUserProperties': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                const body: any = { uid };
                if (inputs.displayName) body.displayName = String(inputs.displayName);
                if (inputs.email) body.email = String(inputs.email);
                if (inputs.userVars && typeof inputs.userVars === 'object') body.userVars = inputs.userVars;
                const data = await fullstoryFetch('POST', `${base}/v2/users/`, body);
                return { output: { user: data } };
            }

            case 'deleteUser': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                const data = await fullstoryFetch('DELETE', `${base}/v2/users/${uid}`);
                return { output: { message: 'User deleted successfully', result: data } };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.email) params.set('email', String(inputs.email));
                if (inputs.uid) params.set('uid', String(inputs.uid));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await fullstoryFetch('GET', `${base}/v2/users${qs}`);
                return { output: { users: data?.results ?? data ?? [] } };
            }

            case 'getSession': {
                const sessionId = String(inputs.sessionId ?? '').trim();
                if (!sessionId) throw new Error('sessionId is required.');
                const data = await fullstoryFetch('GET', `${base}/v2/sessions/${sessionId}`);
                return { output: { session: data } };
            }

            case 'listSessions': {
                const params = new URLSearchParams();
                if (inputs.uid) params.set('uid', String(inputs.uid));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await fullstoryFetch('GET', `${base}/v2/sessions${qs}`);
                return { output: { sessions: data?.results ?? data ?? [] } };
            }

            case 'getEvents': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const body: any = { userId };
                if (inputs.startTime) body.startTime = inputs.startTime;
                if (inputs.endTime) body.endTime = inputs.endTime;
                const data = await fullstoryFetch('POST', `${base}/v2/events`, body);
                return { output: { events: data?.results ?? data ?? [] } };
            }

            case 'serverEvent': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required for serverEvent.');
                const events = inputs.events;
                if (!Array.isArray(events) || events.length === 0) throw new Error('events must be a non-empty array.');
                const body: any = {
                    user: { uid },
                    events,
                };
                const data = await fullstoryFetch('POST', `${base}/v2/events`, body);
                return { output: { result: data } };
            }

            case 'listPages': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await fullstoryFetch('GET', `${base}/v2/pages${qs}`);
                return { output: { pages: data?.results ?? data ?? [] } };
            }

            case 'getRecordingLink': {
                const sessionId = String(inputs.sessionId ?? '').trim();
                if (!sessionId) throw new Error('sessionId is required.');
                const data = await fullstoryFetch('GET', `${base}/v2/sessions/${sessionId}`);
                return { output: { playbackUrl: data?.playbackUrl ?? data?.FsUrl, session: data } };
            }

            case 'customEvent': {
                const uid = String(inputs.uid ?? '').trim();
                const eventName = String(inputs.eventName ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                if (!eventName) throw new Error('eventName is required.');
                const body: any = {
                    user: { uid },
                    events: [{
                        name: eventName,
                        timestamp: inputs.timestamp ?? new Date().toISOString(),
                        properties: inputs.properties || {},
                    }],
                };
                const data = await fullstoryFetch('POST', `${base}/v2/events`, body);
                return { output: { result: data } };
            }

            case 'getSegment': {
                const segmentId = String(inputs.segmentId ?? '').trim();
                if (!segmentId) throw new Error('segmentId is required.');
                const data = await fullstoryFetch('GET', `${base}/v2/segments/${segmentId}`);
                return { output: { segment: data } };
            }

            case 'listSegments': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await fullstoryFetch('GET', `${base}/v2/segments${qs}`);
                return { output: { segments: data?.results ?? data ?? [] } };
            }

            default:
                return { error: `FullStory action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'FullStory action failed.' };
    }
}
