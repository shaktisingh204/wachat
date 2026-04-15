'use server';

export async function executeEloquaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const companyName = inputs.companyName;
        const username = inputs.username;
        const password = inputs.password;
        const pod = inputs.pod || 'secure.p01.eloqua.com';
        const baseUrl = `https://${pod}/api/REST/2.0`;
        const credentials = Buffer.from(`${companyName}\\${username}:${password}`).toString('base64');
        const authHeader = `Basic ${credentials}`;

        switch (actionName) {
            case 'listContacts': {
                const params = new URLSearchParams({
                    count: String(inputs.count || 100),
                    page: String(inputs.page || 1),
                    ...(inputs.search ? { search: inputs.search } : {}),
                    ...(inputs.depth ? { depth: inputs.depth } : {}),
                });
                const res = await fetch(`${baseUrl}/data/contacts?${params.toString()}`, {
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contacts: data.elements, total: data.total } };
            }

            case 'getContact': {
                const res = await fetch(`${baseUrl}/data/contact/${inputs.contactId}?depth=${inputs.depth || 'complete'}`, {
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'createContact': {
                const res = await fetch(`${baseUrl}/data/contact`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputs.contact),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'updateContact': {
                const res = await fetch(`${baseUrl}/data/contact/${inputs.contactId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputs.contact),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'deleteContact': {
                const res = await fetch(`${baseUrl}/data/contact/${inputs.contactId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': authHeader },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { deleted: true, contactId: inputs.contactId } };
            }

            case 'listEmailAssets': {
                const params = new URLSearchParams({
                    count: String(inputs.count || 100),
                    page: String(inputs.page || 1),
                    ...(inputs.search ? { search: inputs.search } : {}),
                    depth: inputs.depth || 'minimal',
                });
                const res = await fetch(`${baseUrl}/assets/emails?${params.toString()}`, {
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { emails: data.elements, total: data.total } };
            }

            case 'getEmailAsset': {
                const res = await fetch(`${baseUrl}/assets/email/${inputs.emailId}?depth=${inputs.depth || 'complete'}`, {
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { email: data } };
            }

            case 'listCampaigns': {
                const params = new URLSearchParams({
                    count: String(inputs.count || 100),
                    page: String(inputs.page || 1),
                    depth: inputs.depth || 'minimal',
                    ...(inputs.search ? { search: inputs.search } : {}),
                });
                const res = await fetch(`${baseUrl}/assets/campaigns?${params.toString()}`, {
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { campaigns: data.elements, total: data.total } };
            }

            case 'getCampaign': {
                const res = await fetch(`${baseUrl}/assets/campaign/${inputs.campaignId}?depth=${inputs.depth || 'complete'}`, {
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { campaign: data } };
            }

            case 'activateCampaign': {
                const res = await fetch(`${baseUrl}/assets/campaign/active/${inputs.campaignId}`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activateNow: inputs.activateNow !== false, runAsUserId: inputs.runAsUserId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { campaign: data } };
            }

            case 'listForms': {
                const params = new URLSearchParams({
                    count: String(inputs.count || 100),
                    page: String(inputs.page || 1),
                    depth: inputs.depth || 'minimal',
                });
                const res = await fetch(`${baseUrl}/assets/forms?${params.toString()}`, {
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { forms: data.elements, total: data.total } };
            }

            case 'getForm': {
                const res = await fetch(`${baseUrl}/assets/form/${inputs.formId}?depth=${inputs.depth || 'complete'}`, {
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { form: data } };
            }

            case 'listLandingPages': {
                const params = new URLSearchParams({
                    count: String(inputs.count || 100),
                    page: String(inputs.page || 1),
                    depth: inputs.depth || 'minimal',
                });
                const res = await fetch(`${baseUrl}/assets/landingPages?${params.toString()}`, {
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { landingPages: data.elements, total: data.total } };
            }

            case 'getLandingPage': {
                const res = await fetch(`${baseUrl}/assets/landingPage/${inputs.landingPageId}?depth=${inputs.depth || 'complete'}`, {
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { landingPage: data } };
            }

            case 'listPrograms': {
                const params = new URLSearchParams({
                    count: String(inputs.count || 100),
                    page: String(inputs.page || 1),
                    depth: inputs.depth || 'minimal',
                });
                const res = await fetch(`${baseUrl}/assets/programs?${params.toString()}`, {
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { programs: data.elements, total: data.total } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
