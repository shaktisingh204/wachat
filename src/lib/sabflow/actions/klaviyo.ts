
'use server';

const KLAVIYO_BASE = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-02-15';

async function klaviyoFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[Klaviyo] ${method} ${path}`);
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
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        const err = Array.isArray(data?.errors) ? data.errors[0]?.detail : (data?.message);
        throw new Error(err || `Klaviyo API error: ${res.status}`);
    }
    return data;
}

export async function executeKlaviyoAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const klaviyo = (method: string, path: string, body?: any) =>
            klaviyoFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'getProfiles': {
                const pageSize = Number(inputs.pageSize ?? 20);
                let path = `/profiles/?page[size]=${pageSize}`;
                if (inputs.filter) path += `&filter=${encodeURIComponent(String(inputs.filter))}`;
                const data = await klaviyo('GET', path);
                return { output: { data: data.data ?? [], links: data.links ?? {} } };
            }

            case 'getProfile': {
                const profileId = String(inputs.profileId ?? '').trim();
                if (!profileId) throw new Error('profileId is required.');
                const data = await klaviyo('GET', `/profiles/${profileId}/`);
                return { output: { data: data.data ?? {} } };
            }

            case 'createProfile': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const attributes: any = { email };
                if (inputs.firstName) attributes.first_name = String(inputs.firstName);
                if (inputs.lastName) attributes.last_name = String(inputs.lastName);
                if (inputs.phone) attributes.phone_number = String(inputs.phone);
                if (inputs.properties && typeof inputs.properties === 'object') {
                    attributes.properties = inputs.properties;
                }
                const data = await klaviyo('POST', '/profiles/', {
                    data: { type: 'profile', attributes },
                });
                return { output: { data: data.data ?? {} } };
            }

            case 'updateProfile': {
                const profileId = String(inputs.profileId ?? '').trim();
                if (!profileId) throw new Error('profileId is required.');
                if (!inputs.attributes || typeof inputs.attributes !== 'object') {
                    throw new Error('attributes object is required.');
                }
                const data = await klaviyo('PATCH', `/profiles/${profileId}/`, {
                    data: { type: 'profile', id: profileId, attributes: inputs.attributes },
                });
                return { output: { data: data.data ?? {} } };
            }

            case 'getLists': {
                const data = await klaviyo('GET', '/lists/');
                return { output: { data: data.data ?? [] } };
            }

            case 'createList': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await klaviyo('POST', '/lists/', {
                    data: { type: 'list', attributes: { name } },
                });
                return { output: { data: data.data ?? {} } };
            }

            case 'addProfilesToList': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const profileIds: string[] = Array.isArray(inputs.profileIds) ? inputs.profileIds : [];
                if (!profileIds.length) throw new Error('profileIds array is required and must not be empty.');
                await klaviyo('POST', `/lists/${listId}/relationships/profiles/`, {
                    data: profileIds.map((id: string) => ({ type: 'profile', id })),
                });
                return { output: { added: true } };
            }

            case 'removeProfilesFromList': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const profileIds: string[] = Array.isArray(inputs.profileIds) ? inputs.profileIds : [];
                if (!profileIds.length) throw new Error('profileIds array is required and must not be empty.');
                await klaviyo('DELETE', `/lists/${listId}/relationships/profiles/`, {
                    data: profileIds.map((id: string) => ({ type: 'profile', id })),
                });
                return { output: { removed: true } };
            }

            case 'getCampaigns': {
                const filter = inputs.filter
                    ? String(inputs.filter)
                    : 'equals(messages.channel,"email")';
                const data = await klaviyo('GET', `/campaigns/?filter=${encodeURIComponent(filter)}`);
                return { output: { data: data.data ?? [], links: data.links ?? {} } };
            }

            case 'createCampaign': {
                const name = String(inputs.name ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!name || !listId) throw new Error('name and listId are required.');
                if (!inputs.content || typeof inputs.content !== 'object') {
                    throw new Error('content object is required.');
                }
                const data = await klaviyo('POST', '/campaigns/', {
                    data: {
                        type: 'campaign',
                        attributes: {
                            name,
                            audiences: { included: [listId] },
                            send_options: {},
                            content: inputs.content,
                        },
                    },
                });
                return { output: { data: data.data ?? {} } };
            }

            case 'getFlows': {
                const data = await klaviyo('GET', '/flows/?page[size]=50');
                return { output: { data: data.data ?? [] } };
            }

            case 'getMetrics': {
                const data = await klaviyo('GET', '/metrics/');
                return { output: { data: data.data ?? [] } };
            }

            case 'createEvent': {
                const profileId = String(inputs.profileId ?? '').trim();
                const metricName = String(inputs.metricName ?? '').trim();
                if (!profileId || !metricName) throw new Error('profileId and metricName are required.');
                const attributes: any = {
                    profile: { data: { type: 'profile', id: profileId } },
                    metric: { data: { type: 'metric', attributes: { name: metricName } } },
                };
                if (inputs.properties && typeof inputs.properties === 'object') {
                    attributes.properties = inputs.properties;
                }
                if (inputs.value !== undefined) attributes.value = inputs.value;
                const data = await klaviyo('POST', '/events/', {
                    data: { type: 'event', attributes },
                });
                return { output: { data: data.data ?? {} } };
            }

            case 'getTemplates': {
                const data = await klaviyo('GET', '/templates/');
                return { output: { data: data.data ?? [] } };
            }

            default:
                return { error: `Klaviyo action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Klaviyo action failed.' };
    }
}
