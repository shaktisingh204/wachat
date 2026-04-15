'use server';

export async function executeSalesflareAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    const { apiKey, ...params } = inputs;

    if (!apiKey) {
        return { error: 'apiKey is required' };
    }

    const BASE = 'https://api.salesflare.com';

    async function req(method: string, path: string, body?: any) {
        const res = await fetch(`${BASE}${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Salesflare ${method} ${path} failed (${res.status}): ${text}`);
        }
        return res.json();
    }

    try {
        switch (actionName) {
            case 'listAccounts': {
                const data = await req('GET', '/accounts');
                return { output: data };
            }
            case 'getAccount': {
                const { accountId } = params;
                if (!accountId) return { error: 'accountId is required' };
                const data = await req('GET', `/accounts/${accountId}`);
                return { output: data };
            }
            case 'createAccount': {
                const { name, website, ...rest } = params;
                if (!name) return { error: 'name is required' };
                const data = await req('POST', '/accounts', { name, website, ...rest });
                return { output: data };
            }
            case 'updateAccount': {
                const { accountId, ...updates } = params;
                if (!accountId) return { error: 'accountId is required' };
                const data = await req('PATCH', `/accounts/${accountId}`, updates);
                return { output: data };
            }
            case 'deleteAccount': {
                const { accountId } = params;
                if (!accountId) return { error: 'accountId is required' };
                const data = await req('DELETE', `/accounts/${accountId}`);
                return { output: data };
            }
            case 'listContacts': {
                const data = await req('GET', '/contacts');
                return { output: data };
            }
            case 'getContact': {
                const { contactId } = params;
                if (!contactId) return { error: 'contactId is required' };
                const data = await req('GET', `/contacts/${contactId}`);
                return { output: data };
            }
            case 'createContact': {
                const { firstname, lastname, email, ...rest } = params;
                if (!firstname && !lastname && !email) return { error: 'At least one of firstname, lastname, or email is required' };
                const data = await req('POST', '/contacts', { firstname, lastname, email, ...rest });
                return { output: data };
            }
            case 'updateContact': {
                const { contactId, ...updates } = params;
                if (!contactId) return { error: 'contactId is required' };
                const data = await req('PATCH', `/contacts/${contactId}`, updates);
                return { output: data };
            }
            case 'deleteContact': {
                const { contactId } = params;
                if (!contactId) return { error: 'contactId is required' };
                const data = await req('DELETE', `/contacts/${contactId}`);
                return { output: data };
            }
            case 'listOpportunities': {
                const data = await req('GET', '/opportunities');
                return { output: data };
            }
            case 'getOpportunity': {
                const { opportunityId } = params;
                if (!opportunityId) return { error: 'opportunityId is required' };
                const data = await req('GET', `/opportunities/${opportunityId}`);
                return { output: data };
            }
            case 'createOpportunity': {
                const { name, accountId, ...rest } = params;
                if (!name) return { error: 'name is required' };
                const data = await req('POST', '/opportunities', { name, account_id: accountId, ...rest });
                return { output: data };
            }
            case 'updateOpportunity': {
                const { opportunityId, ...updates } = params;
                if (!opportunityId) return { error: 'opportunityId is required' };
                const data = await req('PATCH', `/opportunities/${opportunityId}`, updates);
                return { output: data };
            }
            case 'listTasks': {
                const data = await req('GET', '/tasks');
                return { output: data };
            }
            case 'createTask': {
                const { description, date, ...rest } = params;
                if (!description) return { error: 'description is required' };
                const data = await req('POST', '/tasks', { description, date, ...rest });
                return { output: data };
            }
            case 'listUsers': {
                const data = await req('GET', '/users');
                return { output: data };
            }
            case 'getUser': {
                const { userId } = params;
                if (!userId) return { error: 'userId is required' };
                const data = await req('GET', `/users/${userId}`);
                return { output: data };
            }
            default:
                return { error: `Unknown Salesflare action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Salesflare action error: ${err.message}`);
        return { error: err.message };
    }
}
