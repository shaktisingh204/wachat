'use server';

export async function executeLeverAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const BASE_URL = 'https://api.lever.co/v1';
        const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;

        const leverFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[Lever] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${BASE_URL}${path}`, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || data?.code || `Lever API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listOpportunities': {
                const limit = Number(inputs.limit ?? 100);
                const offset = inputs.offset ? `&offset=${inputs.offset}` : '';
                const data = await leverFetch('GET', `/opportunities?limit=${limit}${offset}`);
                return { output: { opportunities: data.data ?? data, hasNext: data.hasNext ?? false, next: data.next ?? null } };
            }
            case 'getOpportunity': {
                const opportunityId = String(inputs.opportunityId ?? '').trim();
                if (!opportunityId) throw new Error('opportunityId is required.');
                const data = await leverFetch('GET', `/opportunities/${opportunityId}`);
                return { output: { opportunity: data.data ?? data } };
            }
            case 'createOpportunity': {
                const body = inputs.opportunityData ?? {};
                const data = await leverFetch('POST', `/opportunities`, body);
                return { output: { opportunity: data.data ?? data } };
            }
            case 'updateOpportunity': {
                const opportunityId = String(inputs.opportunityId ?? '').trim();
                if (!opportunityId) throw new Error('opportunityId is required.');
                const body = inputs.opportunityData ?? {};
                const data = await leverFetch('PUT', `/opportunities/${opportunityId}`, body);
                return { output: { opportunity: data.data ?? data } };
            }
            case 'listContacts': {
                const limit = Number(inputs.limit ?? 100);
                const offset = inputs.offset ? `&offset=${inputs.offset}` : '';
                const data = await leverFetch('GET', `/contacts?limit=${limit}${offset}`);
                return { output: { contacts: data.data ?? data, hasNext: data.hasNext ?? false } };
            }
            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await leverFetch('GET', `/contacts/${contactId}`);
                return { output: { contact: data.data ?? data } };
            }
            case 'createContact': {
                const body = inputs.contactData ?? {};
                const data = await leverFetch('POST', `/contacts`, body);
                return { output: { contact: data.data ?? data } };
            }
            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body = inputs.contactData ?? {};
                const data = await leverFetch('PUT', `/contacts/${contactId}`, body);
                return { output: { contact: data.data ?? data } };
            }
            case 'listPostings': {
                const limit = Number(inputs.limit ?? 100);
                const offset = inputs.offset ? `&offset=${inputs.offset}` : '';
                const state = inputs.state ? `&state=${inputs.state}` : '';
                const data = await leverFetch('GET', `/postings?limit=${limit}${offset}${state}`);
                return { output: { postings: data.data ?? data, hasNext: data.hasNext ?? false } };
            }
            case 'getPosting': {
                const postingId = String(inputs.postingId ?? '').trim();
                if (!postingId) throw new Error('postingId is required.');
                const data = await leverFetch('GET', `/postings/${postingId}`);
                return { output: { posting: data.data ?? data } };
            }
            case 'createPosting': {
                const body = inputs.postingData ?? {};
                const data = await leverFetch('POST', `/postings`, body);
                return { output: { posting: data.data ?? data } };
            }
            case 'updatePosting': {
                const postingId = String(inputs.postingId ?? '').trim();
                if (!postingId) throw new Error('postingId is required.');
                const body = inputs.postingData ?? {};
                const data = await leverFetch('PUT', `/postings/${postingId}`, body);
                return { output: { posting: data.data ?? data } };
            }
            case 'archivePosting': {
                const postingId = String(inputs.postingId ?? '').trim();
                if (!postingId) throw new Error('postingId is required.');
                const data = await leverFetch('POST', `/postings/${postingId}/close`);
                return { output: { posting: data.data ?? data } };
            }
            case 'listStages': {
                const data = await leverFetch('GET', `/stages`);
                return { output: { stages: data.data ?? data } };
            }
            case 'listUsers': {
                const limit = Number(inputs.limit ?? 100);
                const offset = inputs.offset ? `&offset=${inputs.offset}` : '';
                const data = await leverFetch('GET', `/users?limit=${limit}${offset}`);
                return { output: { users: data.data ?? data, hasNext: data.hasNext ?? false } };
            }
            default:
                return { error: `Unknown Lever action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Lever] Error: ${err.message}`);
        return { error: err.message ?? 'Lever action failed.' };
    }
}
