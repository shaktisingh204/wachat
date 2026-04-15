'use server';

export async function executeGenesysCloudAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const region = inputs.region || 'us-east-1';
        const baseUrl = `https://api.${region}.pure.cloud`;

        async function getAccessToken(): Promise<string> {
            if (inputs.accessToken) return inputs.accessToken;
            const loginUrl = `https://login.${region}.pure.cloud/oauth/token`;
            const credentials = Buffer.from(`${inputs.clientId}:${inputs.clientSecret}`).toString('base64');
            const res = await fetch(loginUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'grant_type=client_credentials',
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error_description || data?.error || `Genesys Cloud auth error: ${res.status}`);
            }
            return data.access_token;
        }

        async function genesysFetch(method: string, path: string, body?: any) {
            logger?.log(`[GenesysCloud] ${method} ${path}`);
            const token = await getAccessToken();
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${baseUrl}${path}`, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.message || data?.error?.message || `Genesys Cloud API error: ${res.status}`);
            }
            return data;
        }

        switch (actionName) {
            case 'listQueues': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageNumber) params.set('pageNumber', inputs.pageNumber);
                if (inputs.name) params.set('name', inputs.name);
                const data = await genesysFetch('GET', `/api/v2/routing/queues?${params.toString()}`);
                return { output: data };
            }

            case 'getQueue': {
                const data = await genesysFetch('GET', `/api/v2/routing/queues/${inputs.queueId}`);
                return { output: data };
            }

            case 'createQueue': {
                const body: any = {
                    name: inputs.name,
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.mediaSettings) body.mediaSettings = inputs.mediaSettings;
                if (inputs.acwSettings) body.acwSettings = inputs.acwSettings;
                if (inputs.skillEvaluationMethod) body.skillEvaluationMethod = inputs.skillEvaluationMethod;
                const data = await genesysFetch('POST', '/api/v2/routing/queues', body);
                return { output: data };
            }

            case 'listConversations': {
                const params = new URLSearchParams();
                if (inputs.startTime) params.set('startTime', inputs.startTime);
                if (inputs.endTime) params.set('endTime', inputs.endTime);
                if (inputs.conversationFilters) params.set('conversationFilters', inputs.conversationFilters);
                const data = await genesysFetch('GET', `/api/v2/conversations?${params.toString()}`);
                return { output: data };
            }

            case 'getConversation': {
                const data = await genesysFetch('GET', `/api/v2/conversations/${inputs.conversationId}`);
                return { output: data };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageNumber) params.set('pageNumber', inputs.pageNumber);
                if (inputs.state) params.set('state', inputs.state);
                if (inputs.name) params.set('name', inputs.name);
                const data = await genesysFetch('GET', `/api/v2/users?${params.toString()}`);
                return { output: data };
            }

            case 'getUser': {
                const data = await genesysFetch('GET', `/api/v2/users/${inputs.userId}`);
                return { output: data };
            }

            case 'listRoutingSkills': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageNumber) params.set('pageNumber', inputs.pageNumber);
                if (inputs.name) params.set('name', inputs.name);
                const data = await genesysFetch('GET', `/api/v2/routing/skills?${params.toString()}`);
                return { output: data };
            }

            case 'assignUserSkill': {
                const body = [{
                    id: inputs.skillId,
                    proficiency: inputs.proficiency || 1,
                }];
                const data = await genesysFetch('PUT', `/api/v2/users/${inputs.userId}/routingskills/bulk`, body);
                return { output: data };
            }

            case 'listCampaigns': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageNumber) params.set('pageNumber', inputs.pageNumber);
                if (inputs.name) params.set('name', inputs.name);
                const data = await genesysFetch('GET', `/api/v2/outbound/campaigns?${params.toString()}`);
                return { output: data };
            }

            case 'createCampaign': {
                const body: any = {
                    name: inputs.name,
                    dialingMode: inputs.dialingMode || 'preview',
                    callerName: inputs.callerName,
                    callerAddress: inputs.callerAddress,
                    contactListId: inputs.contactListId,
                };
                if (inputs.queueId) body.queue = { id: inputs.queueId };
                if (inputs.phoneColumns) body.phoneColumns = inputs.phoneColumns;
                const data = await genesysFetch('POST', '/api/v2/outbound/campaigns', body);
                return { output: data };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageNumber) params.set('pageNumber', inputs.pageNumber);
                const data = await genesysFetch('GET', `/api/v2/outbound/contactlists/${inputs.contactListId}/contacts?${params.toString()}`);
                return { output: data };
            }

            case 'createContact': {
                const body = inputs.contacts || [inputs.contact];
                const data = await genesysFetch('POST', `/api/v2/outbound/contactlists/${inputs.contactListId}/contacts`, body);
                return { output: data };
            }

            case 'updateContact': {
                const body = inputs.contactData || {};
                const data = await genesysFetch('PUT', `/api/v2/outbound/contactlists/${inputs.contactListId}/contacts/${inputs.contactId}`, body);
                return { output: data };
            }

            case 'sendMessage': {
                const body: any = {
                    queueId: inputs.queueId,
                    toAddress: inputs.toAddress,
                    toAddressMessengerType: inputs.messengerType || 'sms',
                    useExistingActiveConversation: inputs.useExistingActiveConversation || false,
                };
                const data = await genesysFetch('POST', '/api/v2/conversations/messages/agentless', body);
                return { output: data };
            }

            default:
                return { error: `Genesys Cloud action "${actionName}" is not implemented.` };
        }
    } catch (error: any) {
        logger?.log(`[GenesysCloud] Error: ${error.message}`);
        return { error: error.message || 'An unknown error occurred in Genesys Cloud action.' };
    }
}
