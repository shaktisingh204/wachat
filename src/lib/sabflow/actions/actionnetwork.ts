'use server';

export async function executeActionNetworkAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    const { apiKey, ...params } = inputs;

    if (!apiKey) {
        return { error: 'apiKey is required' };
    }

    const BASE = 'https://actionnetwork.org/api/v2';

    async function req(method: string, path: string, body?: any) {
        const res = await fetch(`${BASE}${path}`, {
            method,
            headers: {
                'OSDI-API-Token': apiKey,
                'Content-Type': 'application/json',
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`ActionNetwork ${method} ${path} failed (${res.status}): ${text}`);
        }
        return res.json();
    }

    try {
        switch (actionName) {
            case 'listPeople': {
                const data = await req('GET', '/people');
                return { output: data };
            }
            case 'getPerson': {
                const { personId } = params;
                if (!personId) return { error: 'personId is required' };
                const data = await req('GET', `/people/${personId}`);
                return { output: data };
            }
            case 'createPerson': {
                const { emailAddress, givenName, familyName, ...rest } = params;
                if (!emailAddress) return { error: 'emailAddress is required' };
                const body: any = {
                    person: {
                        email_addresses: [{ address: emailAddress }],
                        given_name: givenName,
                        family_name: familyName,
                        ...rest,
                    },
                };
                const data = await req('POST', '/people', body);
                return { output: data };
            }
            case 'updatePerson': {
                const { personId, givenName, familyName, ...rest } = params;
                if (!personId) return { error: 'personId is required' };
                const body: any = { person: { given_name: givenName, family_name: familyName, ...rest } };
                const data = await req('PUT', `/people/${personId}`, body);
                return { output: data };
            }
            case 'listEvents': {
                const data = await req('GET', '/events');
                return { output: data };
            }
            case 'getEvent': {
                const { eventId } = params;
                if (!eventId) return { error: 'eventId is required' };
                const data = await req('GET', `/events/${eventId}`);
                return { output: data };
            }
            case 'createEvent': {
                const { title, startDate, ...rest } = params;
                if (!title) return { error: 'title is required' };
                const data = await req('POST', '/events', { title, start_date: startDate, ...rest });
                return { output: data };
            }
            case 'listDonations': {
                const data = await req('GET', '/donations');
                return { output: data };
            }
            case 'createDonation': {
                const { amount, currency, donorId, ...rest } = params;
                if (!amount) return { error: 'amount is required' };
                const data = await req('POST', '/donations', { amount, currency: currency || 'USD', ...rest });
                return { output: data };
            }
            case 'listForms': {
                const data = await req('GET', '/forms');
                return { output: data };
            }
            case 'getForm': {
                const { formId } = params;
                if (!formId) return { error: 'formId is required' };
                const data = await req('GET', `/forms/${formId}`);
                return { output: data };
            }
            case 'listSubmissions': {
                const { formId } = params;
                if (!formId) return { error: 'formId is required' };
                const data = await req('GET', `/forms/${formId}/submissions`);
                return { output: data };
            }
            case 'createSubmission': {
                const { formId, personId, ...rest } = params;
                if (!formId) return { error: 'formId is required' };
                const data = await req('POST', `/forms/${formId}/submissions`, { person_id: personId, ...rest });
                return { output: data };
            }
            case 'listSignupForms': {
                const data = await req('GET', '/signup_forms');
                return { output: data };
            }
            case 'listCampaigns': {
                const data = await req('GET', '/campaigns');
                return { output: data };
            }
            case 'sendBroadcast': {
                const { subject, body, fromName, fromEmail, ...rest } = params;
                if (!subject || !body) return { error: 'subject and body are required' };
                const payload = {
                    subject,
                    body,
                    from_name: fromName,
                    from_email: fromEmail,
                    ...rest,
                };
                const data = await req('POST', '/messages', payload);
                return { output: data };
            }
            default:
                return { error: `Unknown ActionNetwork action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`ActionNetwork action error: ${err.message}`);
        return { error: err.message };
    }
}
