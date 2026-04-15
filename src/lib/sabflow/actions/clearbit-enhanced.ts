'use server';

export async function executeClearbitEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const PERSON_BASE = 'https://person.clearbit.com/v2';
    const COMPANY_BASE = 'https://company.clearbit.com/v2';
    const RISK_BASE = 'https://risk.clearbit.com/v1';
    const REVEAL_BASE = 'https://reveal.clearbit.com/v1';
    const PROSPECTOR_BASE = 'https://prospector.clearbit.com/v2';
    const key = inputs.apiKey;
    const authHeader = `Bearer ${key}`;

    try {
        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'enrichPerson':
                url = `${PERSON_BASE}/people/find?email=${encodeURIComponent(inputs.email || '')}`;
                break;
            case 'enrichCompany':
                url = `${COMPANY_BASE}/companies/find?domain=${encodeURIComponent(inputs.domain || '')}`;
                break;
            case 'enrichPersonAndCompany':
                url = `${PERSON_BASE}/combined/find?email=${encodeURIComponent(inputs.email || '')}`;
                break;
            case 'lookupEmail':
                url = `${PERSON_BASE}/people/email/${encodeURIComponent(inputs.email || '')}`;
                break;
            case 'lookupDomain':
                url = `${COMPANY_BASE}/companies/domain/${encodeURIComponent(inputs.domain || '')}`;
                break;
            case 'findEmail': {
                const params = new URLSearchParams({ name: inputs.name || '', domain: inputs.domain || '' });
                url = `https://prospector.clearbit.com/v1/people/find?${params}`;
                break;
            }
            case 'findEmailBulk': {
                url = `https://prospector.clearbit.com/v1/people/find`;
                method = 'POST';
                body = JSON.stringify({ queries: inputs.queries || [] });
                break;
            }
            case 'revealIP':
                url = `${REVEAL_BASE}/companies/find?ip=${encodeURIComponent(inputs.ip || '')}`;
                break;
            case 'searchCompanies': {
                const params = new URLSearchParams({ query: inputs.query || '', limit: String(inputs.limit || 10), page: String(inputs.page || 1) });
                url = `${PROSPECTOR_BASE}/companies/search?${params}`;
                break;
            }
            case 'listCompanies': {
                const params = new URLSearchParams({ page: String(inputs.page || 1), page_size: String(inputs.pageSize || 20) });
                url = `${COMPANY_BASE}/companies?${params}`;
                break;
            }
            case 'autocompleteCompany':
                url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(inputs.query || '')}`;
                break;
            case 'enrichPersonByLinkedIn':
                url = `${PERSON_BASE}/people/find?linkedin=${encodeURIComponent(inputs.linkedinUrl || '')}`;
                break;
            case 'enrichCompanyByLinkedIn':
                url = `${COMPANY_BASE}/companies/find?linkedin=${encodeURIComponent(inputs.linkedinUrl || '')}`;
                break;
            case 'getStatus':
                url = `https://status.clearbit.com/api/v2/status.json`;
                break;
            case 'getUsage':
                url = `https://dashboard.clearbit.com/v1/companies/usage`;
                break;
            default:
                return { error: `Unknown Clearbit Enhanced action: ${actionName}` };
        }

        const headers: Record<string, string> = {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        };

        const res = await fetch(url, { method, headers, body });
        if (res.status === 202) return { output: { status: 'pending', message: 'Enrichment in progress' } };
        if (res.status === 404) return { output: { found: false } };
        const data = await res.json();
        if (!res.ok) return { error: data?.error?.message || data?.message || `HTTP ${res.status}` };
        return { output: data };
    } catch (err: any) {
        return { error: err?.message || 'Unknown error in executeClearbitEnhancedAction' };
    }
}
