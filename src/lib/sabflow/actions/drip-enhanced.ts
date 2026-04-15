'use server';

async function dripEnhancedFetch(apiToken: string, accountId: string, method: string, path: string, body?: any, logger?: any) {
    const base = `https://api.getdrip.com/v2/${accountId}`;
    const encoded = Buffer.from(`${apiToken}:`).toString('base64');
    logger?.log(`[DripEnhanced] ${method} ${base}${path}`);
    const opts: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${encoded}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'SabFlow/1.0',
        },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(`${base}${path}`, opts);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.errors?.[0]?.message || data?.message || `Drip API error: ${res.status}`);
    return data;
}

export async function executeDripEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiToken = String(inputs.apiToken ?? inputs.apiKey ?? '').trim();
        const accountId = String(inputs.accountId ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');
        if (!accountId) throw new Error('accountId is required.');

        const dr = (method: string, path: string, body?: any) =>
            dripEnhancedFetch(apiToken, accountId, method, path, body, logger);

        switch (actionName) {
            case 'listSubscribers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.status) params.set('status', String(inputs.status));
                if (inputs.tags) params.set('tags', String(inputs.tags));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dr('GET', `/subscribers${qs}`);
                return { output: data };
            }
            case 'getSubscriber': {
                const email = inputs.email ?? inputs.subscriberIdOrEmail;
                if (!email) throw new Error('email is required.');
                const data = await dr('GET', `/subscribers/${encodeURIComponent(email)}`);
                return { output: data };
            }
            case 'createOrUpdateSubscriber': {
                const email = inputs.email;
                if (!email) throw new Error('email is required.');
                const subscriber: any = { email };
                if (inputs.firstName) subscriber.first_name = inputs.firstName;
                if (inputs.lastName) subscriber.last_name = inputs.lastName;
                if (inputs.phone) subscriber.phone = inputs.phone;
                if (inputs.address1) subscriber.address1 = inputs.address1;
                if (inputs.city) subscriber.city = inputs.city;
                if (inputs.state) subscriber.state = inputs.state;
                if (inputs.zip) subscriber.zip = inputs.zip;
                if (inputs.country) subscriber.country = inputs.country;
                if (inputs.tags) subscriber.tags = inputs.tags;
                if (inputs.removeTags) subscriber.remove_tags = inputs.removeTags;
                if (inputs.customFields) subscriber.custom_fields = inputs.customFields;
                if (inputs.timeZone) subscriber.time_zone = inputs.timeZone;
                if (inputs.prospect != null) subscriber.prospect = inputs.prospect;
                const data = await dr('POST', '/subscribers', { subscribers: [subscriber] });
                return { output: data };
            }
            case 'deleteSubscriber': {
                const email = inputs.email ?? inputs.subscriberIdOrEmail;
                if (!email) throw new Error('email is required.');
                await dr('DELETE', `/subscribers/${encodeURIComponent(email)}`);
                return { output: { success: true, email } };
            }
            case 'tagSubscriber': {
                const email = inputs.email;
                const tag = inputs.tag;
                if (!email) throw new Error('email is required.');
                if (!tag) throw new Error('tag is required.');
                const data = await dr('POST', '/tags', { tags: [{ email, tag }] });
                return { output: data };
            }
            case 'untagSubscriber': {
                const email = inputs.email;
                const tag = inputs.tag;
                if (!email) throw new Error('email is required.');
                if (!tag) throw new Error('tag is required.');
                await dr('DELETE', `/subscribers/${encodeURIComponent(email)}/tags/${encodeURIComponent(tag)}`);
                return { output: { success: true, email, tag } };
            }
            case 'listTags': {
                const data = await dr('GET', '/tags');
                return { output: data };
            }
            case 'listCampaigns': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dr('GET', `/campaigns${qs}`);
                return { output: data };
            }
            case 'getCampaign': {
                const id = inputs.campaignId ?? inputs.id;
                if (!id) throw new Error('campaignId is required.');
                const data = await dr('GET', `/campaigns/${id}`);
                return { output: data };
            }
            case 'subscribeToCampaign': {
                const campaignId = inputs.campaignId;
                if (!campaignId) throw new Error('campaignId is required.');
                const email = inputs.email;
                if (!email) throw new Error('email is required.');
                const subscriber: any = { email };
                if (inputs.firstName) subscriber.first_name = inputs.firstName;
                if (inputs.lastName) subscriber.last_name = inputs.lastName;
                if (inputs.customFields) subscriber.custom_fields = inputs.customFields;
                const payload: any = { subscribers: [subscriber] };
                if (inputs.doubleOptin != null) payload.double_optin = inputs.doubleOptin;
                if (inputs.startingEmailIndex != null) payload.starting_email_index = inputs.startingEmailIndex;
                const data = await dr('POST', `/campaigns/${campaignId}/subscribers`, payload);
                return { output: data };
            }
            case 'listBroadcasts': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dr('GET', `/broadcasts${qs}`);
                return { output: data };
            }
            case 'getBroadcast': {
                const id = inputs.broadcastId ?? inputs.id;
                if (!id) throw new Error('broadcastId is required.');
                const data = await dr('GET', `/broadcasts/${id}`);
                return { output: data };
            }
            case 'listWorkflows': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dr('GET', `/workflows${qs}`);
                return { output: data };
            }
            case 'getWorkflow': {
                const id = inputs.workflowId ?? inputs.id;
                if (!id) throw new Error('workflowId is required.');
                const data = await dr('GET', `/workflows/${id}`);
                return { output: data };
            }
            case 'triggerWorkflow': {
                const workflowId = inputs.workflowId;
                if (!workflowId) throw new Error('workflowId is required.');
                const email = inputs.email;
                if (!email) throw new Error('email is required.');
                const subscriber: any = { email };
                if (inputs.firstName) subscriber.first_name = inputs.firstName;
                if (inputs.lastName) subscriber.last_name = inputs.lastName;
                if (inputs.customFields) subscriber.custom_fields = inputs.customFields;
                const data = await dr('POST', `/workflows/${workflowId}/subscribers`, { subscribers: [subscriber] });
                return { output: data };
            }
            default:
                throw new Error(`Unknown Drip Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[DripEnhanced] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Drip Enhanced action failed.' };
    }
}
