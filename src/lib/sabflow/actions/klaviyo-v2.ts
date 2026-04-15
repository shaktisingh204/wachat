'use server';

const KLAVIYO_BASE = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-02-15';

async function klaviyoFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[KlaviyoV2] ${method} ${path}`);
    const opts: RequestInit = {
        method,
        headers: {
            Authorization: `Klaviyo-API-Key ${apiKey}`,
            revision: KLAVIYO_REVISION,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(`${KLAVIYO_BASE}${path}`, opts);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.errors?.[0]?.detail || data?.message || `Klaviyo API error: ${res.status}`);
    return data;
}

export async function executeKlaviyoV2Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const kv = (method: string, path: string, body?: any) => klaviyoFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listProfiles': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page[size]', String(inputs.pageSize));
                if (inputs.pageCursor) params.set('page[cursor]', String(inputs.pageCursor));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await kv('GET', `/profiles/${qs}`);
                return { output: data };
            }
            case 'getProfile': {
                const id = inputs.profileId ?? inputs.id;
                if (!id) throw new Error('profileId is required.');
                const data = await kv('GET', `/profiles/${id}/`);
                return { output: data };
            }
            case 'createProfile': {
                const attributes: any = {};
                if (inputs.email) attributes.email = inputs.email;
                if (inputs.phoneNumber) attributes.phone_number = inputs.phoneNumber;
                if (inputs.firstName) attributes.first_name = inputs.firstName;
                if (inputs.lastName) attributes.last_name = inputs.lastName;
                if (inputs.properties) attributes.properties = inputs.properties;
                const body = { data: { type: 'profile', attributes } };
                const data = await kv('POST', '/profiles/', body);
                return { output: data };
            }
            case 'updateProfile': {
                const id = inputs.profileId ?? inputs.id;
                if (!id) throw new Error('profileId is required.');
                const attributes: any = {};
                if (inputs.email) attributes.email = inputs.email;
                if (inputs.phoneNumber) attributes.phone_number = inputs.phoneNumber;
                if (inputs.firstName) attributes.first_name = inputs.firstName;
                if (inputs.lastName) attributes.last_name = inputs.lastName;
                if (inputs.properties) attributes.properties = inputs.properties;
                const body = { data: { type: 'profile', id, attributes } };
                const data = await kv('PATCH', `/profiles/${id}/`, body);
                return { output: data };
            }
            case 'subscribeProfiles': {
                const listId = inputs.listId;
                if (!listId) throw new Error('listId is required.');
                const profiles = inputs.profiles;
                if (!profiles || !Array.isArray(profiles)) throw new Error('profiles array is required.');
                const body = {
                    data: {
                        type: 'profile-subscription-bulk-create-job',
                        attributes: {
                            profiles: { data: profiles.map((p: any) => ({ type: 'profile', attributes: p })) },
                            historical_import: inputs.historicalImport ?? false,
                        },
                        relationships: { list: { data: { type: 'list', id: listId } } },
                    },
                };
                const data = await kv('POST', '/profile-subscription-bulk-create-jobs/', body);
                return { output: data };
            }
            case 'unsubscribeProfiles': {
                const listId = inputs.listId;
                if (!listId) throw new Error('listId is required.');
                const profiles = inputs.profiles;
                if (!profiles || !Array.isArray(profiles)) throw new Error('profiles array is required.');
                const body = {
                    data: {
                        type: 'profile-subscription-bulk-delete-job',
                        attributes: {
                            profiles: { data: profiles.map((p: any) => ({ type: 'profile', attributes: p })) },
                        },
                        relationships: { list: { data: { type: 'list', id: listId } } },
                    },
                };
                const data = await kv('POST', '/profile-subscription-bulk-delete-jobs/', body);
                return { output: data };
            }
            case 'listLists': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page[size]', String(inputs.pageSize));
                if (inputs.pageCursor) params.set('page[cursor]', String(inputs.pageCursor));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await kv('GET', `/lists/${qs}`);
                return { output: data };
            }
            case 'getList': {
                const id = inputs.listId ?? inputs.id;
                if (!id) throw new Error('listId is required.');
                const data = await kv('GET', `/lists/${id}/`);
                return { output: data };
            }
            case 'createList': {
                const name = inputs.name;
                if (!name) throw new Error('name is required.');
                const body = { data: { type: 'list', attributes: { name } } };
                const data = await kv('POST', '/lists/', body);
                return { output: data };
            }
            case 'deleteList': {
                const id = inputs.listId ?? inputs.id;
                if (!id) throw new Error('listId is required.');
                await kv('DELETE', `/lists/${id}/`);
                return { output: { success: true, listId: id } };
            }
            case 'addProfilesToList': {
                const listId = inputs.listId;
                if (!listId) throw new Error('listId is required.');
                const profileIds = inputs.profileIds;
                if (!profileIds || !Array.isArray(profileIds)) throw new Error('profileIds array is required.');
                const body = { data: profileIds.map((id: string) => ({ type: 'profile', id })) };
                const data = await kv('POST', `/lists/${listId}/relationships/profiles/`, body);
                return { output: data };
            }
            case 'removeProfilesFromList': {
                const listId = inputs.listId;
                if (!listId) throw new Error('listId is required.');
                const profileIds = inputs.profileIds;
                if (!profileIds || !Array.isArray(profileIds)) throw new Error('profileIds array is required.');
                const body = { data: profileIds.map((id: string) => ({ type: 'profile', id })) };
                const data = await kv('DELETE', `/lists/${listId}/relationships/profiles/`, body);
                return { output: data };
            }
            case 'listSegments': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page[size]', String(inputs.pageSize));
                if (inputs.pageCursor) params.set('page[cursor]', String(inputs.pageCursor));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await kv('GET', `/segments/${qs}`);
                return { output: data };
            }
            case 'getSegment': {
                const id = inputs.segmentId ?? inputs.id;
                if (!id) throw new Error('segmentId is required.');
                const data = await kv('GET', `/segments/${id}/`);
                return { output: data };
            }
            case 'listEvents': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page[size]', String(inputs.pageSize));
                if (inputs.pageCursor) params.set('page[cursor]', String(inputs.pageCursor));
                if (inputs.filter) params.set('filter', String(inputs.filter));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await kv('GET', `/events/${qs}`);
                return { output: data };
            }
            default:
                throw new Error(`Unknown Klaviyo V2 action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[KlaviyoV2] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Klaviyo V2 action failed.' };
    }
}
