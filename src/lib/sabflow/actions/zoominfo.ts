'use server';

async function getZoomInfoToken(inputs: any): Promise<string | null> {
    if (inputs.jwt) return inputs.jwt;
    if (inputs.username && inputs.password) {
        const res = await fetch('https://api.zoominfo.com/authenticate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: inputs.username, password: inputs.password }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.jwt || null;
    }
    return null;
}

export async function executeZoomInfoAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.zoominfo.com';

    try {
        const token = await getZoomInfoToken(inputs);
        if (!token) return { error: 'Authentication failed: provide inputs.jwt or inputs.username and inputs.password' };

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'searchContacts': {
                const body: any = {
                    rpp: inputs.rpp || 25,
                    page: inputs.page || 1,
                };
                if (inputs.firstName) body.firstName = inputs.firstName;
                if (inputs.lastName) body.lastName = inputs.lastName;
                if (inputs.jobTitle) body.jobTitle = [inputs.jobTitle];
                if (inputs.companyName) body.companyName = [inputs.companyName];
                if (inputs.email) body.email = inputs.email;
                if (inputs.locationCountry) body.locationCountry = [inputs.locationCountry];
                const res = await fetch(`${baseUrl}/search/contact`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getContact': {
                const contactId = inputs.contactId;
                const res = await fetch(`${baseUrl}/lookup/contact/${contactId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'searchCompanies': {
                const body: any = {
                    rpp: inputs.rpp || 25,
                    page: inputs.page || 1,
                };
                if (inputs.companyName) body.companyName = [inputs.companyName];
                if (inputs.industry) body.industryKeyword = [inputs.industry];
                if (inputs.country) body.locationCountry = [inputs.country];
                if (inputs.employeeRange) body.employeeRange = inputs.employeeRange;
                if (inputs.revenueRange) body.revenueRange = inputs.revenueRange;
                const res = await fetch(`${baseUrl}/search/company`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getCompany': {
                const companyId = inputs.companyId;
                const res = await fetch(`${baseUrl}/lookup/company/${companyId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'enrichContact': {
                const body: any = {};
                if (inputs.email) body.emailAddress = inputs.email;
                if (inputs.firstName) body.firstName = inputs.firstName;
                if (inputs.lastName) body.lastName = inputs.lastName;
                if (inputs.companyName) body.companyName = inputs.companyName;
                if (inputs.phone) body.phone = inputs.phone;
                const res = await fetch(`${baseUrl}/enrich/contact`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ matchPersonInput: [body] }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'enrichCompany': {
                const body: any = {};
                if (inputs.companyName) body.companyName = inputs.companyName;
                if (inputs.website) body.website = inputs.website;
                if (inputs.companyId) body.zi_c_id = inputs.companyId;
                const res = await fetch(`${baseUrl}/enrich/company`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ matchCompanyInput: [body] }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'searchIntent': {
                const body: any = {
                    topics: inputs.topics || [],
                    rpp: inputs.rpp || 25,
                    page: inputs.page || 1,
                };
                if (inputs.companyIds) body.companyIds = inputs.companyIds;
                if (inputs.dateRange) body.dateRange = inputs.dateRange;
                const res = await fetch(`${baseUrl}/search/intent`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getTechnographics': {
                const companyId = inputs.companyId;
                const res = await fetch(`${baseUrl}/lookup/technographics/${companyId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getCompanyHierarchy': {
                const companyId = inputs.companyId;
                const res = await fetch(`${baseUrl}/lookup/company/hierarchy/${companyId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'searchNews': {
                const body: any = {
                    rpp: inputs.rpp || 25,
                    page: inputs.page || 1,
                };
                if (inputs.companyIds) body.companyIds = inputs.companyIds;
                if (inputs.keywords) body.keywords = inputs.keywords;
                if (inputs.dateRange) body.dateRange = inputs.dateRange;
                const res = await fetch(`${baseUrl}/search/news`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'exportContacts': {
                const body: any = {
                    contactIds: inputs.contactIds || [],
                    outputFields: inputs.outputFields || ['firstName', 'lastName', 'email', 'phone', 'jobTitle', 'companyName'],
                };
                const res = await fetch(`${baseUrl}/export/contact`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'exportCompanies': {
                const body: any = {
                    companyIds: inputs.companyIds || [],
                    outputFields: inputs.outputFields || ['companyName', 'website', 'revenue', 'employees', 'industry'],
                };
                const res = await fetch(`${baseUrl}/export/company`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listSavedSearches': {
                const params = new URLSearchParams();
                if (inputs.type) params.append('type', inputs.type);
                const url = `${baseUrl}/saved-searches${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getSavedSearch': {
                const searchId = inputs.searchId;
                const res = await fetch(`${baseUrl}/saved-searches/${searchId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getUsage': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.append('startDate', inputs.startDate);
                if (inputs.endDate) params.append('endDate', inputs.endDate);
                const url = `${baseUrl}/usage${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`ZoomInfo error: ${err.message}`);
        return { error: err.message || 'Unknown error occurred' };
    }
}
