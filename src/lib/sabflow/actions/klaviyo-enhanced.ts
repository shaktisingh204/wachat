'use server';

const KLAVIYO_BASE = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-02-15';

async function klaviyoFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[KlaviyoEnhanced] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Klaviyo-API-Key ${apiKey}`,
            revision: KLAVIYO_REVISION,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${KLAVIYO_BASE}${path}`, options);
    if (res.status === 204 || res.status === 202) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `Klaviyo API error: ${res.status}`);
    return data;
}

export async function executeKlaviyoEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const kl = (method: string, path: string, body?: any) => klaviyoFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'createProfile': {
                const data = await kl('POST', '/profiles/', {
                    data: {
                        type: 'profile',
                        attributes: {
                            email: inputs.email,
                            phone_number: inputs.phoneNumber,
                            first_name: inputs.firstName,
                            last_name: inputs.lastName,
                            properties: inputs.properties,
                        },
                    },
                });
                return { output: data };
            }
            case 'getProfile': {
                const profileId = inputs.profileId;
                const data = await kl('GET', `/profiles/${profileId}/`);
                return { output: data };
            }
            case 'updateProfile': {
                const profileId = inputs.profileId;
                const attrs: any = {};
                if (inputs.email) attrs.email = inputs.email;
                if (inputs.phoneNumber) attrs.phone_number = inputs.phoneNumber;
                if (inputs.firstName) attrs.first_name = inputs.firstName;
                if (inputs.lastName) attrs.last_name = inputs.lastName;
                if (inputs.properties) attrs.properties = inputs.properties;
                const data = await kl('PATCH', `/profiles/${profileId}/`, {
                    data: { type: 'profile', id: profileId, attributes: attrs },
                });
                return { output: data };
            }
            case 'getProfiles': {
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.sort) params.set('sort', inputs.sort);
                if (inputs.pageSize) params.set('page[size]', String(inputs.pageSize));
                if (inputs.pageCursor) params.set('page[cursor]', inputs.pageCursor);
                const data = await kl('GET', `/profiles/?${params.toString()}`);
                return { output: data };
            }
            case 'createEvent': {
                const data = await kl('POST', '/events/', {
                    data: {
                        type: 'event',
                        attributes: {
                            profile: inputs.profile,
                            metric: { data: { type: 'metric', attributes: { name: inputs.metricName } } },
                            properties: inputs.properties,
                            time: inputs.time ?? new Date().toISOString(),
                            value: inputs.value,
                        },
                    },
                });
                return { output: data };
            }
            case 'createMetric': {
                const data = await kl('POST', '/metrics/', {
                    data: {
                        type: 'metric',
                        attributes: {
                            name: inputs.name,
                            service: inputs.service,
                        },
                    },
                });
                return { output: data };
            }
            case 'getMetrics': {
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.pageSize) params.set('page[size]', String(inputs.pageSize));
                const data = await kl('GET', `/metrics/?${params.toString()}`);
                return { output: data };
            }
            case 'listLists': {
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.pageSize) params.set('page[size]', String(inputs.pageSize));
                const data = await kl('GET', `/lists/?${params.toString()}`);
                return { output: data };
            }
            case 'createList': {
                const data = await kl('POST', '/lists/', {
                    data: {
                        type: 'list',
                        attributes: { name: inputs.name },
                    },
                });
                return { output: data };
            }
            case 'addToList': {
                const listId = inputs.listId;
                const data = await kl('POST', `/lists/${listId}/relationships/profiles/`, {
                    data: inputs.profiles,
                });
                return { output: data };
            }
            case 'removeFromList': {
                const listId = inputs.listId;
                await kl('DELETE', `/lists/${listId}/relationships/profiles/`, {
                    data: inputs.profiles,
                });
                return { output: { success: true, listId } };
            }
            case 'getList': {
                const listId = inputs.listId;
                const data = await kl('GET', `/lists/${listId}/`);
                return { output: data };
            }
            case 'sendEmail': {
                const data = await kl('POST', '/campaigns/send/', {
                    data: {
                        type: 'campaign-send-job',
                        id: inputs.campaignId,
                    },
                });
                return { output: data };
            }
            case 'createCampaign': {
                const data = await kl('POST', '/campaigns/', {
                    data: {
                        type: 'campaign',
                        attributes: {
                            name: inputs.name,
                            channel: inputs.channel ?? 'email',
                            audiences: inputs.audiences,
                            send_options: inputs.sendOptions,
                            tracking_options: inputs.trackingOptions,
                        },
                    },
                });
                return { output: data };
            }
            case 'listCampaigns': {
                const params = new URLSearchParams();
                params.set('filter', inputs.filter ?? 'equals(messages.channel,"email")');
                if (inputs.sort) params.set('sort', inputs.sort);
                if (inputs.pageSize) params.set('page[size]', String(inputs.pageSize));
                const data = await kl('GET', `/campaigns/?${params.toString()}`);
                return { output: data };
            }
            default:
                return { error: `Unknown Klaviyo Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[KlaviyoEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
