'use server';

const CK_BASE = 'https://api.convertkit.com/v3';

async function ckFetch(method: string, path: string, params: Record<string, string>, body?: any, logger?: any) {
    logger?.log(`[ConvertKit-Enhanced] ${method} ${path}`);
    const qs = Object.keys(params).length
        ? '?' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
        : '';
    const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${CK_BASE}${path}${qs}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `ConvertKit API error: ${res.status}`);
    }
    return data;
}

export async function executeConvertkitEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const apiSecret = String(inputs.apiSecret ?? '').trim();

        const readParams = apiKey ? { api_key: apiKey } : (apiSecret ? { api_secret: apiSecret } : {});
        const writeParams = apiSecret ? { api_secret: apiSecret } : (apiKey ? { api_key: apiKey } : {});

        if (!apiKey && !apiSecret) throw new Error('apiKey or apiSecret is required.');

        switch (actionName) {
            case 'listSubscribers': {
                const params: Record<string, string> = { ...readParams };
                if (inputs.page) params.page = String(Number(inputs.page));
                if (inputs.fromDate) params.from = String(inputs.fromDate);
                const data = await ckFetch('GET', '/subscribers', params, undefined, logger);
                return { output: { subscribers: data.subscribers ?? [], totalSubscribers: String(data.total_subscribers ?? 0) } };
            }

            case 'getSubscriber': {
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!subscriberId) throw new Error('subscriberId is required.');
                const data = await ckFetch('GET', `/subscribers/${subscriberId}`, readParams, undefined, logger);
                return { output: { id: String(data.subscriber?.id ?? subscriberId), email: data.subscriber?.email_address ?? '', firstName: data.subscriber?.first_name ?? '' } };
            }

            case 'createSubscriber': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { ...writeParams, email_address: email };
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                if (inputs.fields) body.fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields;
                const data = await ckFetch('POST', '/subscribers', {}, body, logger);
                return { output: { id: String(data.subscriber?.id ?? ''), email: data.subscriber?.email_address ?? email } };
            }

            case 'updateSubscriber': {
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!subscriberId) throw new Error('subscriberId is required.');
                const body: any = { ...writeParams };
                if (inputs.email) body.email_address = String(inputs.email);
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                if (inputs.fields) body.fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields;
                const data = await ckFetch('PUT', `/subscribers/${subscriberId}`, {}, body, logger);
                return { output: { id: String(data.subscriber?.id ?? subscriberId), email: data.subscriber?.email_address ?? '' } };
            }

            case 'deleteSubscriber': {
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!subscriberId) throw new Error('subscriberId is required.');
                await ckFetch('DELETE', `/subscribers/${subscriberId}`, writeParams, undefined, logger);
                return { output: { deleted: 'true', subscriberId } };
            }

            case 'listForms': {
                const data = await ckFetch('GET', '/forms', readParams, undefined, logger);
                return { output: { forms: data.forms ?? [], total: String((data.forms ?? []).length) } };
            }

            case 'addSubscriberToForm': {
                const formId = String(inputs.formId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!formId || !email) throw new Error('formId and email are required.');
                const body: any = { ...writeParams, email };
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                const data = await ckFetch('POST', `/forms/${formId}/subscribe`, {}, body, logger);
                return { output: { subscriptionId: String(data.subscription?.id ?? ''), email: data.subscription?.subscriber?.email_address ?? email } };
            }

            case 'listTags': {
                const data = await ckFetch('GET', '/tags', readParams, undefined, logger);
                return { output: { tags: data.tags ?? [], total: String((data.tags ?? []).length) } };
            }

            case 'createTag': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { ...writeParams, tag: { name } };
                const data = await ckFetch('POST', '/tags', {}, body, logger);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'tagSubscriber': {
                const tagId = String(inputs.tagId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!tagId || !email) throw new Error('tagId and email are required.');
                const body: any = { ...writeParams, email };
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                const data = await ckFetch('POST', `/tags/${tagId}/subscribe`, {}, body, logger);
                return { output: { subscriptionId: String(data.subscription?.id ?? ''), tagId } };
            }

            case 'untagSubscriber': {
                const tagId = String(inputs.tagId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!tagId || !email) throw new Error('tagId and email are required.');
                await ckFetch('DELETE', `/tags/${tagId}/subscribers/${encodeURIComponent(email)}`, writeParams, undefined, logger);
                return { output: { removed: 'true', tagId, email } };
            }

            case 'listSequences': {
                const data = await ckFetch('GET', '/sequences', readParams, undefined, logger);
                return { output: { sequences: data.courses ?? [], total: String((data.courses ?? []).length) } };
            }

            case 'addSubscriberToSequence': {
                const sequenceId = String(inputs.sequenceId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!sequenceId || !email) throw new Error('sequenceId and email are required.');
                const body: any = { ...writeParams, email };
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                const data = await ckFetch('POST', `/sequences/${sequenceId}/subscribe`, {}, body, logger);
                return { output: { subscriptionId: String(data.subscription?.id ?? ''), sequenceId } };
            }

            case 'listBroadcasts': {
                const data = await ckFetch('GET', '/broadcasts', readParams, undefined, logger);
                return { output: { broadcasts: data.broadcasts ?? [], total: String((data.broadcasts ?? []).length) } };
            }

            case 'createBroadcast': {
                const subject = String(inputs.subject ?? '').trim();
                if (!subject) throw new Error('subject is required.');
                const body: any = { ...writeParams, subject };
                if (inputs.content) body.content = String(inputs.content);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.publicAt) body.public_at = String(inputs.publicAt);
                const data = await ckFetch('POST', '/broadcasts', {}, body, logger);
                return { output: { id: String(data.broadcast?.id ?? ''), subject: data.broadcast?.subject ?? subject } };
            }

            default:
                return { error: `ConvertKit Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'ConvertKit Enhanced action failed.' };
    }
}
