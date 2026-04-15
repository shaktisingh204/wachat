'use server';

const VERO_BASE_URL = 'https://api.getvero.com/api/v2';

async function veroRequest(
    method: string,
    path: string,
    authToken: string,
    body?: Record<string, any>,
    queryParams?: Record<string, string>
): Promise<any> {
    const url = new URL(`${VERO_BASE_URL}${path}`);
    if (method === 'GET' && queryParams) {
        for (const [k, v] of Object.entries(queryParams)) {
            url.searchParams.set(k, v);
        }
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    const payload: Record<string, any> = { auth_token: authToken, ...(body ?? {}) };

    const res = await fetch(url.toString(), {
        method,
        headers,
        body: method !== 'GET' ? JSON.stringify(payload) : undefined,
    });

    if (res.status === 200 || res.status === 201 || res.status === 204) {
        const text = await res.text();
        if (!text) return { success: true };
        try { return JSON.parse(text); } catch { return { raw: text }; }
    }

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    throw new Error(data?.message ?? data?.error ?? `Vero API error ${res.status}: ${text}`);
}

export async function executeVeroAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        if (!inputs.auth_token) return { error: 'Missing required input: auth_token' };
        const { auth_token } = inputs;
        logger.log(`Executing Vero action: ${actionName}`);

        switch (actionName) {

            case 'identifyUser': {
                if (!inputs.id) return { error: 'Missing required input: id' };
                const body: Record<string, any> = { id: inputs.id };
                if (inputs.email) body.email = inputs.email;
                if (inputs.data) body.data = inputs.data;
                await veroRequest('POST', '/users/track', auth_token, body);
                return { output: { identified: true, id: inputs.id } };
            }

            case 'updateUser': {
                if (!inputs.id) return { error: 'Missing required input: id' };
                const body: Record<string, any> = { id: inputs.id };
                if (inputs.email) body.email = inputs.email;
                if (inputs.changes) body.changes = inputs.changes;
                await veroRequest('PUT', '/users/edit', auth_token, body);
                return { output: { updated: true, id: inputs.id } };
            }

            case 'addUserTag': {
                if (!inputs.id) return { error: 'Missing required input: id' };
                if (!inputs.tag) return { error: 'Missing required input: tag' };
                const body: Record<string, any> = {
                    id: inputs.id,
                    add: Array.isArray(inputs.tag) ? inputs.tag : [inputs.tag],
                };
                await veroRequest('PUT', '/users/tags/edit', auth_token, body);
                return { output: { tagged: true, id: inputs.id, tag: inputs.tag } };
            }

            case 'removeUserTag': {
                if (!inputs.id) return { error: 'Missing required input: id' };
                if (!inputs.tag) return { error: 'Missing required input: tag' };
                const body: Record<string, any> = {
                    id: inputs.id,
                    remove: Array.isArray(inputs.tag) ? inputs.tag : [inputs.tag],
                };
                await veroRequest('PUT', '/users/tags/edit', auth_token, body);
                return { output: { untagged: true, id: inputs.id, tag: inputs.tag } };
            }

            case 'unsubscribeUser': {
                if (!inputs.id) return { error: 'Missing required input: id' };
                const body: Record<string, any> = { id: inputs.id };
                await veroRequest('POST', '/users/unsubscribe', auth_token, body);
                return { output: { unsubscribed: true, id: inputs.id } };
            }

            case 'resubscribeUser': {
                if (!inputs.id) return { error: 'Missing required input: id' };
                const body: Record<string, any> = { id: inputs.id };
                await veroRequest('POST', '/users/resubscribe', auth_token, body);
                return { output: { resubscribed: true, id: inputs.id } };
            }

            case 'deleteUser': {
                if (!inputs.id) return { error: 'Missing required input: id' };
                const body: Record<string, any> = { id: inputs.id };
                await veroRequest('DELETE', '/users/delete', auth_token, body);
                return { output: { deleted: true, id: inputs.id } };
            }

            case 'trackEvent': {
                if (!inputs.identity) return { error: 'Missing required input: identity (object with id)' };
                if (!inputs.event_name) return { error: 'Missing required input: event_name' };
                const body: Record<string, any> = {
                    identity: inputs.identity,
                    event_name: inputs.event_name,
                };
                if (inputs.data) body.data = inputs.data;
                if (inputs.extras) body.extras = inputs.extras;
                await veroRequest('POST', '/events/track', auth_token, body);
                return { output: { tracked: true, event_name: inputs.event_name } };
            }

            case 'sendTransactional': {
                if (!inputs.identity) return { error: 'Missing required input: identity' };
                if (!inputs.email_id) return { error: 'Missing required input: email_id' };
                const body: Record<string, any> = {
                    identity: inputs.identity,
                    email_id: inputs.email_id,
                };
                if (inputs.data) body.data = inputs.data;
                if (inputs.extras) body.extras = inputs.extras;
                const data = await veroRequest('POST', '/emails/send', auth_token, body);
                return { output: { sent: true, result: data } };
            }

            case 'createCampaign': {
                if (!inputs.subject) return { error: 'Missing required input: subject' };
                if (!inputs.from_name) return { error: 'Missing required input: from_name' };
                if (!inputs.from_email) return { error: 'Missing required input: from_email' };
                const body: Record<string, any> = {
                    subject: inputs.subject,
                    from_name: inputs.from_name,
                    from_email: inputs.from_email,
                };
                if (inputs.html_body) body.html_body = inputs.html_body;
                if (inputs.text_body) body.text_body = inputs.text_body;
                if (inputs.trigger_event) body.trigger_event = inputs.trigger_event;
                if (inputs.segment_ids) body.segment_ids = inputs.segment_ids;
                const data = await veroRequest('POST', '/newsletters', auth_token, body);
                return { output: { campaign: data } };
            }

            case 'listCampaigns': {
                const params: Record<string, string> = {};
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.per_page) params.per_page = String(inputs.per_page);
                const url = new URL(`${VERO_BASE_URL}/newsletters`);
                url.searchParams.set('auth_token', auth_token);
                if (params.page) url.searchParams.set('page', params.page);
                if (params.per_page) url.searchParams.set('per_page', params.per_page);
                const res = await fetch(url.toString(), {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.message ?? `Vero API error ${res.status}`);
                return { output: { campaigns: data.newsletters ?? data.campaigns ?? data ?? [] } };
            }

            case 'getCampaign': {
                if (!inputs.campaignId) return { error: 'Missing required input: campaignId' };
                const url = new URL(`${VERO_BASE_URL}/newsletters/${inputs.campaignId}`);
                url.searchParams.set('auth_token', auth_token);
                const res = await fetch(url.toString(), {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.message ?? `Vero API error ${res.status}`);
                return { output: { campaign: data } };
            }

            default:
                return { error: `Vero action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Vero action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown Vero error' };
    }
}
