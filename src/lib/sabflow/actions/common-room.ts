'use server';

const COMMON_ROOM_BASE = 'https://api.commonroom.io/community/v1';

async function crFetch(apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[CommonRoom] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${COMMON_ROOM_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Common Room API error: ${res.status}`);
    }
    return data;
}

export async function executeCommonRoomAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');
        const cr = (method: string, path: string, body?: any) => crFetch(apiToken, method, path, body, logger);

        switch (actionName) {
            case 'listMembers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await cr('GET', `/members${query}`);
                return { output: { members: data.members ?? data } };
            }

            case 'getMember': {
                const memberId = String(inputs.memberId ?? '').trim();
                if (!memberId) throw new Error('memberId is required.');
                const data = await cr('GET', `/members/${memberId}`);
                return { output: data };
            }

            case 'listActivities': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.memberId) params.set('memberId', String(inputs.memberId));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await cr('GET', `/activities${query}`);
                return { output: { activities: data.activities ?? data } };
            }

            case 'listSegments': {
                const data = await cr('GET', '/segments');
                return { output: { segments: data.segments ?? data } };
            }

            case 'getSegment': {
                const segmentId = String(inputs.segmentId ?? '').trim();
                if (!segmentId) throw new Error('segmentId is required.');
                const data = await cr('GET', `/segments/${segmentId}`);
                return { output: data };
            }

            case 'createSegment': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.filters) body.filters = inputs.filters;
                const data = await cr('POST', '/segments', body);
                return { output: data };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await cr('GET', `/contacts${query}`);
                return { output: { contacts: data.contacts ?? data } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await cr('GET', `/contacts/${contactId}`);
                return { output: data };
            }

            case 'addNote': {
                const memberId = String(inputs.memberId ?? '').trim();
                if (!memberId) throw new Error('memberId is required.');
                const body: any = { note: inputs.note };
                const data = await cr('POST', `/members/${memberId}/notes`, body);
                return { output: data };
            }

            case 'getTasks': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                if (inputs.assigneeId) params.set('assigneeId', String(inputs.assigneeId));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await cr('GET', `/tasks${query}`);
                return { output: { tasks: data.tasks ?? data } };
            }

            case 'createTask': {
                const body: any = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.description) body.description = inputs.description;
                if (inputs.assigneeId) body.assigneeId = inputs.assigneeId;
                if (inputs.dueDate) body.dueDate = inputs.dueDate;
                if (inputs.memberId) body.memberId = inputs.memberId;
                const data = await cr('POST', '/tasks', body);
                return { output: data };
            }

            case 'listIntegrations': {
                const data = await cr('GET', '/integrations');
                return { output: { integrations: data.integrations ?? data } };
            }

            case 'getIntegration': {
                const integrationId = String(inputs.integrationId ?? '').trim();
                if (!integrationId) throw new Error('integrationId is required.');
                const data = await cr('GET', `/integrations/${integrationId}`);
                return { output: data };
            }

            case 'listCustomFields': {
                const data = await cr('GET', '/custom-fields');
                return { output: { customFields: data.customFields ?? data } };
            }

            case 'createCustomField': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.type) body.type = inputs.type;
                if (inputs.description) body.description = inputs.description;
                const data = await cr('POST', '/custom-fields', body);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Common Room action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[CommonRoom] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
