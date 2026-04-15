'use server';

export async function executeHunterEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = 'https://api.hunter.io/v2';

    try {
        switch (actionName) {
            case 'domainSearch': {
                const params = new URLSearchParams({ api_key: apiKey });
                if (inputs.domain) params.append('domain', inputs.domain);
                if (inputs.company) params.append('company', inputs.company);
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.type) params.append('type', inputs.type);
                if (inputs.seniority) params.append('seniority', inputs.seniority);
                if (inputs.department) params.append('department', inputs.department);
                const res = await fetch(`${baseUrl}/domain-search?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'emailFinder': {
                const params = new URLSearchParams({ api_key: apiKey });
                if (inputs.domain) params.append('domain', inputs.domain);
                if (inputs.company) params.append('company', inputs.company);
                if (inputs.firstName) params.append('first_name', inputs.firstName);
                if (inputs.lastName) params.append('last_name', inputs.lastName);
                if (inputs.fullName) params.append('full_name', inputs.fullName);
                const res = await fetch(`${baseUrl}/email-finder?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'emailVerifier': {
                const params = new URLSearchParams({ api_key: apiKey, email: inputs.email });
                const res = await fetch(`${baseUrl}/email-verifier?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'emailCount': {
                const params = new URLSearchParams({ api_key: apiKey });
                if (inputs.domain) params.append('domain', inputs.domain);
                if (inputs.company) params.append('company', inputs.company);
                if (inputs.type) params.append('type', inputs.type);
                const res = await fetch(`${baseUrl}/email-count?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'authorFinder': {
                const params = new URLSearchParams({ api_key: apiKey, url: inputs.url });
                const res = await fetch(`${baseUrl}/author-finder?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listLeads': {
                const params = new URLSearchParams({ api_key: apiKey });
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.leadListId) params.append('lead_list_id', String(inputs.leadListId));
                if (inputs.firstName) params.append('first_name', inputs.firstName);
                if (inputs.lastName) params.append('last_name', inputs.lastName);
                if (inputs.email) params.append('email', inputs.email);
                const res = await fetch(`${baseUrl}/leads?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getLead': {
                const leadId = inputs.leadId;
                const params = new URLSearchParams({ api_key: apiKey });
                const res = await fetch(`${baseUrl}/leads/${leadId}?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'createLead': {
                const params = new URLSearchParams({ api_key: apiKey });
                const body: any = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.position) body.position = inputs.position;
                if (inputs.company) body.company = inputs.company;
                if (inputs.companyDomain) body.company_domain = inputs.companyDomain;
                if (inputs.linkedinUrl) body.linkedin_url = inputs.linkedinUrl;
                if (inputs.phoneNumber) body.phone_number = inputs.phoneNumber;
                if (inputs.twitter) body.twitter = inputs.twitter;
                if (inputs.leadListId) body.lead_list_id = inputs.leadListId;
                const res = await fetch(`${baseUrl}/leads?${params.toString()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'updateLead': {
                const leadId = inputs.leadId;
                const params = new URLSearchParams({ api_key: apiKey });
                const body: any = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.position) body.position = inputs.position;
                if (inputs.company) body.company = inputs.company;
                if (inputs.companyDomain) body.company_domain = inputs.companyDomain;
                if (inputs.phoneNumber) body.phone_number = inputs.phoneNumber;
                const res = await fetch(`${baseUrl}/leads/${leadId}?${params.toString()}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'deleteLead': {
                const leadId = inputs.leadId;
                const params = new URLSearchParams({ api_key: apiKey });
                const res = await fetch(`${baseUrl}/leads/${leadId}?${params.toString()}`, {
                    method: 'DELETE',
                });
                if (res.status === 204) return { output: { success: true, leadId } };
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listLeadLists': {
                const params = new URLSearchParams({ api_key: apiKey });
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/leads_lists?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'createLeadList': {
                const params = new URLSearchParams({ api_key: apiKey });
                const body: any = { name: inputs.name };
                if (inputs.teamId) body.team_id = inputs.teamId;
                const res = await fetch(`${baseUrl}/leads_lists?${params.toString()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'deleteLeadList': {
                const leadListId = inputs.leadListId;
                const params = new URLSearchParams({ api_key: apiKey });
                const res = await fetch(`${baseUrl}/leads_lists/${leadListId}?${params.toString()}`, {
                    method: 'DELETE',
                });
                if (res.status === 204) return { output: { success: true, leadListId } };
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listCampaigns': {
                const params = new URLSearchParams({ api_key: apiKey });
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/campaigns?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'addLeadToCampaign': {
                const campaignId = inputs.campaignId;
                const params = new URLSearchParams({ api_key: apiKey });
                const body: any = { lead_id: inputs.leadId };
                const res = await fetch(`${baseUrl}/campaigns/${campaignId}/leads?${params.toString()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.details || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`HunterEnhanced error: ${err.message}`);
        return { error: err.message || 'Unknown error occurred' };
    }
}
