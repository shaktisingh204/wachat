'use server';

export async function executeFullcontactAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.fullcontact.com/v3';
    const authHeader = `Bearer ${inputs.apiKey}`;

    try {
        let url = '';
        let method = 'POST';
        let body: any = undefined;

        switch (actionName) {
            case 'enrichPerson': {
                url = `${BASE}/person.enrich`;
                body = JSON.stringify({ email: inputs.email, phone: inputs.phone, twitter: inputs.twitter, linkedIn: inputs.linkedIn });
                break;
            }
            case 'enrichCompany': {
                url = `${BASE}/company.enrich`;
                body = JSON.stringify({ domain: inputs.domain, companyName: inputs.companyName });
                break;
            }
            case 'enrichPersonWithMatch': {
                url = `${BASE}/person.enrich`;
                body = JSON.stringify({ match: inputs.match || {} });
                break;
            }
            case 'resolveIdentity': {
                url = `${BASE}/identity.resolve`;
                body = JSON.stringify({ email: inputs.email, phone: inputs.phone, recordId: inputs.recordId, personId: inputs.personId });
                break;
            }
            case 'getIdentityMap': {
                url = `${BASE}/identity.map`;
                body = JSON.stringify({ email: inputs.email, phone: inputs.phone, recordId: inputs.recordId });
                break;
            }
            case 'deleteIdentity': {
                url = `${BASE}/identity.delete`;
                body = JSON.stringify({ recordId: inputs.recordId });
                break;
            }
            case 'verifyEmail': {
                url = `${BASE}/verification.email`;
                body = JSON.stringify({ emailAddress: inputs.email });
                break;
            }
            case 'verifyMatch': {
                url = `${BASE}/verification.match`;
                body = JSON.stringify({ email: inputs.email, phone: inputs.phone });
                break;
            }
            case 'listTags': {
                url = `${BASE}/tags.get`;
                method = 'GET';
                break;
            }
            case 'createTag': {
                url = `${BASE}/tags.create`;
                body = JSON.stringify({ tag: { key: inputs.key, value: inputs.value } });
                break;
            }
            case 'deleteTag': {
                url = `${BASE}/tags.delete`;
                body = JSON.stringify({ tag: { key: inputs.key, value: inputs.value } });
                break;
            }
            case 'listAudiences': {
                url = `${BASE}/audiences.get`;
                method = 'GET';
                break;
            }
            case 'createAudience': {
                url = `${BASE}/audiences.create`;
                body = JSON.stringify({ name: inputs.name, filter: inputs.filter || {} });
                break;
            }
            case 'listWebhooks': {
                url = `${BASE}/webhooks.get`;
                method = 'GET';
                break;
            }
            case 'createWebhook': {
                url = `${BASE}/webhooks.create`;
                body = JSON.stringify({ webhookUrl: inputs.webhookUrl, triggerId: inputs.triggerId });
                break;
            }
            default:
                return { error: `Unknown FullContact action: ${actionName}` };
        }

        const headers: Record<string, string> = {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        };

        const fetchOptions: RequestInit = { method, headers };
        if (body) fetchOptions.body = body;

        const res = await fetch(url, fetchOptions);
        const text = await res.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok) return { error: data?.message || data?.error || `HTTP ${res.status}` };
        return { output: data };
    } catch (err: any) {
        return { error: err?.message || 'Unknown error in executeFullcontactAction' };
    }
}
