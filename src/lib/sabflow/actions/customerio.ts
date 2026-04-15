'use server';

const CIO_TRACK_BASE = 'https://track.customer.io/api/v1';
const CIO_APP_BASE = 'https://api.customer.io/v1';

async function cioTrackFetch(siteId: string, apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Customer.io Track] ${method} ${path}`);
    const encoded = Buffer.from(`${siteId}:${apiKey}`).toString('base64');
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${encoded}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${CIO_TRACK_BASE}${path}`, options);
    if (res.status === 200 || res.status === 204) {
        const text = await res.text();
        return text ? JSON.parse(text) : {};
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.meta?.error || `Customer.io Track API error: ${res.status}`);
}

async function cioAppFetch(appApiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Customer.io App] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${appApiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${CIO_APP_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.meta?.error || `Customer.io App API error: ${res.status}`);
    }
    return data;
}

export async function executeCustomerioAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        switch (actionName) {
            case 'identifyPerson': {
                const siteId = String(inputs.siteId ?? '').trim();
                const apiKey = String(inputs.apiKey ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!apiKey) throw new Error('apiKey is required.');
                if (!userId) throw new Error('userId is required.');
                const body: any = {};
                if (inputs.email) body.email = String(inputs.email).trim();
                if (inputs.attributes) {
                    const attrs =
                        typeof inputs.attributes === 'string'
                            ? JSON.parse(inputs.attributes)
                            : inputs.attributes;
                    Object.assign(body, attrs);
                }
                await cioTrackFetch(siteId, apiKey, 'PUT', `/customers/${encodeURIComponent(userId)}`, body, logger);
                return { output: { identified: 'true', userId } };
            }

            case 'deletePerson': {
                const siteId = String(inputs.siteId ?? '').trim();
                const apiKey = String(inputs.apiKey ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!apiKey) throw new Error('apiKey is required.');
                if (!userId) throw new Error('userId is required.');
                await cioTrackFetch(siteId, apiKey, 'DELETE', `/customers/${encodeURIComponent(userId)}`, undefined, logger);
                return { output: { deleted: 'true', userId } };
            }

            case 'trackEvent': {
                const siteId = String(inputs.siteId ?? '').trim();
                const apiKey = String(inputs.apiKey ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                const eventName = String(inputs.eventName ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!apiKey) throw new Error('apiKey is required.');
                if (!userId) throw new Error('userId is required.');
                if (!eventName) throw new Error('eventName is required.');
                const body: any = { name: eventName };
                if (inputs.data) {
                    body.data =
                        typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                }
                await cioTrackFetch(siteId, apiKey, 'POST', `/customers/${encodeURIComponent(userId)}/events`, body, logger);
                return { output: { tracked: 'true', userId, eventName } };
            }

            case 'trackAnonymousEvent': {
                const siteId = String(inputs.siteId ?? '').trim();
                const apiKey = String(inputs.apiKey ?? '').trim();
                const anonymousId = String(inputs.anonymousId ?? '').trim();
                const eventName = String(inputs.eventName ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!apiKey) throw new Error('apiKey is required.');
                if (!anonymousId) throw new Error('anonymousId is required.');
                if (!eventName) throw new Error('eventName is required.');
                const body: any = { name: eventName, anonymous_id: anonymousId };
                if (inputs.data) {
                    body.data =
                        typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                }
                await cioTrackFetch(siteId, apiKey, 'POST', '/events', body, logger);
                return { output: { tracked: 'true', anonymousId, eventName } };
            }

            case 'pageView': {
                const siteId = String(inputs.siteId ?? '').trim();
                const apiKey = String(inputs.apiKey ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!apiKey) throw new Error('apiKey is required.');
                if (!userId) throw new Error('userId is required.');
                if (!url) throw new Error('url is required.');
                const body: any = { type: 'page', name: url };
                if (inputs.data) {
                    body.data =
                        typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                }
                await cioTrackFetch(siteId, apiKey, 'POST', `/customers/${encodeURIComponent(userId)}/events`, body, logger);
                return { output: { tracked: 'true', userId, url } };
            }

            case 'listSegments': {
                const appApiKey = String(inputs.appApiKey ?? '').trim();
                if (!appApiKey) throw new Error('appApiKey is required.');
                const data = await cioAppFetch(appApiKey, 'GET', '/segments', undefined, logger);
                return { output: { segments: data.segments ?? [] } };
            }

            case 'getSegmentMembership': {
                const appApiKey = String(inputs.appApiKey ?? '').trim();
                const segmentId = String(inputs.segmentId ?? '').trim();
                if (!appApiKey) throw new Error('appApiKey is required.');
                if (!segmentId) throw new Error('segmentId is required.');
                const data = await cioAppFetch(appApiKey, 'GET', `/segments/${segmentId}/membership`, undefined, logger);
                return { output: { ids: data.ids ?? [] } };
            }

            case 'listCampaigns': {
                const appApiKey = String(inputs.appApiKey ?? '').trim();
                if (!appApiKey) throw new Error('appApiKey is required.');
                const data = await cioAppFetch(appApiKey, 'GET', '/campaigns', undefined, logger);
                return { output: { campaigns: data.campaigns ?? [] } };
            }

            case 'getCampaign': {
                const appApiKey = String(inputs.appApiKey ?? '').trim();
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!appApiKey) throw new Error('appApiKey is required.');
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await cioAppFetch(appApiKey, 'GET', `/campaigns/${campaignId}`, undefined, logger);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        name: data.name ?? '',
                        active: String(data.active ?? 'false'),
                    },
                };
            }

            case 'triggerBroadcast': {
                const appApiKey = String(inputs.appApiKey ?? '').trim();
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!appApiKey) throw new Error('appApiKey is required.');
                if (!campaignId) throw new Error('campaignId is required.');
                const body: any = {};
                if (inputs.data) {
                    body.data =
                        typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                }
                if (inputs.recipients) {
                    body.recipients =
                        typeof inputs.recipients === 'string'
                            ? JSON.parse(inputs.recipients)
                            : inputs.recipients;
                }
                const data = await cioAppFetch(appApiKey, 'POST', `/campaigns/${campaignId}/triggers`, body, logger);
                return { output: { id: String(data.id ?? '') } };
            }

            case 'sendTransactional': {
                const appApiKey = String(inputs.appApiKey ?? '').trim();
                const transactionalMessageId = String(inputs.transactionalMessageId ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                if (!appApiKey) throw new Error('appApiKey is required.');
                if (!transactionalMessageId) throw new Error('transactionalMessageId is required.');
                if (!to) throw new Error('to is required.');
                const body: any = { transactional_message_id: transactionalMessageId, to };
                if (inputs.identifiers) {
                    body.identifiers =
                        typeof inputs.identifiers === 'string'
                            ? JSON.parse(inputs.identifiers)
                            : inputs.identifiers;
                }
                if (inputs.messageData) {
                    body.message_data =
                        typeof inputs.messageData === 'string'
                            ? JSON.parse(inputs.messageData)
                            : inputs.messageData;
                }
                const data = await cioAppFetch(appApiKey, 'POST', '/send/email', body, logger);
                return { output: { delivery_id: String(data.delivery_id ?? '') } };
            }

            case 'listMessages': {
                const appApiKey = String(inputs.appApiKey ?? '').trim();
                if (!appApiKey) throw new Error('appApiKey is required.');
                const data = await cioAppFetch(appApiKey, 'GET', '/messages', undefined, logger);
                return { output: { messages: data.messages ?? [] } };
            }

            default:
                return { error: `Customer.io action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Customer.io action failed.' };
    }
}
