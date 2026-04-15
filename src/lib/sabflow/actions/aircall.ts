'use server';

export async function executeAircallAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { apiId, apiToken } = inputs;
        const base64Auth = Buffer.from(`${apiId}:${apiToken}`).toString('base64');
        const baseUrl = 'https://api.aircall.io/v1';

        const headers: Record<string, string> = {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        async function aircallFetch(method: string, path: string, body?: any) {
            logger?.log(`[Aircall] ${method} ${path}`);
            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${baseUrl}${path}`, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.message || data?.error || `Aircall API error: ${res.status}`);
            }
            return data;
        }

        switch (actionName) {
            case 'listCalls': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.per_page) params.set('per_page', inputs.per_page);
                if (inputs.page) params.set('page', inputs.page);
                const data = await aircallFetch('GET', `/calls?${params.toString()}`);
                return { output: data };
            }

            case 'getCall': {
                const data = await aircallFetch('GET', `/calls/${inputs.callId}`);
                return { output: data };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.per_page) params.set('per_page', inputs.per_page);
                if (inputs.page) params.set('page', inputs.page);
                const data = await aircallFetch('GET', `/users?${params.toString()}`);
                return { output: data };
            }

            case 'getUser': {
                const data = await aircallFetch('GET', `/users/${inputs.userId}`);
                return { output: data };
            }

            case 'listNumbers': {
                const params = new URLSearchParams();
                if (inputs.per_page) params.set('per_page', inputs.per_page);
                if (inputs.page) params.set('page', inputs.page);
                const data = await aircallFetch('GET', `/numbers?${params.toString()}`);
                return { output: data };
            }

            case 'getNumber': {
                const data = await aircallFetch('GET', `/numbers/${inputs.numberId}`);
                return { output: data };
            }

            case 'createOutboundCall': {
                const body: any = {
                    number_id: inputs.numberId,
                    to: inputs.to,
                };
                if (inputs.userId) body.user_id = inputs.userId;
                const data = await aircallFetch('POST', '/calls', body);
                return { output: data };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.per_page) params.set('per_page', inputs.per_page);
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.search) params.set('search', inputs.search);
                const data = await aircallFetch('GET', `/contacts?${params.toString()}`);
                return { output: data };
            }

            case 'getContact': {
                const data = await aircallFetch('GET', `/contacts/${inputs.contactId}`);
                return { output: data };
            }

            case 'createContact': {
                const body: any = {
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                };
                if (inputs.email) body.email = inputs.email;
                if (inputs.phone_numbers) body.phone_numbers = inputs.phone_numbers;
                if (inputs.company_name) body.company_name = inputs.company_name;
                const data = await aircallFetch('POST', '/contacts', body);
                return { output: data };
            }

            case 'updateContact': {
                const body: any = {};
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.email) body.email = inputs.email;
                if (inputs.phone_numbers) body.phone_numbers = inputs.phone_numbers;
                if (inputs.company_name) body.company_name = inputs.company_name;
                const data = await aircallFetch('PUT', `/contacts/${inputs.contactId}`, body);
                return { output: data };
            }

            case 'deleteContact': {
                await aircallFetch('DELETE', `/contacts/${inputs.contactId}`);
                return { output: { success: true, contactId: inputs.contactId } };
            }

            case 'listTeams': {
                const params = new URLSearchParams();
                if (inputs.per_page) params.set('per_page', inputs.per_page);
                if (inputs.page) params.set('page', inputs.page);
                const data = await aircallFetch('GET', `/teams?${params.toString()}`);
                return { output: data };
            }

            case 'getTeam': {
                const data = await aircallFetch('GET', `/teams/${inputs.teamId}`);
                return { output: data };
            }

            case 'listTags': {
                const params = new URLSearchParams();
                if (inputs.per_page) params.set('per_page', inputs.per_page);
                if (inputs.page) params.set('page', inputs.page);
                const data = await aircallFetch('GET', `/tags?${params.toString()}`);
                return { output: data };
            }

            default:
                return { error: `Aircall action "${actionName}" is not implemented.` };
        }
    } catch (error: any) {
        logger?.log(`[Aircall] Error: ${error.message}`);
        return { error: error.message || 'An unknown error occurred in Aircall action.' };
    }
}
