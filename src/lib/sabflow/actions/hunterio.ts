'use server';

export async function executeHunterioAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.hunter.io/v2';
    const key = inputs.apiKey;

    try {
        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'domainSearch':
                url = `${BASE}/domain-search?api_key=${key}&domain=${encodeURIComponent(inputs.domain || '')}&limit=${inputs.limit || 10}&offset=${inputs.offset || 0}`;
                break;
            case 'emailFinder':
                url = `${BASE}/email-finder?api_key=${key}&domain=${encodeURIComponent(inputs.domain || '')}&first_name=${encodeURIComponent(inputs.firstName || '')}&last_name=${encodeURIComponent(inputs.lastName || '')}`;
                break;
            case 'emailVerifier':
                url = `${BASE}/email-verifier?api_key=${key}&email=${encodeURIComponent(inputs.email || '')}`;
                break;
            case 'emailCount':
                url = `${BASE}/email-count?api_key=${key}&domain=${encodeURIComponent(inputs.domain || '')}`;
                break;
            case 'listLeads':
                url = `${BASE}/leads?api_key=${key}&limit=${inputs.limit || 10}&offset=${inputs.offset || 0}`;
                break;
            case 'getLead':
                url = `${BASE}/leads/${inputs.leadId}?api_key=${key}`;
                break;
            case 'createLead': {
                url = `${BASE}/leads?api_key=${key}`;
                method = 'POST';
                body = JSON.stringify({ email: inputs.email, first_name: inputs.firstName, last_name: inputs.lastName, company: inputs.company, phone_number: inputs.phoneNumber, notes: inputs.notes });
                break;
            }
            case 'updateLead': {
                url = `${BASE}/leads/${inputs.leadId}?api_key=${key}`;
                method = 'PUT';
                body = JSON.stringify({ email: inputs.email, first_name: inputs.firstName, last_name: inputs.lastName, company: inputs.company, phone_number: inputs.phoneNumber, notes: inputs.notes });
                break;
            }
            case 'deleteLead':
                url = `${BASE}/leads/${inputs.leadId}?api_key=${key}`;
                method = 'DELETE';
                break;
            case 'listLeadLists':
                url = `${BASE}/leads_lists?api_key=${key}&limit=${inputs.limit || 10}&offset=${inputs.offset || 0}`;
                break;
            case 'createLeadList': {
                url = `${BASE}/leads_lists?api_key=${key}`;
                method = 'POST';
                body = JSON.stringify({ name: inputs.name });
                break;
            }
            case 'updateLeadList': {
                url = `${BASE}/leads_lists/${inputs.listId}?api_key=${key}`;
                method = 'PUT';
                body = JSON.stringify({ name: inputs.name });
                break;
            }
            case 'deleteLeadList':
                url = `${BASE}/leads_lists/${inputs.listId}?api_key=${key}`;
                method = 'DELETE';
                break;
            case 'moveToList': {
                url = `${BASE}/leads/${inputs.leadId}?api_key=${key}`;
                method = 'PUT';
                body = JSON.stringify({ leads_list_id: inputs.listId });
                break;
            }
            case 'getAccount':
                url = `${BASE}/account?api_key=${key}`;
                break;
            default:
                return { error: `Unknown Hunter.io action: ${actionName}` };
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const res = await fetch(url, { method, headers, body });
        const data = await res.json();
        if (!res.ok) return { error: data?.errors?.[0]?.details || data?.message || `HTTP ${res.status}` };
        return { output: data };
    } catch (err: any) {
        return { error: err?.message || 'Unknown error in executeHunterioAction' };
    }
}
