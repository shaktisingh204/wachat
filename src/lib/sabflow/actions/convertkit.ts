
'use server';

const CONVERTKIT_BASE = 'https://api.convertkit.com/v3';

async function convertkitFetch(
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[ConvertKit] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${CONVERTKIT_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `ConvertKit API error: ${res.status}`);
    }
    return data;
}

export async function executeConvertkitAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const apiSecret = String(inputs.apiSecret ?? '').trim();

        const ck = (method: string, path: string, body?: any) =>
            convertkitFetch(method, path, body, logger);

        switch (actionName) {
            case 'listSubscribers': {
                if (!apiSecret) throw new Error('apiSecret is required for listSubscribers.');
                const page = inputs.page ? `&page=${Number(inputs.page)}` : '';
                const data = await ck('GET', `/subscribers?api_secret=${encodeURIComponent(apiSecret)}${page}`);
                return {
                    output: {
                        subscribers: data?.subscribers ?? [],
                        totalSubscribers: String(data?.total_subscribers ?? 0),
                        page: String(data?.page ?? 1),
                    },
                };
            }

            case 'getSubscriber': {
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!subscriberId) throw new Error('subscriberId is required.');
                const data = await ck('GET', `/subscribers/${subscriberId}?api_key=${encodeURIComponent(apiKey)}`);
                return {
                    output: {
                        subscriber: data?.subscriber ?? {},
                    },
                };
            }

            case 'updateSubscriber': {
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!subscriberId) throw new Error('subscriberId is required.');
                const body: any = { api_key: apiKey };
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                if (inputs.email) body.email_address = String(inputs.email);
                if (inputs.fields && typeof inputs.fields === 'object') body.fields = inputs.fields;
                const data = await ck('PUT', `/subscribers/${subscriberId}`, body);
                return {
                    output: {
                        subscriber: data?.subscriber ?? {},
                    },
                };
            }

            case 'unsubscribe': {
                if (!apiSecret) throw new Error('apiSecret is required for unsubscribe.');
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await ck('PUT', '/unsubscribe', { api_secret: apiSecret, email });
                return {
                    output: {
                        subscriber: data?.subscriber ?? {},
                    },
                };
            }

            case 'listForms': {
                const data = await ck('GET', `/forms?api_key=${encodeURIComponent(apiKey)}`);
                return {
                    output: {
                        forms: data?.forms ?? [],
                    },
                };
            }

            case 'addToForm': {
                const formId = String(inputs.formId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!formId || !email) throw new Error('formId and email are required.');
                const body: any = { api_key: apiKey, email };
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                if (inputs.fields && typeof inputs.fields === 'object') body.fields = inputs.fields;
                const data = await ck('POST', `/forms/${formId}/subscribe`, body);
                return {
                    output: {
                        subscription: data?.subscription ?? {},
                    },
                };
            }

            case 'listSequences': {
                const data = await ck('GET', `/sequences?api_key=${encodeURIComponent(apiKey)}`);
                return {
                    output: {
                        courses: data?.courses ?? [],
                    },
                };
            }

            case 'addToSequence': {
                const sequenceId = String(inputs.sequenceId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!sequenceId || !email) throw new Error('sequenceId and email are required.');
                const body: any = { api_key: apiKey, email };
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                const data = await ck('POST', `/sequences/${sequenceId}/subscribe`, body);
                return {
                    output: {
                        subscription: data?.subscription ?? {},
                    },
                };
            }

            case 'listTags': {
                const data = await ck('GET', `/tags?api_key=${encodeURIComponent(apiKey)}`);
                return {
                    output: {
                        tags: data?.tags ?? [],
                    },
                };
            }

            case 'createTag': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await ck('POST', '/tags', { api_key: apiKey, tag: { name } });
                const tag = Array.isArray(data) ? data[0] : (data?.tags?.[0] ?? data);
                return {
                    output: {
                        id: String(tag?.id ?? ''),
                        name: tag?.name ?? name,
                    },
                };
            }

            case 'tagSubscriber': {
                const tagId = String(inputs.tagId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!tagId || !email) throw new Error('tagId and email are required.');
                const body: any = { api_key: apiKey, email };
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                const data = await ck('POST', `/tags/${tagId}/subscribe`, body);
                return {
                    output: {
                        subscription: data?.subscription ?? {},
                    },
                };
            }

            case 'removeTag': {
                if (!apiSecret) throw new Error('apiSecret is required for removeTag.');
                const tagId = String(inputs.tagId ?? '').trim();
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!tagId || !subscriberId) throw new Error('tagId and subscriberId are required.');
                await ck('DELETE', `/subscribers/${subscriberId}/tags/${tagId}?api_secret=${encodeURIComponent(apiSecret)}`);
                return {
                    output: {
                        deleted: 'true',
                        tagId,
                        subscriberId,
                    },
                };
            }

            case 'listBroadcasts': {
                const data = await ck('GET', `/broadcasts?api_key=${encodeURIComponent(apiKey)}`);
                return {
                    output: {
                        broadcasts: data?.broadcasts ?? [],
                    },
                };
            }

            case 'createBroadcast': {
                const subject = String(inputs.subject ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!subject || !content) throw new Error('subject and content are required.');
                const body: any = { api_key: apiKey, subject, content };
                if (inputs.description) body.description = String(inputs.description);
                const data = await ck('POST', '/broadcasts', body);
                return {
                    output: {
                        broadcast: data?.broadcast ?? {},
                    },
                };
            }

            default:
                return { error: `ConvertKit action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'ConvertKit action failed.' };
    }
}
