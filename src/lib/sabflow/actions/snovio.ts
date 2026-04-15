'use server';

async function getSnovioToken(clientId: string, clientSecret: string): Promise<string> {
    const res = await fetch('https://api.snov.io/v1/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
        throw new Error(data.error || 'Failed to obtain Snov.io access token');
    }
    return data.access_token;
}

export async function executeSnovioAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.snov.io/v1';
    const clientId = inputs.clientId;
    const clientSecret = inputs.clientSecret;

    if (!clientId || !clientSecret) {
        return { error: 'Missing required credentials: inputs.clientId and inputs.clientSecret' };
    }

    try {
        const token = await getSnovioToken(clientId, clientSecret);

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'getEmailsFinder': {
                const body: any = {
                    domain: inputs.domain,
                    type: inputs.type || 'all',
                    limit: inputs.limit || 10,
                    lastId: inputs.lastId || 0,
                };
                const res = await fetch(`${BASE_URL}/get-emails-from-url`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io getEmailsFinder failed' };
                return { output: data };
            }

            case 'verifyEmail': {
                const email = inputs.email;
                if (!email) return { error: 'Missing inputs.email' };
                const body = { email };
                const res = await fetch(`${BASE_URL}/get-email-verifier`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io verifyEmail failed' };
                return { output: data };
            }

            case 'addProspect': {
                const body: any = {
                    email: inputs.email,
                    listId: inputs.listId,
                };
                if (inputs.firstName) body.firstName = inputs.firstName;
                if (inputs.lastName) body.lastName = inputs.lastName;
                if (inputs.company) body.company = inputs.company;
                if (inputs.position) body.position = inputs.position;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.country) body.country = inputs.country;
                const res = await fetch(`${BASE_URL}/add-prospect-to-list`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io addProspect failed' };
                return { output: data };
            }

            case 'getProspect': {
                const email = inputs.email;
                if (!email) return { error: 'Missing inputs.email' };
                const body = { email };
                const res = await fetch(`${BASE_URL}/get-prospect-by-email`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io getProspect failed' };
                return { output: data };
            }

            case 'findEmailByName': {
                const body: any = {
                    firstName: inputs.firstName,
                    lastName: inputs.lastName,
                    domain: inputs.domain,
                };
                if (inputs.position) body.position = inputs.position;
                const res = await fetch(`${BASE_URL}/get-emails-by-name`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io findEmailByName failed' };
                return { output: data };
            }

            case 'getEmailCount': {
                const domain = inputs.domain;
                if (!domain) return { error: 'Missing inputs.domain' };
                const body = { domain };
                const res = await fetch(`${BASE_URL}/get-domain-emails-count`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io getEmailCount failed' };
                return { output: data };
            }

            case 'addToList': {
                const body: any = {
                    name: inputs.name || inputs.listName,
                };
                if (inputs.listId) body.listId = inputs.listId;
                const res = await fetch(`${BASE_URL}/add-prospects-to-list`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io addToList failed' };
                return { output: data };
            }

            case 'getList': {
                const listId = inputs.listId;
                if (!listId) return { error: 'Missing inputs.listId' };
                const body = { listId, page: inputs.page || 1, perPage: inputs.perPage || 20 };
                const res = await fetch(`${BASE_URL}/get-prospects-from-list`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io getList failed' };
                return { output: data };
            }

            case 'listLists': {
                const body = {
                    page: inputs.page || 1,
                    perPage: inputs.perPage || 20,
                };
                const res = await fetch(`${BASE_URL}/get-user-lists`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io listLists failed' };
                return { output: data };
            }

            case 'getProspectLists': {
                const email = inputs.email;
                if (!email) return { error: 'Missing inputs.email' };
                const body = { email };
                const res = await fetch(`${BASE_URL}/get-prospect-lists`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io getProspectLists failed' };
                return { output: data };
            }

            case 'addToEmailDrip': {
                const body: any = {
                    id: inputs.campaignId,
                    emails: inputs.emails || (inputs.email ? [inputs.email] : []),
                };
                const res = await fetch(`${BASE_URL}/add-prospects-to-campaign`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io addToEmailDrip failed' };
                return { output: data };
            }

            case 'listEmailDrips': {
                const body = {
                    page: inputs.page || 1,
                    perPage: inputs.perPage || 20,
                };
                const res = await fetch(`${BASE_URL}/get-user-campaigns`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io listEmailDrips failed' };
                return { output: data };
            }

            case 'getEmailDripStats': {
                const campaignId = inputs.campaignId;
                if (!campaignId) return { error: 'Missing inputs.campaignId' };
                const body = { id: campaignId };
                const res = await fetch(`${BASE_URL}/get-campaign-stats`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io getEmailDripStats failed' };
                return { output: data };
            }

            case 'exportProspects': {
                const body: any = {
                    listId: inputs.listId,
                };
                if (inputs.fields) body.fields = inputs.fields;
                if (inputs.format) body.format = inputs.format;
                const res = await fetch(`${BASE_URL}/export-prospects`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io exportProspects failed' };
                return { output: data };
            }

            case 'searchCompanyProfiles': {
                const body: any = {
                    domain: inputs.domain,
                };
                if (inputs.name) body.name = inputs.name;
                const res = await fetch(`${BASE_URL}/get-company-profile-by-domain`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Snov.io searchCompanyProfiles failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown Snov.io action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Snovio error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Snov.io action failed' };
    }
}
