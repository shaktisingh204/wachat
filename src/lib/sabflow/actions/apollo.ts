'use server';

export async function executeApolloAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    const { apiKey, ...params } = inputs;

    if (!apiKey) {
        return { error: 'apiKey is required' };
    }

    const BASE = 'https://api.apollo.io/v1';

    async function get(path: string, query: Record<string, string> = {}) {
        query.api_key = apiKey;
        const qs = new URLSearchParams(query).toString();
        const res = await fetch(`${BASE}${path}?${qs}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Apollo GET ${path} failed (${res.status}): ${text}`);
        }
        return res.json();
    }

    async function post(path: string, body: any = {}) {
        body.api_key = apiKey;
        const res = await fetch(`${BASE}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Apollo POST ${path} failed (${res.status}): ${text}`);
        }
        return res.json();
    }

    async function put(path: string, body: any = {}) {
        body.api_key = apiKey;
        const res = await fetch(`${BASE}${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Apollo PUT ${path} failed (${res.status}): ${text}`);
        }
        return res.json();
    }

    try {
        switch (actionName) {
            case 'searchPeople': {
                const { q_keywords, page, perPage, ...filters } = params;
                const data = await post('/mixed_people/search', {
                    q_keywords,
                    page: page || 1,
                    per_page: perPage || 25,
                    ...filters,
                });
                return { output: data };
            }
            case 'getPerson': {
                const { personId } = params;
                if (!personId) return { error: 'personId is required' };
                const data = await get(`/people/${personId}`);
                return { output: data };
            }
            case 'updatePerson': {
                const { personId, ...updates } = params;
                if (!personId) return { error: 'personId is required' };
                const data = await put(`/people/${personId}`, updates);
                return { output: data };
            }
            case 'searchOrganizations': {
                const { q_organization_name, page, perPage, ...filters } = params;
                const data = await post('/mixed_companies/search', {
                    q_organization_name,
                    page: page || 1,
                    per_page: perPage || 25,
                    ...filters,
                });
                return { output: data };
            }
            case 'getOrganization': {
                const { organizationId } = params;
                if (!organizationId) return { error: 'organizationId is required' };
                const data = await get(`/organizations/${organizationId}`);
                return { output: data };
            }
            case 'createContact': {
                const { firstName, lastName, email, organizationName, ...rest } = params;
                if (!firstName || !lastName) return { error: 'firstName and lastName are required' };
                const data = await post('/contacts', {
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    organization_name: organizationName,
                    ...rest,
                });
                return { output: data };
            }
            case 'updateContact': {
                const { contactId, ...updates } = params;
                if (!contactId) return { error: 'contactId is required' };
                const data = await put(`/contacts/${contactId}`, updates);
                return { output: data };
            }
            case 'listSequences': {
                const { page, perPage } = params;
                const data = await get('/emailer_campaigns', {
                    page: String(page || 1),
                    per_page: String(perPage || 25),
                });
                return { output: data };
            }
            case 'addToSequence': {
                const { sequenceId, contactIds, emailAccountId } = params;
                if (!sequenceId || !contactIds) return { error: 'sequenceId and contactIds are required' };
                const data = await post(`/emailer_campaigns/${sequenceId}/add_contact_ids`, {
                    contact_ids: Array.isArray(contactIds) ? contactIds : [contactIds],
                    emailer_campaign_id: sequenceId,
                    send_email_from_email_account_id: emailAccountId,
                });
                return { output: data };
            }
            case 'removeFromSequence': {
                const { sequenceId, contactIds } = params;
                if (!sequenceId || !contactIds) return { error: 'sequenceId and contactIds are required' };
                const data = await post(`/emailer_campaigns/${sequenceId}/remove_contact_ids`, {
                    contact_ids: Array.isArray(contactIds) ? contactIds : [contactIds],
                });
                return { output: data };
            }
            case 'searchEmails': {
                const { q_keywords, page, perPage } = params;
                const data = await post('/mixed_people/search', {
                    q_keywords,
                    page: page || 1,
                    per_page: perPage || 25,
                    reveal_personal_emails: true,
                });
                return { output: data };
            }
            case 'findEmail': {
                const { firstName, lastName, domain, organizationName } = params;
                if (!firstName || !lastName || (!domain && !organizationName)) {
                    return { error: 'firstName, lastName, and domain or organizationName are required' };
                }
                const data = await post('/people/match', {
                    first_name: firstName,
                    last_name: lastName,
                    domain,
                    organization_name: organizationName,
                    reveal_personal_emails: true,
                });
                return { output: data };
            }
            case 'getOpportunity': {
                const { opportunityId } = params;
                if (!opportunityId) return { error: 'opportunityId is required' };
                const data = await get(`/opportunities/${opportunityId}`);
                return { output: data };
            }
            case 'createOpportunity': {
                const { name, amount, closedDate, ...rest } = params;
                if (!name) return { error: 'name is required' };
                const data = await post('/opportunities', {
                    name,
                    amount,
                    closed_date: closedDate,
                    ...rest,
                });
                return { output: data };
            }
            case 'listOpportunities': {
                const { page, perPage } = params;
                const data = await get('/opportunities', {
                    page: String(page || 1),
                    per_page: String(perPage || 25),
                });
                return { output: data };
            }
            default:
                return { error: `Unknown Apollo action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Apollo action error: ${err.message}`);
        return { error: err.message };
    }
}
