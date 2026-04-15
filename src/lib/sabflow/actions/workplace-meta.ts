'use server';

export async function executeWorkplaceMetaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const baseUrl = 'https://graph.workplace.com';

        const wpFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[WorkplaceMeta] ${method} ${path}`);
            const url = `${baseUrl}${path}`;
            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.error?.message || data?.message || `Workplace API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'postToGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const body: any = { message: inputs.message };
                if (inputs.link) body.link = inputs.link;
                if (inputs.published !== undefined) body.published = inputs.published;
                const data = await wpFetch('POST', `/${groupId}/feed`, body);
                return { output: data };
            }

            case 'getPost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                const fields = inputs.fields ? `?fields=${inputs.fields}` : '';
                const data = await wpFetch('GET', `/${postId}${fields}`);
                return { output: data };
            }

            case 'listGroups': {
                const params = new URLSearchParams();
                params.set('access_token', accessToken);
                if (inputs.fields) params.set('fields', String(inputs.fields));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await wpFetch('GET', `/community/groups?${params}`);
                return { output: data };
            }

            case 'getGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const fields = inputs.fields ? `?fields=${inputs.fields}` : '';
                const data = await wpFetch('GET', `/${groupId}${fields}`);
                return { output: data };
            }

            case 'createGroup': {
                const body: any = {
                    name: inputs.name,
                    privacy: inputs.privacy ?? 'CLOSED',
                };
                if (inputs.description) body.description = inputs.description;
                const data = await wpFetch('POST', '/community/groups', body);
                return { output: data };
            }

            case 'updateGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.privacy) body.privacy = inputs.privacy;
                const data = await wpFetch('POST', `/${groupId}`, body);
                return { output: data };
            }

            case 'getNewsFeed': {
                const userId = inputs.userId ?? 'me';
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.fields) params.set('fields', String(inputs.fields));
                const query = params.toString() ? `?${params}` : '';
                const data = await wpFetch('GET', `/${userId}/feed${query}`);
                return { output: data };
            }

            case 'getUser': {
                const userId = inputs.userId ?? 'me';
                const fields = inputs.fields ? `?fields=${inputs.fields}` : '';
                const data = await wpFetch('GET', `/${userId}${fields}`);
                return { output: data };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.fields) params.set('fields', String(inputs.fields));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params}` : '';
                const data = await wpFetch('GET', `/community/members${query}`);
                return { output: data };
            }

            case 'listMemberships': {
                const userId = inputs.userId ?? 'me';
                const params = new URLSearchParams();
                if (inputs.fields) params.set('fields', String(inputs.fields));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params}` : '';
                const data = await wpFetch('GET', `/${userId}/groups${query}`);
                return { output: data };
            }

            case 'joinGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const data = await wpFetch('POST', `/${groupId}/members`);
                return { output: data };
            }

            case 'leaveGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                const userId = inputs.userId ?? 'me';
                if (!groupId) throw new Error('groupId is required.');
                const data = await wpFetch('DELETE', `/${groupId}/members/${userId}`);
                return { output: data };
            }

            case 'postEvent': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const body: any = {
                    name: inputs.name,
                    start_time: inputs.startTime,
                };
                if (inputs.endTime) body.end_time = inputs.endTime;
                if (inputs.description) body.description = inputs.description;
                if (inputs.location) body.location = inputs.location;
                const data = await wpFetch('POST', `/${groupId}/events`, body);
                return { output: data };
            }

            case 'getEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const fields = inputs.fields ? `?fields=${inputs.fields}` : '';
                const data = await wpFetch('GET', `/${eventId}${fields}`);
                return { output: data };
            }

            case 'listEvents': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.fields) params.set('fields', String(inputs.fields));
                const query = params.toString() ? `?${params}` : '';
                const data = await wpFetch('GET', `/${groupId}/events${query}`);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Workplace Meta action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[WorkplaceMeta] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
