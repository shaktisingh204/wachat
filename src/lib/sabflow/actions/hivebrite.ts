'use server';

async function hiveFetch(baseUrl: string, accessToken: string, method: string, path: string, body?: any, logger?: any) {
    const url = `${baseUrl}/api/v1${path}`;
    logger?.log(`[Hivebrite] ${method} ${url}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Hivebrite API error: ${res.status}`);
    }
    return data;
}

export async function executeHivebriteAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = String(inputs.baseUrl ?? '').trim().replace(/\/$/, '');
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!baseUrl) throw new Error('baseUrl is required.');
        if (!accessToken) throw new Error('accessToken is required.');
        const hive = (method: string, path: string, body?: any) => hiveFetch(baseUrl, accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.search) params.set('search', String(inputs.search));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await hive('GET', `/users${query}`);
                return { output: { users: data.users ?? data } };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const data = await hive('GET', `/users/${userId}`);
                return { output: data };
            }

            case 'createUser': {
                const body: any = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.password) body.password = inputs.password;
                if (inputs.profileAttributes) body.profile_attributes = inputs.profileAttributes;
                const data = await hive('POST', '/users', body);
                return { output: data };
            }

            case 'updateUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const body: any = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.profileAttributes) body.profile_attributes = inputs.profileAttributes;
                const data = await hive('PUT', `/users/${userId}`, body);
                return { output: data };
            }

            case 'deleteUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                await hive('DELETE', `/users/${userId}`);
                return { output: { success: true, userId } };
            }

            case 'listGroups': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await hive('GET', `/groups${query}`);
                return { output: { groups: data.groups ?? data } };
            }

            case 'getGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const data = await hive('GET', `/groups/${groupId}`);
                return { output: data };
            }

            case 'createGroup': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.visibility) body.visibility = inputs.visibility;
                if (inputs.adminIds) body.admin_ids = inputs.adminIds;
                const data = await hive('POST', '/groups', body);
                return { output: data };
            }

            case 'listEvents': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.startDate) params.set('start_date', String(inputs.startDate));
                if (inputs.endDate) params.set('end_date', String(inputs.endDate));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await hive('GET', `/events${query}`);
                return { output: { events: data.events ?? data } };
            }

            case 'getEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const data = await hive('GET', `/events/${eventId}`);
                return { output: data };
            }

            case 'createEvent': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.startDate) body.start_date = inputs.startDate;
                if (inputs.endDate) body.end_date = inputs.endDate;
                if (inputs.location) body.location = inputs.location;
                if (inputs.isOnline !== undefined) body.is_online = inputs.isOnline;
                const data = await hive('POST', '/events', body);
                return { output: data };
            }

            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.userId) params.set('user_id', String(inputs.userId));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await hive('GET', `/messages${query}`);
                return { output: { messages: data.messages ?? data } };
            }

            case 'sendMessage': {
                const body: any = {};
                if (inputs.recipientId) body.recipient_id = inputs.recipientId;
                if (inputs.content) body.content = inputs.content;
                if (inputs.subject) body.subject = inputs.subject;
                const data = await hive('POST', '/messages', body);
                return { output: data };
            }

            case 'listAnnouncements': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await hive('GET', `/announcements${query}`);
                return { output: { announcements: data.announcements ?? data } };
            }

            case 'createAnnouncement': {
                const body: any = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.content) body.content = inputs.content;
                if (inputs.publishedAt) body.published_at = inputs.publishedAt;
                if (inputs.targetAudience) body.target_audience = inputs.targetAudience;
                const data = await hive('POST', '/announcements', body);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Hivebrite action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Hivebrite] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
