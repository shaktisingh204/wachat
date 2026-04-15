'use server';

export async function executeUpleadAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    const { apiKey, ...params } = inputs;

    if (!apiKey) {
        return { error: 'apiKey is required' };
    }

    const BASE = 'https://api.uplead.com/v2';

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
            throw new Error(`UpLead ${method} ${path} failed (${res.status}): ${text}`);
        }
        return res.json();
    }

    try {
        switch (actionName) {
            case 'searchContacts': {
                const { query, limit, offset, ...filters } = params;
                const data = await req('POST', '/contacts/search', { query, limit, offset, ...filters });
                return { output: data };
            }
            case 'getContact': {
                const { contactId } = params;
                if (!contactId) return { error: 'contactId is required' };
                const data = await req('GET', `/contacts/${contactId}`);
                return { output: data };
            }
            case 'getContactByEmail': {
                const { email } = params;
                if (!email) return { error: 'email is required' };
                const data = await req('POST', '/contacts/search', { email });
                return { output: data };
            }
            case 'searchCompanies': {
                const { query, limit, offset, ...filters } = params;
                const data = await req('POST', '/companies/search', { query, limit, offset, ...filters });
                return { output: data };
            }
            case 'getCompany': {
                const { companyId } = params;
                if (!companyId) return { error: 'companyId is required' };
                const data = await req('GET', `/companies/${companyId}`);
                return { output: data };
            }
            case 'getCompanyByDomain': {
                const { domain } = params;
                if (!domain) return { error: 'domain is required' };
                const data = await req('POST', '/companies/search', { domain });
                return { output: data };
            }
            case 'findEmail': {
                const { firstName, lastName, domain, company } = params;
                if (!firstName || !lastName || (!domain && !company)) {
                    return { error: 'firstName, lastName, and domain or company are required' };
                }
                const data = await req('POST', '/email-finder', { first_name: firstName, last_name: lastName, domain, company });
                return { output: data };
            }
            case 'listSavedLists': {
                const data = await req('GET', '/lists');
                return { output: data };
            }
            case 'addToList': {
                const { listId, contactIds } = params;
                if (!listId || !contactIds) return { error: 'listId and contactIds are required' };
                const data = await req('POST', `/lists/${listId}/contacts`, { contact_ids: contactIds });
                return { output: data };
            }
            case 'removeFromList': {
                const { listId, contactIds } = params;
                if (!listId || !contactIds) return { error: 'listId and contactIds are required' };
                const data = await req('DELETE', `/lists/${listId}/contacts`, { contact_ids: contactIds });
                return { output: data };
            }
            case 'getCreditBalance': {
                const data = await req('GET', '/user/credits');
                return { output: data };
            }
            case 'verifyEmail': {
                const { email } = params;
                if (!email) return { error: 'email is required' };
                const data = await req('POST', '/email-verify', { email });
                return { output: data };
            }
            case 'bulkVerifyEmails': {
                const { emails } = params;
                if (!emails || !Array.isArray(emails)) return { error: 'emails array is required' };
                const data = await req('POST', '/email-verify/bulk', { emails });
                return { output: data };
            }
            default:
                return { error: `Unknown UpLead action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`UpLead action error: ${err.message}`);
        return { error: err.message };
    }
}
