'use server';

const ML_BASE = 'https://api.mailerlite.com/api/v2';

async function mlFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[MailerLite-Enhanced] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'X-MailerLite-ApiKey': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${ML_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `MailerLite API error: ${res.status}`);
    }
    return data;
}

export async function executeMailerliteEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const ml = (method: string, path: string, body?: any) =>
            mlFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listSubscribers': {
                const params: string[] = [];
                if (inputs.limit) params.push(`limit=${Number(inputs.limit)}`);
                if (inputs.offset) params.push(`offset=${Number(inputs.offset)}`);
                if (inputs.filter) params.push(`filter[status]=${encodeURIComponent(String(inputs.filter))}`);
                const qs = params.length ? `?${params.join('&')}` : '';
                const data = await ml('GET', `/subscribers${qs}`);
                return { output: { subscribers: Array.isArray(data) ? data : [], total: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getSubscriber': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await ml('GET', `/subscribers/${encodeURIComponent(email)}`);
                return { output: { id: String(data.id ?? ''), email: data.email ?? email, name: data.name ?? '', status: data.type ?? '' } };
            }

            case 'createSubscriber': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { email };
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.fields) body.fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields;
                const data = await ml('POST', '/subscribers', body);
                return { output: { id: String(data.id ?? ''), email: data.email ?? email } };
            }

            case 'updateSubscriber': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.fields) body.fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields;
                if (inputs.type) body.type = String(inputs.type);
                const data = await ml('PUT', `/subscribers/${encodeURIComponent(email)}`, body);
                return { output: { id: String(data.id ?? ''), email: data.email ?? email } };
            }

            case 'deleteSubscriber': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                await ml('DELETE', `/subscribers/${encodeURIComponent(email)}`);
                return { output: { deleted: 'true', email } };
            }

            case 'listGroups': {
                const data = await ml('GET', '/groups');
                return { output: { groups: Array.isArray(data) ? data : [], total: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const data = await ml('GET', `/groups/${groupId}`);
                return { output: { id: String(data.id ?? groupId), name: data.name ?? '' } };
            }

            case 'createGroup': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await ml('POST', '/groups', { name });
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'addSubscriberToGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!groupId || !email) throw new Error('groupId and email are required.');
                const body: any = { email };
                if (inputs.name) body.name = String(inputs.name);
                const data = await ml('POST', `/groups/${groupId}/subscribers`, body);
                return { output: { id: String(data.id ?? ''), email: data.email ?? email } };
            }

            case 'removeSubscriberFromGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!groupId || !subscriberId) throw new Error('groupId and subscriberId are required.');
                await ml('DELETE', `/groups/${groupId}/subscribers/${subscriberId}`);
                return { output: { removed: 'true', groupId, subscriberId } };
            }

            case 'listCampaigns': {
                const status = inputs.status ? `?status=${encodeURIComponent(String(inputs.status))}` : '';
                const data = await ml('GET', `/campaigns${status}`);
                return { output: { campaigns: Array.isArray(data) ? data : [], total: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'createCampaign': {
                const subject = String(inputs.subject ?? '').trim();
                const fromEmail = String(inputs.fromEmail ?? '').trim();
                const fromName = String(inputs.fromName ?? '').trim();
                if (!subject || !fromEmail || !fromName) throw new Error('subject, fromEmail, and fromName are required.');
                const body: any = { subject, from: fromEmail, from_name: fromName };
                if (inputs.type) body.type = String(inputs.type);
                if (inputs.groups) body.groups = Array.isArray(inputs.groups) ? inputs.groups : [inputs.groups];
                const data = await ml('POST', '/campaigns', body);
                return { output: { id: String(data.id ?? ''), subject: data.subject ?? subject } };
            }

            case 'sendCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await ml('POST', `/campaigns/${campaignId}/actions/send`, {});
                return { output: { sent: 'true', campaignId, status: data?.status ?? '' } };
            }

            case 'getCampaignStats': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await ml('GET', `/campaigns/${campaignId}/reports/recipients`);
                return { output: { stats: data ?? {}, campaignId } };
            }

            case 'createWebhook': {
                const url = String(inputs.url ?? '').trim();
                const event = String(inputs.event ?? '').trim();
                if (!url || !event) throw new Error('url and event are required.');
                const data = await ml('POST', '/webhooks', { url, event });
                return { output: { id: String(data.id ?? ''), url: data.url ?? url, event: data.event ?? event } };
            }

            default:
                return { error: `MailerLite Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'MailerLite Enhanced action failed.' };
    }
}
