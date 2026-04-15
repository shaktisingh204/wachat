
'use server';

const SS_BASE = 'https://api.surveysparrow.com/v3';

async function ssFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[SurveySparrow] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${SS_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `SurveySparrow API error: ${res.status}`);
    }
    return data;
}

export async function executeSurveySparrowAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const ss = (method: string, path: string, body?: any) => ssFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listSurveys': {
                const data = await ss('GET', '/surveys');
                return { output: { surveys: data.data ?? data } };
            }

            case 'getSurvey': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                const data = await ss('GET', `/surveys/${surveyId}`);
                return { output: data.data ?? data };
            }

            case 'createSurvey': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.surveyType) body.survey_type = inputs.surveyType;
                if (inputs.welcomeMessage) body.welcome_message = inputs.welcomeMessage;
                if (inputs.thankYouMessage) body.thank_you_message = inputs.thankYouMessage;
                const data = await ss('POST', '/surveys', body);
                return { output: data.data ?? data };
            }

            case 'listResponses': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.page) params.set('page', String(inputs.page));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await ss('GET', `/surveys/${surveyId}/submissions${query}`);
                return { output: { responses: data.data ?? data } };
            }

            case 'getResponse': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                const responseId = String(inputs.responseId ?? '').trim();
                if (!surveyId || !responseId) throw new Error('surveyId and responseId are required.');
                const data = await ss('GET', `/surveys/${surveyId}/submissions/${responseId}`);
                return { output: data.data ?? data };
            }

            case 'createResponse': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                const body: any = {};
                if (inputs.answers) body.answers = inputs.answers;
                if (inputs.contactEmail) body.contact_email = inputs.contactEmail;
                if (inputs.metadata) body.meta_data = inputs.metadata;
                const data = await ss('POST', `/surveys/${surveyId}/submissions`, body);
                return { output: data.data ?? data };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.page) params.set('page', String(inputs.page));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await ss('GET', `/contacts${query}`);
                return { output: { contacts: data.data ?? data } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await ss('GET', `/contacts/${contactId}`);
                return { output: data.data ?? data };
            }

            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { email };
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.mobile) body.mobile = inputs.mobile;
                const data = await ss('POST', '/contacts', body);
                return { output: data.data ?? data };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.phone) body.phone = inputs.phone;
                const data = await ss('PATCH', `/contacts/${contactId}`, body);
                return { output: data.data ?? data };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await ss('DELETE', `/contacts/${contactId}`);
                return { output: { deleted: true } };
            }

            case 'listChannels': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                const data = await ss('GET', `/surveys/${surveyId}/channels`);
                return { output: { channels: data.data ?? data } };
            }

            case 'shareViaSms': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                const phone = String(inputs.phone ?? '').trim();
                if (!surveyId || !phone) throw new Error('surveyId and phone are required.');
                const body: any = {
                    phone,
                    channel_type: 'sms',
                };
                if (inputs.message) body.message = inputs.message;
                const data = await ss('POST', `/surveys/${surveyId}/share`, body);
                return { output: data.data ?? data };
            }

            case 'shareViaEmail': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!surveyId || !email) throw new Error('surveyId and email are required.');
                const body: any = {
                    email,
                    channel_type: 'email',
                };
                if (inputs.subject) body.subject = inputs.subject;
                if (inputs.message) body.message = inputs.message;
                const data = await ss('POST', `/surveys/${surveyId}/share`, body);
                return { output: data.data ?? data };
            }

            case 'listAnswers': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                const responseId = String(inputs.responseId ?? '').trim();
                if (!surveyId || !responseId) throw new Error('surveyId and responseId are required.');
                const data = await ss('GET', `/surveys/${surveyId}/submissions/${responseId}/answers`);
                return { output: { answers: data.data ?? data } };
            }

            default:
                throw new Error(`Unknown SurveySparrow action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[SurveySparrow] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown SurveySparrow error' };
    }
}
