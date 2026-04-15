'use server';

export async function executeLushaAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.lusha.com/v2';
    const apiKey = inputs.apiKey;

    try {
        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'enrichByLinkedIn':
                url = `${BASE}/person?linkedinUrl=${encodeURIComponent(inputs.linkedinUrl || '')}`;
                break;
            case 'enrichByEmail':
                url = `${BASE}/person?emailAddress=${encodeURIComponent(inputs.email || '')}`;
                break;
            case 'enrichByName': {
                const params = new URLSearchParams({ firstName: inputs.firstName || '', lastName: inputs.lastName || '', company: inputs.company || '' });
                url = `${BASE}/person?${params}`;
                break;
            }
            case 'enrichCompany':
                url = `${BASE}/company?domain=${encodeURIComponent(inputs.domain || '')}`;
                break;
            case 'searchPeople': {
                url = `${BASE}/people/search`;
                method = 'POST';
                body = JSON.stringify({
                    jobTitle: inputs.jobTitle,
                    company: inputs.company,
                    location: inputs.location,
                    limit: inputs.limit || 10,
                    offset: inputs.offset || 0,
                });
                break;
            }
            case 'searchCompanies': {
                url = `${BASE}/companies/search`;
                method = 'POST';
                body = JSON.stringify({
                    industry: inputs.industry,
                    location: inputs.location,
                    size: inputs.size,
                    limit: inputs.limit || 10,
                    offset: inputs.offset || 0,
                });
                break;
            }
            case 'getPerson':
                url = `${BASE}/person/${inputs.personId}`;
                break;
            case 'getCompany':
                url = `${BASE}/company/${inputs.companyId}`;
                break;
            case 'listActivities':
                url = `${BASE}/activities?limit=${inputs.limit || 20}&offset=${inputs.offset || 0}`;
                break;
            case 'getBalance':
                url = `${BASE}/account/balance`;
                break;
            case 'exportToCSV': {
                url = `${BASE}/export`;
                method = 'POST';
                body = JSON.stringify({ type: inputs.type || 'people', filters: inputs.filters || {} });
                break;
            }
            case 'listContacts':
                url = `${BASE}/contacts?limit=${inputs.limit || 20}&offset=${inputs.offset || 0}`;
                break;
            case 'getContact':
                url = `${BASE}/contacts/${inputs.contactId}`;
                break;
            case 'updateContact': {
                url = `${BASE}/contacts/${inputs.contactId}`;
                method = 'PUT';
                body = JSON.stringify({ notes: inputs.notes, tags: inputs.tags, status: inputs.status });
                break;
            }
            case 'deleteContact': {
                url = `${BASE}/contacts/${inputs.contactId}`;
                method = 'DELETE';
                break;
            }
            default:
                return { error: `Unknown Lusha action: ${actionName}` };
        }

        const headers: Record<string, string> = {
            'api_key': apiKey,
            'Content-Type': 'application/json',
        };

        const fetchOptions: RequestInit = { method, headers };
        if (body) fetchOptions.body = body;

        const res = await fetch(url, fetchOptions);
        const text = await res.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok) return { error: data?.error || data?.message || `HTTP ${res.status}` };
        return { output: data };
    } catch (err: any) {
        return { error: err?.message || 'Unknown error in executeLushaAction' };
    }
}
