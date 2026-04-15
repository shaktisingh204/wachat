'use server';

const CALENDLY_BASE = 'https://api.calendly.com';

async function calendlyFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Calendly Enhanced] ${method} ${path}`);
    const url = path.startsWith('http') ? path : `${CALENDLY_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(data?.message || data?.title || `HTTP ${res.status}: ${text}`);
    return data;
}

export async function executeCalendlyEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = inputs.accessToken;
        if (!token) return { error: 'Missing accessToken' };

        switch (actionName) {
            case 'getUser': {
                const data = await calendlyFetch(token, 'GET', '/users/me', undefined, logger);
                return { output: data };
            }
            case 'getOrganization': {
                const orgUri = inputs.organizationUri;
                if (!orgUri) return { error: 'Missing organizationUri' };
                const data = await calendlyFetch(token, 'GET', orgUri, undefined, logger);
                return { output: data };
            }
            case 'listEventTypes': {
                const user_ = inputs.userUri || '';
                const org = inputs.organizationUri || '';
                const params = new URLSearchParams();
                if (user_) params.set('user', user_);
                if (org) params.set('organization', org);
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                const data = await calendlyFetch(token, 'GET', `/event_types?${params}`, undefined, logger);
                return { output: data };
            }
            case 'getEventType': {
                const uuid = inputs.eventTypeUuid;
                if (!uuid) return { error: 'Missing eventTypeUuid' };
                const data = await calendlyFetch(token, 'GET', `/event_types/${uuid}`, undefined, logger);
                return { output: data };
            }
            case 'listEvents': {
                const params = new URLSearchParams();
                if (inputs.organizationUri) params.set('organization', inputs.organizationUri);
                if (inputs.userUri) params.set('invitee_email', inputs.userUri);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                if (inputs.minStartTime) params.set('min_start_time', inputs.minStartTime);
                if (inputs.maxStartTime) params.set('max_start_time', inputs.maxStartTime);
                const data = await calendlyFetch(token, 'GET', `/scheduled_events?${params}`, undefined, logger);
                return { output: data };
            }
            case 'getEvent': {
                const uuid = inputs.eventUuid;
                if (!uuid) return { error: 'Missing eventUuid' };
                const data = await calendlyFetch(token, 'GET', `/scheduled_events/${uuid}`, undefined, logger);
                return { output: data };
            }
            case 'listInvitees': {
                const uuid = inputs.eventUuid;
                if (!uuid) return { error: 'Missing eventUuid' };
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                const data = await calendlyFetch(token, 'GET', `/scheduled_events/${uuid}/invitees?${params}`, undefined, logger);
                return { output: data };
            }
            case 'getInvitee': {
                const eventUuid = inputs.eventUuid;
                const inviteeUuid = inputs.inviteeUuid;
                if (!eventUuid || !inviteeUuid) return { error: 'Missing eventUuid or inviteeUuid' };
                const data = await calendlyFetch(token, 'GET', `/scheduled_events/${eventUuid}/invitees/${inviteeUuid}`, undefined, logger);
                return { output: data };
            }
            case 'cancelEvent': {
                const uuid = inputs.eventUuid;
                if (!uuid) return { error: 'Missing eventUuid' };
                const body: any = {};
                if (inputs.reason) body.reason = inputs.reason;
                const data = await calendlyFetch(token, 'POST', `/scheduled_events/${uuid}/cancellation`, body, logger);
                return { output: data };
            }
            case 'createInviteeNoShow': {
                const inviteeUri = inputs.inviteeUri;
                if (!inviteeUri) return { error: 'Missing inviteeUri' };
                const data = await calendlyFetch(token, 'POST', '/invitee_no_shows', { invitee: inviteeUri }, logger);
                return { output: data };
            }
            case 'listOrganizationMemberships': {
                const org = inputs.organizationUri;
                if (!org) return { error: 'Missing organizationUri' };
                const params = new URLSearchParams({ organization: org });
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                const data = await calendlyFetch(token, 'GET', `/organization_memberships?${params}`, undefined, logger);
                return { output: data };
            }
            case 'getMembership': {
                const uuid = inputs.membershipUuid;
                if (!uuid) return { error: 'Missing membershipUuid' };
                const data = await calendlyFetch(token, 'GET', `/organization_memberships/${uuid}`, undefined, logger);
                return { output: data };
            }
            case 'removeMembership': {
                const uuid = inputs.membershipUuid;
                if (!uuid) return { error: 'Missing membershipUuid' };
                const data = await calendlyFetch(token, 'DELETE', `/organization_memberships/${uuid}`, undefined, logger);
                return { output: { success: true, data } };
            }
            case 'listWebhooks': {
                const org = inputs.organizationUri;
                const scope = inputs.scope || 'organization';
                const params = new URLSearchParams({ organization: org, scope });
                if (inputs.userUri) params.set('user', inputs.userUri);
                const data = await calendlyFetch(token, 'GET', `/webhook_subscriptions?${params}`, undefined, logger);
                return { output: data };
            }
            case 'createWebhook': {
                const body = {
                    url: inputs.url,
                    events: inputs.events,
                    organization: inputs.organizationUri,
                    scope: inputs.scope || 'organization',
                    ...(inputs.userUri ? { user: inputs.userUri } : {}),
                    ...(inputs.signingKey ? { signing_key: inputs.signingKey } : {}),
                };
                if (!body.url || !body.events || !body.organization) {
                    return { error: 'Missing url, events, or organizationUri' };
                }
                const data = await calendlyFetch(token, 'POST', '/webhook_subscriptions', body, logger);
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Calendly Enhanced] Error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
