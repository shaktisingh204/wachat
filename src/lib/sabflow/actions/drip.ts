'use server';

const DRIP_BASE = 'https://api.getdrip.com/v2';

async function dripFetch(apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Drip] ${method} ${path}`);
    const encoded = Buffer.from(`${apiToken}:`).toString('base64');
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${encoded}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${DRIP_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.errors?.[0]?.message || `Drip API error: ${res.status}`);
    return data;
}

export async function executeDripAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiToken = String(inputs.apiToken ?? inputs.apiKey ?? '').trim();
        const accountId = String(inputs.accountId ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');
        if (!accountId) throw new Error('accountId is required.');
        const dr = (method: string, path: string, body?: any) => dripFetch(apiToken, method, `/${accountId}${path}`, body, logger);

        switch (actionName) {
            case 'createSubscriber': {
                const payload: any = { email: inputs.email };
                if (inputs.firstName) payload.first_name = inputs.firstName;
                if (inputs.lastName) payload.last_name = inputs.lastName;
                if (inputs.customFields) payload.custom_fields = inputs.customFields;
                if (inputs.tags) payload.tags = inputs.tags;
                if (inputs.timeZone) payload.time_zone = inputs.timeZone;
                const data = await dr('POST', '/subscribers', { subscribers: [payload] });
                return { output: data };
            }
            case 'updateSubscriber': {
                const email = inputs.email;
                const payload: any = { email };
                if (inputs.firstName) payload.first_name = inputs.firstName;
                if (inputs.lastName) payload.last_name = inputs.lastName;
                if (inputs.customFields) payload.custom_fields = inputs.customFields;
                if (inputs.tags) payload.tags = inputs.tags;
                const data = await dr('POST', '/subscribers', { subscribers: [payload] });
                return { output: data };
            }
            case 'getSubscriber': {
                const subscriberId = encodeURIComponent(inputs.subscriberId ?? inputs.email);
                const data = await dr('GET', `/subscribers/${subscriberId}`);
                return { output: data };
            }
            case 'listSubscribers': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.tags) params.set('tags', inputs.tags);
                const data = await dr('GET', `/subscribers?${params.toString()}`);
                return { output: data };
            }
            case 'deleteSubscriber': {
                const subscriberId = encodeURIComponent(inputs.subscriberId ?? inputs.email);
                await dr('DELETE', `/subscribers/${subscriberId}`);
                return { output: { success: true, subscriberId } };
            }
            case 'applyTag': {
                const data = await dr('POST', '/tags', {
                    tags: [{ email: inputs.email, tag: inputs.tag }],
                });
                return { output: data };
            }
            case 'removeTag': {
                const email = encodeURIComponent(inputs.email);
                const tag = encodeURIComponent(inputs.tag);
                await dr('DELETE', `/subscribers/${email}/tags/${tag}`);
                return { output: { success: true } };
            }
            case 'trackEvent': {
                const payload: any = {
                    email: inputs.email,
                    action: inputs.action,
                };
                if (inputs.properties) payload.properties = inputs.properties;
                if (inputs.occurredAt) payload.occurred_at = inputs.occurredAt;
                const data = await dr('POST', '/events', { events: [payload] });
                return { output: data };
            }
            case 'listEvents': {
                const subscriberId = encodeURIComponent(inputs.subscriberId ?? inputs.email);
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await dr('GET', `/subscribers/${subscriberId}/events?${params.toString()}`);
                return { output: data };
            }
            case 'createCampaign': {
                const data = await dr('POST', '/campaigns', {
                    campaigns: [{
                        name: inputs.name,
                        from_name: inputs.fromName,
                        from_email: inputs.fromEmail,
                        postal_address: inputs.postalAddress,
                    }],
                });
                return { output: data };
            }
            case 'activateCampaign': {
                const campaignId = inputs.campaignId;
                const data = await dr('POST', `/campaigns/${campaignId}/activate`);
                return { output: data };
            }
            case 'deactivateCampaign': {
                const campaignId = inputs.campaignId;
                const data = await dr('POST', `/campaigns/${campaignId}/deactivate`);
                return { output: data };
            }
            case 'subscribeToCampaign': {
                const campaignId = inputs.campaignId;
                const payload: any = { email: inputs.email };
                if (inputs.startingEmailIndex !== undefined) payload.starting_email_index = inputs.startingEmailIndex;
                if (inputs.customFields) payload.custom_fields = inputs.customFields;
                if (inputs.tags) payload.tags = inputs.tags;
                const data = await dr('POST', `/campaigns/${campaignId}/subscribers`, {
                    subscribers: [payload],
                });
                return { output: data };
            }
            case 'listCampaigns': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await dr('GET', `/campaigns?${params.toString()}`);
                return { output: data };
            }
            case 'listCustomFields': {
                const data = await dr('GET', '/custom_field_identifiers');
                return { output: data };
            }
            default:
                return { error: `Unknown Drip action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Drip] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
