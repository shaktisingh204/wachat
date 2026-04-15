'use server';

export async function executeApolloEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = 'https://api.apollo.io/v1';

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
    };

    try {
        switch (actionName) {
            case 'searchContacts': {
                const body: any = {
                    api_key: apiKey,
                    page: inputs.page || 1,
                    per_page: inputs.perPage || 25,
                };
                if (inputs.personTitles) body.person_titles = inputs.personTitles;
                if (inputs.organizationNames) body.organization_names = inputs.organizationNames;
                if (inputs.locationCountries) body.person_locations = inputs.locationCountries;
                if (inputs.emailStatus) body.email_statuses = [inputs.emailStatus];
                if (inputs.keywords) body.q_keywords = inputs.keywords;
                const res = await fetch(`${baseUrl}/mixed_people/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getContact': {
                const personId = inputs.personId;
                const res = await fetch(`${baseUrl}/people/${personId}?api_key=${apiKey}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'enrichContact': {
                const body: any = { api_key: apiKey };
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.organizationName) body.organization_name = inputs.organizationName;
                if (inputs.domain) body.domain = inputs.domain;
                if (inputs.linkedinUrl) body.linkedin_url = inputs.linkedinUrl;
                const res = await fetch(`${baseUrl}/people/match`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'searchOrganizations': {
                const body: any = {
                    api_key: apiKey,
                    page: inputs.page || 1,
                    per_page: inputs.perPage || 25,
                };
                if (inputs.organizationNames) body.organization_names = inputs.organizationNames;
                if (inputs.industries) body.organization_industry_tag_ids = inputs.industries;
                if (inputs.locations) body.organization_locations = inputs.locations;
                if (inputs.keywords) body.q_organization_keyword_tags = inputs.keywords;
                if (inputs.employeeRanges) body.organization_num_employees_ranges = inputs.employeeRanges;
                const res = await fetch(`${baseUrl}/mixed_companies/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getOrganization': {
                const organizationId = inputs.organizationId;
                const res = await fetch(`${baseUrl}/organizations/${organizationId}?api_key=${apiKey}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'enrichOrganization': {
                const body: any = { api_key: apiKey };
                if (inputs.domain) body.domain = inputs.domain;
                if (inputs.organizationName) body.name = inputs.organizationName;
                const res = await fetch(`${baseUrl}/organizations/enrich`, {
                    method: 'GET',
                    headers,
                });
                const params = new URLSearchParams({ api_key: apiKey });
                if (inputs.domain) params.append('domain', inputs.domain);
                const enrichRes = await fetch(`${baseUrl}/organizations/enrich?${params.toString()}`, { headers });
                const data = await enrichRes.json();
                if (!enrichRes.ok) return { error: data.error || data.message || `HTTP ${enrichRes.status}` };
                return { output: data };
            }

            case 'createContact': {
                const body: any = {
                    api_key: apiKey,
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                };
                if (inputs.email) body.email = inputs.email;
                if (inputs.organizationName) body.organization_name = inputs.organizationName;
                if (inputs.title) body.title = inputs.title;
                if (inputs.phone) body.direct_phone = inputs.phone;
                if (inputs.website) body.website_url = inputs.website;
                if (inputs.linkedinUrl) body.linkedin_url = inputs.linkedinUrl;
                const res = await fetch(`${baseUrl}/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'updateContact': {
                const contactId = inputs.contactId;
                const body: any = { api_key: apiKey };
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.email) body.email = inputs.email;
                if (inputs.title) body.title = inputs.title;
                if (inputs.phone) body.direct_phone = inputs.phone;
                if (inputs.organizationName) body.organization_name = inputs.organizationName;
                const res = await fetch(`${baseUrl}/contacts/${contactId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'deleteContact': {
                const contactId = inputs.contactId;
                const res = await fetch(`${baseUrl}/contacts/${contactId}?api_key=${apiKey}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true, contactId } };
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'addToSequence': {
                const body: any = {
                    api_key: apiKey,
                    emailer_campaign_id: inputs.sequenceId,
                    contact_ids: inputs.contactIds || [inputs.contactId],
                    send_email_from_email_account_id: inputs.emailAccountId,
                };
                const res = await fetch(`${baseUrl}/emailer_campaigns/${inputs.sequenceId}/add_contact_ids`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listSequences': {
                const params = new URLSearchParams({ api_key: apiKey });
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.perPage) params.append('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/emailer_campaigns?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getSequence': {
                const sequenceId = inputs.sequenceId;
                const res = await fetch(`${baseUrl}/emailer_campaigns/${sequenceId}?api_key=${apiKey}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'searchEmailAddresses': {
                const body: any = {
                    api_key: apiKey,
                    q_keywords: inputs.keywords || inputs.name,
                    page: inputs.page || 1,
                    per_page: inputs.perPage || 25,
                };
                if (inputs.domain) body.organization_domains = [inputs.domain];
                if (inputs.personTitles) body.person_titles = inputs.personTitles;
                const res = await fetch(`${baseUrl}/mixed_people/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'verifyEmail': {
                const params = new URLSearchParams({ api_key: apiKey, email: inputs.email });
                const res = await fetch(`${baseUrl}/emails/verify?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'createTask': {
                const body: any = {
                    api_key: apiKey,
                    subject: inputs.subject,
                    type: inputs.type || 'manual_email',
                    due_at: inputs.dueAt,
                    contact_ids: inputs.contactIds || [inputs.contactId],
                };
                if (inputs.note) body.note = inputs.note;
                if (inputs.priorityLevel) body.priority_level = inputs.priorityLevel;
                const res = await fetch(`${baseUrl}/tasks`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`ApolloEnhanced error: ${err.message}`);
        return { error: err.message || 'Unknown error occurred' };
    }
}
