'use server';

export async function executeFive9Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { username, password } = inputs;
        const base64Auth = Buffer.from(`${username}:${password}`).toString('base64');
        const baseUrl = 'https://app.five9.com/appsvcs/rs/svc';

        const headers: Record<string, string> = {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        async function five9Fetch(method: string, path: string, body?: any) {
            logger?.log(`[Five9] ${method} ${path}`);
            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${baseUrl}${path}`, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.message || data?.error || `Five9 API error: ${res.status}`);
            }
            return data;
        }

        switch (actionName) {
            case 'listAgents': {
                const params = new URLSearchParams();
                if (inputs.filterConfig) params.set('filterConfig', inputs.filterConfig);
                const data = await five9Fetch('GET', `/agents?${params.toString()}`);
                return { output: data };
            }

            case 'getAgent': {
                const data = await five9Fetch('GET', `/agents/${encodeURIComponent(inputs.agentUsername)}`);
                return { output: data };
            }

            case 'listSkills': {
                const data = await five9Fetch('GET', '/skills');
                return { output: data };
            }

            case 'listCampaigns': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                const data = await five9Fetch('GET', `/campaigns?${params.toString()}`);
                return { output: data };
            }

            case 'getCampaign': {
                const data = await five9Fetch('GET', `/campaigns/${encodeURIComponent(inputs.campaignName)}`);
                return { output: data };
            }

            case 'startCampaign': {
                const data = await five9Fetch('PUT', `/campaigns/${encodeURIComponent(inputs.campaignName)}/state`, {
                    state: 'RUNNING',
                });
                return { output: data };
            }

            case 'stopCampaign': {
                const data = await five9Fetch('PUT', `/campaigns/${encodeURIComponent(inputs.campaignName)}/state`, {
                    state: 'NOT_RUNNING',
                });
                return { output: data };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.fields) params.set('fields', inputs.fields);
                if (inputs.filterConfig) params.set('filterConfig', inputs.filterConfig);
                const data = await five9Fetch('GET', `/contacts?${params.toString()}`);
                return { output: data };
            }

            case 'getContact': {
                const params = new URLSearchParams();
                if (inputs.fields) params.set('fields', inputs.fields);
                const data = await five9Fetch('GET', `/contacts/${encodeURIComponent(inputs.contactId)}?${params.toString()}`);
                return { output: data };
            }

            case 'addContact': {
                const body: any = {
                    fields: inputs.fields || {},
                };
                if (inputs.allowDuplicates !== undefined) body.allowDuplicates = inputs.allowDuplicates;
                const data = await five9Fetch('POST', '/contacts', body);
                return { output: data };
            }

            case 'updateContact': {
                const body: any = {
                    fields: inputs.fields || {},
                };
                const data = await five9Fetch('PUT', `/contacts/${encodeURIComponent(inputs.contactId)}`, body);
                return { output: data };
            }

            case 'deleteContact': {
                await five9Fetch('DELETE', `/contacts/${encodeURIComponent(inputs.contactId)}`);
                return { output: { success: true, contactId: inputs.contactId } };
            }

            case 'listCallLists': {
                const data = await five9Fetch('GET', '/lists');
                return { output: data };
            }

            case 'getCallList': {
                const params = new URLSearchParams();
                if (inputs.fields) params.set('fields', inputs.fields);
                if (inputs.offset) params.set('offset', inputs.offset);
                if (inputs.rows) params.set('rows', inputs.rows);
                const data = await five9Fetch('GET', `/lists/${encodeURIComponent(inputs.listName)}?${params.toString()}`);
                return { output: data };
            }

            case 'getDomainStatistics': {
                const params = new URLSearchParams();
                if (inputs.statisticType) params.set('statisticType', inputs.statisticType);
                const data = await five9Fetch('GET', `/statistics/domain?${params.toString()}`);
                return { output: data };
            }

            default:
                return { error: `Five9 action "${actionName}" is not implemented.` };
        }
    } catch (error: any) {
        logger?.log(`[Five9] Error: ${error.message}`);
        return { error: error.message || 'An unknown error occurred in Five9 action.' };
    }
}
