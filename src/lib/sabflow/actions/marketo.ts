'use server';

async function getMarketoToken(instanceId: string, clientId: string, clientSecret: string, logger?: any): Promise<string> {
    logger?.log(`[Marketo] Fetching access token for instance ${instanceId}`);
    const url = `https://${instanceId}.mktorest.com/identity/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
    const res = await fetch(url, { method: 'GET' });
    const data = await res.json();
    if (!res.ok || !data?.access_token) {
        throw new Error(data?.error_description ?? data?.error ?? `Marketo auth error: ${res.status}`);
    }
    return data.access_token as string;
}

async function marketoFetch(
    baseUrl: string,
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[Marketo] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${path}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.errors?.[0]?.message ?? `Marketo API error: ${res.status}`);
    if (data?.errors?.length) throw new Error(data.errors[0]?.message ?? 'Marketo API error');
    return data;
}

export async function executeMarketoAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const instanceId = String(inputs.instanceId ?? '').trim();
        if (!instanceId) throw new Error('instanceId is required.');

        const baseUrl = `https://${instanceId}.mktorest.com/rest`;

        let accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) {
            const clientId = String(inputs.clientId ?? '').trim();
            const clientSecret = String(inputs.clientSecret ?? '').trim();
            if (!clientId) throw new Error('clientId is required when accessToken is not provided.');
            if (!clientSecret) throw new Error('clientSecret is required when accessToken is not provided.');
            accessToken = await getMarketoToken(instanceId, clientId, clientSecret, logger);
        }

        const mk = (method: string, path: string, body?: any) =>
            marketoFetch(baseUrl, accessToken, method, path, body, logger);

        switch (actionName) {
            case 'getLead': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await mk('GET', `/v1/lead/${id}.json`);
                return { output: { lead: data?.result?.[0] ?? data } };
            }

            case 'getLeadByField': {
                const field = String(inputs.field ?? 'email').trim();
                const values = String(inputs.values ?? '').trim();
                if (!values) throw new Error('values is required.');
                const data = await mk('GET', `/v1/leads.json?filterType=${encodeURIComponent(field)}&filterValues=${encodeURIComponent(values)}`);
                return { output: { leads: data?.result ?? [] } };
            }

            case 'createUpdateLeads': {
                const body = {
                    action: inputs.action ?? 'createOrUpdate',
                    lookupField: inputs.lookupField ?? 'email',
                    input: Array.isArray(inputs.input) ? inputs.input : [inputs.input ?? {}],
                };
                const data = await mk('POST', '/v1/leads.json', body);
                return { output: { result: data?.result ?? data } };
            }

            case 'deleteLeads': {
                const input = Array.isArray(inputs.input) ? inputs.input : [{ id: inputs.id }];
                const data = await mk('POST', '/v1/leads/delete.json', { input });
                return { output: { result: data?.result ?? data } };
            }

            case 'addToList': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const input = Array.isArray(inputs.input) ? inputs.input : [{ id: inputs.leadId }];
                const data = await mk('POST', `/v1/lists/${listId}/leads.json`, { input });
                return { output: { result: data?.result ?? data } };
            }

            case 'removeFromList': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const input = Array.isArray(inputs.input) ? inputs.input : [{ id: inputs.leadId }];
                const data = await mk('DELETE', `/v1/lists/${listId}/leads.json`, { input });
                return { output: { result: data?.result ?? data } };
            }

            case 'getList': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await mk('GET', `/v1/lists/${id}.json`);
                return { output: { list: data?.result?.[0] ?? data } };
            }

            case 'getLists': {
                const data = await mk('GET', '/v1/lists.json');
                return { output: { lists: data?.result ?? [] } };
            }

            case 'getCampaigns': {
                const data = await mk('GET', '/v1/campaigns.json');
                return { output: { campaigns: data?.result ?? [] } };
            }

            case 'triggerCampaign': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const body: any = {};
                if (inputs.input) body.input = inputs.input;
                const data = await mk('POST', `/v1/campaigns/${id}/trigger.json`, body);
                return { output: { result: data?.result ?? data } };
            }

            case 'scheduleCampaign': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const body: any = {};
                if (inputs.input) body.input = inputs.input;
                const data = await mk('POST', `/v1/campaigns/${id}/schedule.json`, body);
                return { output: { result: data?.result ?? data } };
            }

            case 'getPrograms': {
                const data = await mk('GET', '/asset/v1/programs.json');
                return { output: { programs: data?.result ?? [] } };
            }

            case 'createEmail': {
                const body = inputs.email ?? inputs;
                const data = await mk('POST', '/asset/v1/emails.json', body);
                return { output: { email: data?.result?.[0] ?? data } };
            }

            case 'getEmailStats': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await mk('GET', `/asset/v1/email/${id}/fullContent.json`);
                return { output: { emailContent: data?.result?.[0] ?? data } };
            }

            default:
                return { error: `Unknown Marketo action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Marketo] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Marketo error' };
    }
}
