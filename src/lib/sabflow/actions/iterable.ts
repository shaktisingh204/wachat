
'use server';

const ITERABLE_BASE = 'https://api.iterable.com/api';

async function iterableFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[Iterable] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${ITERABLE_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        const msg = data?.msg || data?.message || `Iterable API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeIterableAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const iterable = (method: string, path: string, body?: any) =>
            iterableFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'getUser': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await iterable('GET', `/users/${encodeURIComponent(email)}`);
                return {
                    output: {
                        user: {
                            email: data.user?.email ?? email,
                            dataFields: data.user?.dataFields ?? {},
                            signupDate: data.user?.signupDate ?? '',
                        },
                    },
                };
            }

            case 'updateUser': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { email };
                if (inputs.dataFields && typeof inputs.dataFields === 'object') {
                    body.dataFields = inputs.dataFields;
                }
                body.mergeNestedObjects = inputs.mergeNestedObjects !== undefined
                    ? Boolean(inputs.mergeNestedObjects)
                    : true;
                const data = await iterable('POST', '/users/update', body);
                return { output: { msg: data.msg ?? '', code: data.code ?? '' } };
            }

            case 'deleteUser': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await iterable('DELETE', `/users/${encodeURIComponent(email)}`);
                return { output: { msg: data.msg ?? '', code: data.code ?? '' } };
            }

            case 'bulkUpdateUsers': {
                const users = inputs.users;
                if (!Array.isArray(users) || !users.length) throw new Error('users array is required and must not be empty.');
                const data = await iterable('POST', '/users/bulkUpdate', { users });
                return { output: { successCount: String(data.successCount ?? 0), failCount: String(data.failCount ?? 0) } };
            }

            case 'trackEvent': {
                const email = String(inputs.email ?? '').trim();
                const eventName = String(inputs.eventName ?? '').trim();
                if (!email || !eventName) throw new Error('email and eventName are required.');
                const body: any = {
                    email,
                    eventName,
                    createdAt: inputs.createdAt !== undefined ? Number(inputs.createdAt) : Date.now(),
                };
                if (inputs.dataFields && typeof inputs.dataFields === 'object') {
                    body.dataFields = inputs.dataFields;
                }
                const data = await iterable('POST', '/events/track', body);
                return { output: { msg: data.msg ?? '', code: data.code ?? '' } };
            }

            case 'trackPurchase': {
                const email = String(inputs.email ?? '').trim();
                const total = Number(inputs.total ?? 0);
                const items = inputs.items;
                if (!email) throw new Error('email is required.');
                if (!Array.isArray(items) || !items.length) throw new Error('items array is required and must not be empty.');
                const body: any = { user: { email }, total, items };
                if (inputs.campaignId !== undefined) body.campaignId = inputs.campaignId;
                const data = await iterable('POST', '/commerce/trackPurchase', body);
                return { output: { msg: data.msg ?? '', code: data.code ?? '' } };
            }

            case 'getChannels': {
                const data = await iterable('GET', '/channels');
                return { output: { channels: data.channels ?? [] } };
            }

            case 'getLists': {
                const data = await iterable('GET', '/lists');
                return { output: { lists: data.lists ?? [] } };
            }

            case 'subscribeToList': {
                const listId = Number(inputs.listId);
                if (!listId) throw new Error('listId is required.');
                const subscribers = inputs.subscribers;
                if (!Array.isArray(subscribers) || !subscribers.length) {
                    throw new Error('subscribers array is required and must not be empty.');
                }
                const data = await iterable('POST', '/lists/subscribe', {
                    listId,
                    subscribers: subscribers.map((s: any) => ({ email: String(s.email ?? s) })),
                });
                return { output: { successCount: String(data.successCount ?? 0), failCount: String(data.failCount ?? 0) } };
            }

            case 'unsubscribeFromList': {
                const listId = Number(inputs.listId);
                if (!listId) throw new Error('listId is required.');
                const subscribers = inputs.subscribers;
                if (!Array.isArray(subscribers) || !subscribers.length) {
                    throw new Error('subscribers array is required and must not be empty.');
                }
                const body: any = {
                    listId,
                    subscribers: subscribers.map((s: any) => ({ email: String(s.email ?? s) })),
                };
                if (inputs.campaignId !== undefined) body.campaignId = inputs.campaignId;
                const data = await iterable('POST', '/lists/unsubscribe', body);
                return { output: { successCount: String(data.successCount ?? 0) } };
            }

            case 'sendEmail': {
                const campaignId = Number(inputs.campaignId);
                const recipientEmail = String(inputs.recipientEmail ?? '').trim();
                if (!campaignId || !recipientEmail) throw new Error('campaignId and recipientEmail are required.');
                const body: any = { campaignId, recipientEmail };
                if (inputs.dataFields && typeof inputs.dataFields === 'object') {
                    body.dataFields = inputs.dataFields;
                }
                const data = await iterable('POST', '/email/target', body);
                return { output: { msg: data.msg ?? '', code: data.code ?? '' } };
            }

            case 'sendSms': {
                const campaignId = Number(inputs.campaignId);
                const recipientEmail = String(inputs.recipientEmail ?? '').trim();
                if (!campaignId || !recipientEmail) throw new Error('campaignId and recipientEmail are required.');
                const data = await iterable('POST', '/sms/target', { campaignId, recipientEmail });
                return { output: { msg: data.msg ?? '', code: data.code ?? '' } };
            }

            case 'sendPush': {
                const campaignId = Number(inputs.campaignId);
                const recipientEmail = String(inputs.recipientEmail ?? '').trim();
                if (!campaignId || !recipientEmail) throw new Error('campaignId and recipientEmail are required.');
                const data = await iterable('POST', '/push/target', { campaignId, recipientEmail });
                return { output: { msg: data.msg ?? '', code: data.code ?? '' } };
            }

            case 'getCampaigns': {
                const data = await iterable('GET', '/campaigns');
                return { output: { campaigns: data.campaigns ?? [] } };
            }

            case 'createCampaign': {
                const name = String(inputs.name ?? '').trim();
                const listIds = inputs.listIds;
                const templateId = Number(inputs.templateId);
                if (!name || !Array.isArray(listIds) || !listIds.length || !templateId) {
                    throw new Error('name, listIds, and templateId are required.');
                }
                const body: any = { name, listIds, templateId };
                if (inputs.sendAt !== undefined) body.sendAt = inputs.sendAt;
                const data = await iterable('POST', '/campaigns/create', body);
                return { output: { campaignId: String(data.campaignId ?? '') } };
            }

            default:
                return { error: `Iterable action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Iterable action failed.' };
    }
}
